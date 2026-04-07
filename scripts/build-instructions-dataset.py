#!/usr/bin/env python3
"""Build a full offline instructions dataset from configurable legal sources.

The builder loads a source definition config, fetches TOC pages, parses document
structure (chapter/section/point/subpoint), and writes a normalized model for
offline navigation and hybrid local search.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass
from datetime import datetime, timezone
from html import unescape
from html.parser import HTMLParser
from pathlib import Path
from typing import Dict, Iterable, List, Optional, Tuple
from urllib.error import HTTPError, URLError
from urllib.parse import urljoin, urlparse
from urllib.request import Request, urlopen

BASE_URL = "https://sudact.ru"
DEFAULT_TOC_URL = (
    BASE_URL
    + "/law/prikaz-mintransa-rossii-ot-23062022-n-250/"
    + "pravila-tekhnicheskoi-ekspluatatsii-zheleznykh-dorog/i/"
)
DEFAULT_RULES_PATH = (
    "/law/prikaz-mintransa-rossii-ot-23062022-n-250/"
    "pravila-tekhnicheskoi-ekspluatatsii-zheleznykh-dorog/"
)
DEFAULT_SOURCE_DEFINITIONS = {
    "tocUrl": DEFAULT_TOC_URL,
    "provider": "sudact.ru",
    "version": "2026.04.06.full.v3",
    "instructions": [
        {
            "id": "pte",
            "title": "ПТЭ",
            "shortDescription": "Правила технической эксплуатации железных дорог Российской Федерации",
            "version": "Приказ Минтранса России от 23.06.2022 N 250",
            "rootPath": DEFAULT_RULES_PATH,
            "includePrefixes": [DEFAULT_RULES_PATH],
            "excludePrefixes": [
                DEFAULT_RULES_PATH + "prilozhenie-n-1/",
                DEFAULT_RULES_PATH + "prilozhenie-n-2/",
            ],
        },
        {
            "id": "isi",
            "title": "ИСИ",
            "shortDescription": "Инструкция по сигнализации на железнодорожном транспорте Российской Федерации",
            "version": "Приложение N 1 к ПТЭ (Приказ Минтранса России N 250)",
            "rootPath": DEFAULT_RULES_PATH + "prilozhenie-n-1/",
            "includePrefixes": [DEFAULT_RULES_PATH + "prilozhenie-n-1/"],
        },
        {
            "id": "idp",
            "title": "ИДП",
            "shortDescription": "Инструкция по организации движения поездов и маневровой работы",
            "version": "Приложение N 2 к ПТЭ (Приказ Минтранса России N 250)",
            "rootPath": DEFAULT_RULES_PATH + "prilozhenie-n-2/",
            "includePrefixes": [DEFAULT_RULES_PATH + "prilozhenie-n-2/"],
        },
    ],
}
DEFAULT_SOURCES_CONFIG_PATH = Path("assets/instructions/sources.v2.json")

USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
)


def normalize_space(value: str) -> str:
    return re.sub(r"\s+", " ", value or "").strip()


def normalize_path(href: str) -> str:
    parsed = urlparse(href)
    path = parsed.path or ""
    if not path.startswith("/"):
        path = "/" + path
    if path and not path.endswith("/"):
        path += "/"
    return path


class TocParser(HTMLParser):
    """Parse nested anchors from <ul class="skinClearMod2_base">."""

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.in_target = False
        self.ul_depth = 0
        self.in_a = False
        self.curr_href = ""
        self.curr_text: List[str] = []
        self.items: List[Dict[str, object]] = []

    def handle_starttag(self, tag: str, attrs: List[Tuple[str, Optional[str]]]) -> None:
        attrs_dict = {k: (v or "") for k, v in attrs}
        if tag == "ul":
            classes = attrs_dict.get("class", "")
            if not self.in_target and "skinClearMod2_base" in classes:
                self.in_target = True
                self.ul_depth = 1
                return
            if self.in_target:
                self.ul_depth += 1
                return

        if not self.in_target:
            return

        if tag == "a":
            self.in_a = True
            self.curr_href = attrs_dict.get("href", "")
            self.curr_text = []

    def handle_endtag(self, tag: str) -> None:
        if not self.in_target:
            return
        if tag == "a" and self.in_a:
            title = normalize_space("".join(self.curr_text))
            if title and self.curr_href:
                self.items.append(
                    {
                        "depth": max(0, self.ul_depth - 1),
                        "href": normalize_path(self.curr_href),
                        "title": title,
                    }
                )
            self.in_a = False
            self.curr_href = ""
            self.curr_text = []
            return
        if tag == "ul":
            self.ul_depth -= 1
            if self.ul_depth <= 0:
                self.in_target = False

    def handle_data(self, data: str) -> None:
        if self.in_target and self.in_a:
            self.curr_text.append(data)


class LawPageParser(HTMLParser):
    """Extract h1 title and plain text from div#law_text_body."""

    BREAK_ON_START = {"br"}
    BREAK_ON_END = {"p", "li", "pre", "tr", "h2", "h3", "h4", "h5", "table"}

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.in_h1 = False
        self.heading_parts: List[str] = []
        self.heading_found = False

        self.body_active = False
        self.body_depth = 0
        self.body_chunks: List[str] = []

    def handle_starttag(self, tag: str, attrs: List[Tuple[str, Optional[str]]]) -> None:
        attrs_dict = {k: (v or "") for k, v in attrs}
        if tag == "h1" and not self.heading_found:
            self.in_h1 = True
            return
        if tag == "div":
            if not self.body_active and attrs_dict.get("id") == "law_text_body":
                self.body_active = True
                self.body_depth = 1
                return
            if self.body_active:
                self.body_depth += 1
                return

        if self.body_active and tag in self.BREAK_ON_START:
            self.body_chunks.append("\n")

    def handle_endtag(self, tag: str) -> None:
        if tag == "h1" and self.in_h1:
            self.in_h1 = False
            self.heading_found = True
            return
        if not self.body_active:
            return
        if tag in self.BREAK_ON_END:
            self.body_chunks.append("\n\n")
        if tag == "div":
            self.body_depth -= 1
            if self.body_depth <= 0:
                self.body_active = False
                self.body_depth = 0

    def handle_data(self, data: str) -> None:
        if self.in_h1:
            self.heading_parts.append(data)
        if self.body_active:
            self.body_chunks.append(data)

    def heading(self) -> str:
        return normalize_space(unescape("".join(self.heading_parts)))

    def body_text(self) -> str:
        raw = unescape("".join(self.body_chunks)).replace("\xa0", " ")
        raw = raw.replace("\r", "")
        raw = re.sub(r"[ \t]+\n", "\n", raw)
        raw = re.sub(r"\n[ \t]+", "\n", raw)
        raw = re.sub(r"[ \t]{2,}", " ", raw)
        raw = re.sub(r"\n{3,}", "\n\n", raw)
        lines = [line.strip() for line in raw.split("\n")]
        compact = "\n".join(lines)
        compact = re.sub(r"\n{3,}", "\n\n", compact)
        return compact.strip()


@dataclass
class TocItem:
    order: int
    depth: int
    href: str
    title: str
    parent_href: Optional[str]


@dataclass
class InstructionDefinition:
    id: str
    title: str
    short_description: str
    version: str
    root_path: str
    include_prefixes: List[str]
    exclude_prefixes: List[str]


@dataclass
class SourceConfig:
    provider: str
    toc_url: str
    version: str
    instructions: List[InstructionDefinition]


def load_source_config(path: Optional[Path] = None) -> SourceConfig:
    config_path = path or DEFAULT_SOURCES_CONFIG_PATH
    if config_path.exists():
        raw = json.loads(config_path.read_text(encoding="utf-8"))
    else:
        raw = DEFAULT_SOURCE_DEFINITIONS

    toc_url = str(raw.get("tocUrl") or DEFAULT_TOC_URL).strip()
    provider = str(raw.get("provider") or "unknown").strip()
    version = str(raw.get("version") or "local").strip()
    source_items = raw.get("instructions") or []
    if not isinstance(source_items, list) or not source_items:
        raise RuntimeError("Source config must contain a non-empty 'instructions' list.")

    instructions: List[InstructionDefinition] = []
    seen_ids = set()
    for item in source_items:
        if not isinstance(item, dict):
            continue
        instruction_id = str(item.get("id") or "").strip().lower()
        if not instruction_id:
            raise RuntimeError("Instruction definition is missing 'id'.")
        if instruction_id in seen_ids:
            raise RuntimeError(f"Duplicate instruction id in config: {instruction_id}")
        seen_ids.add(instruction_id)

        root_path = normalize_path(str(item.get("rootPath") or ""))
        include_prefixes = item.get("includePrefixes") or [root_path]
        exclude_prefixes = item.get("excludePrefixes") or []
        normalized_include = [normalize_path(str(prefix)) for prefix in include_prefixes if str(prefix).strip()]
        normalized_exclude = [normalize_path(str(prefix)) for prefix in exclude_prefixes if str(prefix).strip()]
        if not normalized_include:
            normalized_include = [root_path]
        if not root_path:
            root_path = normalized_include[0]

        instructions.append(
            InstructionDefinition(
                id=instruction_id,
                title=str(item.get("title") or instruction_id.upper()),
                short_description=str(item.get("shortDescription") or ""),
                version=str(item.get("version") or ""),
                root_path=root_path,
                include_prefixes=normalized_include,
                exclude_prefixes=normalized_exclude,
            )
        )

    return SourceConfig(
        provider=provider,
        toc_url=toc_url,
        version=version,
        instructions=instructions,
    )


def request_text(url: str, timeout: int = 35, retries: int = 2) -> str:
    last_error: Optional[Exception] = None
    for attempt in range(retries + 1):
        try:
            request = Request(url, headers={"User-Agent": USER_AGENT})
            with urlopen(request, timeout=timeout) as response:
                content = response.read()
            return content.decode("utf-8", errors="ignore")
        except (HTTPError, URLError, TimeoutError) as err:  # pragma: no cover
            last_error = err
            if attempt < retries:
                time.sleep(1.0 + attempt * 0.7)
            continue
    raise RuntimeError(f"Failed to load {url}: {last_error}")


def parse_toc_items(html: str) -> List[TocItem]:
    parser = TocParser()
    parser.feed(html)

    dedup: List[Dict[str, object]] = []
    seen = set()
    for item in parser.items:
        key = (item["href"], item["title"], item["depth"])
        if key in seen:
            continue
        seen.add(key)
        dedup.append(item)

    stack: List[Dict[str, object]] = []
    out: List[TocItem] = []
    for idx, item in enumerate(dedup):
        depth = int(item["depth"])
        while stack and int(stack[-1]["depth"]) >= depth:
            stack.pop()
        parent_href = str(stack[-1]["href"]) if stack else None
        out.append(
            TocItem(
                order=idx,
                depth=depth,
                href=str(item["href"]),
                title=str(item["title"]),
                parent_href=parent_href,
            )
        )
        stack.append(item)
    return out


def split_number_title(value: str) -> Tuple[str, str]:
    text = normalize_space(value)
    if not text:
        return "", ""

    patterns = [
        r"^([A-Za-zА-Яа-яЁё]+(?:\s+[A-Za-zА-Яа-яЁё]+)*\s+N\s*\d+[A-Za-zА-Яа-яЁё0-9-]*)\.?\s*(.+)$",
        r"^([IVXLCDM]+)\.\s+(.+)$",
        r"^(\d+(?:\.\d+)*)[.)]\s+(.+)$",
        r"^((?:пункт|раздел|глава)\s+\d+(?:\.\d+)*)[.)]?\s*(.+)$",
    ]
    for pattern in patterns:
        match = re.match(pattern, text, flags=re.IGNORECASE)
        if match:
            return normalize_space(match.group(1)), normalize_space(match.group(2))
    return "", text


def node_type_for_relative_depth(depth: int, title: str) -> str:
    normalized_title = normalize_space(title).lower()
    if depth <= 0:
        return "document"
    if normalized_title.startswith("глава ") or re.match(r"^[ivxlcdm]+\.\s", normalized_title):
        return "chapter"
    if depth == 1:
        return "chapter"
    if depth == 2:
        return "section"
    if depth == 3:
        return "subsection"
    if re.match(r"^\d+(\.\d+)*[.)]?\s", title):
        return "point"
    return "subsection"


MAIN_POINT_RE = re.compile(r"^(\d+(?:\.\d+)*)\.\s*(.*)$")
SUBPOINT_DIGIT_RE = re.compile(r"^(\d+)\)\s*(.*)$")
SUBPOINT_PAREN_DIGIT_RE = re.compile(r"^\((\d+)\)\s*(.*)$")
SUBPOINT_LETTER_RE = re.compile(r"^([а-яёa-z])\)\s*(.*)$", flags=re.IGNORECASE)
SUBPOINT_BULLET_RE = re.compile(r"^[-—–]\s*(.*)$")
LIST_MARKER_RE = re.compile(
    r"^(?:\d+(?:\.\d+)*[.)]|[а-яёa-z]\)|\(\d+\)|[-—–])\s+",
    flags=re.IGNORECASE,
)


def split_nonempty_paragraphs(text: str) -> List[str]:
    if not text:
        return []
    raw_parts = re.split(r"\n{2,}", text)
    out: List[str] = []
    for part in raw_parts:
        chunk = str(part or "").replace("\r", "")
        if not chunk.strip():
            continue
        lines = [normalize_space(line) for line in chunk.split("\n")]
        lines = [line for line in lines if line]
        if not lines:
            continue

        buffer: List[str] = []

        def flush_buffer() -> None:
            if not buffer:
                return
            merged = normalize_space(" ".join(buffer))
            buffer.clear()
            if not merged:
                return
            if re.fullmatch(r"[-=_]{6,}", merged):
                return
            out.append(merged)

        for line in lines:
            if LIST_MARKER_RE.match(line):
                flush_buffer()
                out.append(line)
            else:
                buffer.append(line)
        flush_buffer()
    return out


def append_node_content(node: Dict[str, object], paragraph: str) -> None:
    INSTRUCTION_REF_RE = re.compile(
    r"\b((?:п\.|пункт)\s*)(\d+(?:\.\d+)*)(\.?)(\s+)(ПТЭ|ИСИ|ИДП)\b",
    re.IGNORECASE,
)

INSTRUCTION_ALIASES = {
    "ПТЭ": "pte",
    "ИСИ": "isi",
    "ИДП": "idp",
}


def build_content_blocks(text: str) -> List[Dict[str, str]]:
    paragraphs = split_nonempty_paragraphs(text)
    blocks: List[Dict[str, str]] = []

    for paragraph in paragraphs:
        point_match = re.match(r"^(\d+(?:\.\d+)*)[.)]?\s+(.*)$", paragraph)
        if point_match:
            blocks.append(
                {
                    "type": "point",
                    "number": point_match.group(1) + ".",
                    "text": normalize_space(point_match.group(2)),
                }
            )
            continue

        blocks.append(
            {
                "type": "paragraph",
                "text": paragraph,
            }
        )

    return blocks


def extract_instruction_references(text: str) -> List[Dict[str, str]]:
    source = text or ""
    refs: List[Dict[str, str]] = []
    seen = set()

    for match in INSTRUCTION_REF_RE.finditer(source):
        label = normalize_space(match.group(0))
        target_number = normalize_space(match.group(2))
        instruction_code = normalize_space(match.group(5)).upper()
        instruction_id = INSTRUCTION_ALIASES.get(instruction_code)
        if not instruction_id or not target_number:
            continue

        key = (instruction_id, target_number, label)
        if key in seen:
            continue
        seen.add(key)

        refs.append(
            {
                "type": "instruction_point",
                "instructionId": instruction_id,
                "targetNumber": target_number,
                "label": label,
            }
        )

    return refs


def decorate_node_text_fields(node: Dict[str, object]) -> None:
    text = str(node.get("content") or node.get("plainText") or "").strip()
    node["contentBlocks"] = build_content_blocks(text)
    node["references"] = extract_instruction_references(text)    
    text = normalize_space(paragraph)
    if not text:
        return
    existing = str(node.get("content") or "")
    merged = f"{existing}\n\n{text}" if existing else text
    node["content"] = merged
    node["plainText"] = merged


def make_nested_node_id(parent_id: str, node_type: str, number: str, order: int, content: str) -> str:
    seed = f"{parent_id}:{node_type}:{number}:{order}:{content[:160]}"
    suffix = hashlib.sha1(seed.encode("utf-8")).hexdigest()[:12]
    return f"{parent_id}-{node_type[:2]}-{suffix}"


def build_point_title(number: str, body: str) -> str:
    clean_body = normalize_space(body)
    first_sentence = re.split(r"(?<=[.!?])\s+", clean_body, maxsplit=1)[0].strip()
    if not first_sentence:
        return f"Пункт {number}".strip()
    if len(first_sentence) > 132:
        first_sentence = first_sentence[:129].rstrip() + "..."
    return first_sentence


def extract_structured_children(
    instruction_id: str,
    parent_node_id: str,
    content: str,
    source: Dict[str, str],
    sibling_counters: Dict[str, int],
) -> Tuple[str, List[Dict[str, object]]]:
    paragraphs = split_nonempty_paragraphs(content)
    if not paragraphs:
        return "", []

    children: List[Dict[str, object]] = []
    intro_parts: List[str] = []
    current_point: Optional[Dict[str, object]] = None
    current_main_number = ""
    current_numeric_subpoint: Optional[Dict[str, object]] = None
    current_letter_subpoint: Optional[Dict[str, object]] = None

    def next_order(parent_id: str) -> int:
        value = sibling_counters.get(parent_id, 0) + 1
        sibling_counters[parent_id] = value
        return value

    def create_node(node_type: str, parent_id: str, number: str, body: str) -> Dict[str, object]:
        normalized_body = normalize_space(body)
        order = next_order(parent_id)
        node_id = make_nested_node_id(parent_id, node_type, number, order, normalized_body)
        node = {
            "id": node_id,
            "instructionId": instruction_id,
            "parentId": parent_id,
            "type": node_type,
            "order": order,
            "number": number,
            "title": build_point_title(number, normalized_body),
            "content": normalized_body,
            "plainText": normalized_body,
            "source": source,
        }
        children.append(node)
        sibling_counters.setdefault(node_id, 0)
        return node

    for para in paragraphs:
        main_match = MAIN_POINT_RE.match(para)
        if main_match:
            point_number = normalize_space(main_match.group(1))
            body = normalize_space(main_match.group(2))

            parent_for_point = parent_node_id
            node_type = "point"
            if (
                current_point
                and current_main_number
                and point_number.startswith(current_main_number + ".")
                and point_number.count(".") > current_main_number.count(".")
            ):
                parent_for_point = str(current_point["id"])
                node_type = "subpoint"

            current_point = create_node(node_type, parent_for_point, point_number + ".", body)
            if node_type == "point":
                current_main_number = point_number
            current_numeric_subpoint = None
            current_letter_subpoint = None
            continue

        numeric_match = SUBPOINT_DIGIT_RE.match(para) or SUBPOINT_PAREN_DIGIT_RE.match(para)
        if numeric_match:
            number = normalize_space(numeric_match.group(1)) + ")"
            body = normalize_space(numeric_match.group(2))
            parent_for_subpoint = str(current_point["id"]) if current_point else parent_node_id
            current_numeric_subpoint = create_node("subpoint", parent_for_subpoint, number, body)
            current_letter_subpoint = None
            continue

        letter_match = SUBPOINT_LETTER_RE.match(para)
        if letter_match:
            number = normalize_space(letter_match.group(1)) + ")"
            body = normalize_space(letter_match.group(2))
            if current_numeric_subpoint:
                parent_for_subpoint = str(current_numeric_subpoint["id"])
            elif current_point:
                parent_for_subpoint = str(current_point["id"])
            else:
                parent_for_subpoint = parent_node_id
            current_letter_subpoint = create_node("subpoint", parent_for_subpoint, number, body)
            continue

        bullet_match = SUBPOINT_BULLET_RE.match(para)
        if bullet_match:
            body = normalize_space(bullet_match.group(1))
            if not body:
                continue
            if current_letter_subpoint:
                parent_for_subpoint = str(current_letter_subpoint["id"])
            elif current_numeric_subpoint:
                parent_for_subpoint = str(current_numeric_subpoint["id"])
            elif current_point:
                parent_for_subpoint = str(current_point["id"])
            else:
                parent_for_subpoint = parent_node_id
            current_letter_subpoint = create_node("subpoint", parent_for_subpoint, "вЂ”", body)
            continue

        deepest = current_letter_subpoint or current_numeric_subpoint or current_point
        if deepest:
            append_node_content(deepest, para)
        else:
            intro_parts.append(para)

    intro_text = "\n\n".join(intro_parts).strip()
    return intro_text, children


def make_node_id(instruction_id: str, href: str) -> str:
    token = hashlib.sha1(f"{instruction_id}:{href}".encode("utf-8")).hexdigest()[:14]
    return f"{instruction_id}-{token}"


def match_instruction_definition(href: str, definitions: List[InstructionDefinition]) -> Optional[InstructionDefinition]:
    path = normalize_path(href)
    best: Optional[InstructionDefinition] = None
    best_match_len = -1
    for definition in definitions:
        if any(path.startswith(prefix) for prefix in definition.exclude_prefixes):
            continue
        matching_prefixes = [prefix for prefix in definition.include_prefixes if path.startswith(prefix)]
        if not matching_prefixes:
            continue
        prefix_len = max(len(prefix) for prefix in matching_prefixes)
        if prefix_len > best_match_len:
            best = definition
            best_match_len = prefix_len
    return best


def classify_toc_items(
    toc_items: List[TocItem],
    definitions: List[InstructionDefinition],
) -> Dict[str, str]:
    assignments: Dict[str, str] = {}
    for item in toc_items:
        matched = match_instruction_definition(item.href, definitions)
        if matched:
            assignments[item.href] = matched.id
    return assignments


def fetch_page_payload(path: str) -> Dict[str, str]:
    url = urljoin(BASE_URL, path)
    html = request_text(url)
    parser = LawPageParser()
    parser.feed(html)
    return {
        "url": url,
        "heading": parser.heading(),
        "content": parser.body_text(),
    }


def build_instruction(
    definition: InstructionDefinition,
    toc_items: List[TocItem],
    assignments: Dict[str, str],
    fetched_pages: Dict[str, Dict[str, str]],
    fetched_at: str,
) -> Dict[str, object]:
    instruction_id = definition.id
    branch = [item for item in toc_items if assignments.get(item.href) == instruction_id]
    branch.sort(key=lambda item: item.order)
    if not branch:
        raise RuntimeError(f"No TOC entries found for instruction '{instruction_id}'")

    by_href = {item.href: item for item in branch}
    root_path = normalize_path(definition.root_path)
    if root_path not in by_href:
        raise RuntimeError(f"Root path '{root_path}' not found for '{instruction_id}'")

    root_item = by_href[root_path]
    root_page = fetched_pages.get(root_path, {})
    root_number, root_title = split_number_title(root_item.title)
    doc_title = root_title or root_page.get("heading") or definition.title

    nodes: List[Dict[str, object]] = []
    document_node_id = f"{instruction_id}-document"
    nodes.append(
        {
            "id": document_node_id,
            "instructionId": instruction_id,
            "parentId": None,
            "type": "document",
            "order": 0,
            "number": root_number or "",
            "title": doc_title,
            "content": root_page.get("content", ""),
            "plainText": root_page.get("content", ""),
            "source": {
                "url": root_page.get("url", urljoin(BASE_URL, root_path)),
                "path": root_path,
                "fetchedAt": fetched_at,
            },
        }
    )

    path_to_node_id: Dict[str, str] = {root_path: document_node_id}
    sibling_counters: Dict[str, int] = {document_node_id: 0}

    for item in branch:
        if item.href == root_path:
            continue

        parent_path = item.parent_href
        while parent_path and parent_path not in path_to_node_id:
            parent_item = by_href.get(parent_path)
            parent_path = parent_item.parent_href if parent_item else None
        parent_id = path_to_node_id.get(parent_path or "", document_node_id)

        depth_relative = max(1, item.depth - root_item.depth)
        number, node_title = split_number_title(item.title)
        page = fetched_pages.get(item.href, {})
        content = page.get("content", "")
        node_id = make_node_id(instruction_id, item.href)
        order_value = sibling_counters.get(parent_id, 0) + 1
        sibling_counters[parent_id] = order_value

        node = {
            "id": node_id,
            "instructionId": instruction_id,
            "parentId": parent_id,
            "type": node_type_for_relative_depth(depth_relative, item.title),
            "order": order_value,
            "number": number,
            "title": node_title or page.get("heading") or item.title,
            "content": content,
            "plainText": content,
            "source": {
                "url": page.get("url", urljoin(BASE_URL, item.href)),
                "path": item.href,
                "fetchedAt": fetched_at,
            },
        }
        nodes.append(node)
        path_to_node_id[item.href] = node_id
        sibling_counters.setdefault(node_id, 0)

        intro_text, nested_children = extract_structured_children(
            instruction_id=instruction_id,
            parent_node_id=node_id,
            content=content,
            source={
                "url": page.get("url", urljoin(BASE_URL, item.href)),
                "path": item.href,
                "fetchedAt": fetched_at,
            },
            sibling_counters=sibling_counters,
        )
        if nested_children:
            node["content"] = intro_text
            node["plainText"] = intro_text
            nodes.extend(nested_children)
    for node in nodes:
        decorate_node_text_fields(node)
    return {
        "id": instruction_id,
        "title": definition.title,
        "shortDescription": definition.short_description,
        "version": definition.version,
        "sourceUrl": urljoin(BASE_URL, root_path),
        "nodes": nodes,
    }


def build_dataset(max_workers: int = 6, source_config_path: Optional[Path] = None) -> Dict[str, object]:
    source_config = load_source_config(source_config_path)
    toc_html = request_text(source_config.toc_url)
    toc_items = parse_toc_items(toc_html)
    assignments = classify_toc_items(toc_items, source_config.instructions)

    target_paths = sorted(
        {
            item.href
            for item in toc_items
            if item.href in assignments
        }
    )

    print(f"TOC items: {len(toc_items)}; pages to fetch: {len(target_paths)}", file=sys.stderr)

    fetched_pages: Dict[str, Dict[str, str]] = {}
    failures: List[Tuple[str, str]] = []
    with ThreadPoolExecutor(max_workers=max_workers) as pool:
        futures = {pool.submit(fetch_page_payload, path): path for path in target_paths}
        for future in as_completed(futures):
            path = futures[future]
            try:
                fetched_pages[path] = future.result()
            except Exception as err:  # pragma: no cover
                failures.append((path, str(err)))
                fetched_pages[path] = {"url": urljoin(BASE_URL, path), "heading": "", "content": ""}

    if failures:
        print(f"Warnings: {len(failures)} pages failed to load.", file=sys.stderr)
        for path, err in failures[:10]:
            print(f"  - {path}: {err}", file=sys.stderr)

    now = datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")

    instructions = []
    for definition in source_config.instructions:
        if definition.root_path not in assignments:
            matched_root = match_instruction_definition(definition.root_path, source_config.instructions)
            if not matched_root or matched_root.id != definition.id:
                print(
                    f"Warning: definition '{definition.id}' root path {definition.root_path} is not classified by prefixes.",
                    file=sys.stderr,
                )
        try:
            instruction_payload = build_instruction(
                definition=definition,
                toc_items=toc_items,
                assignments=assignments,
                fetched_pages=fetched_pages,
                fetched_at=now,
            )
            instructions.append(instruction_payload)
        except RuntimeError as err:
            print(f"Warning: skipped instruction '{definition.id}': {err}", file=sys.stderr)

    if not instructions:
        raise RuntimeError("No instructions were built. Check source config and TOC mapping.")

    return {
        "version": source_config.version or "2026.04.06.full.v3",
        "updatedAt": now,
        "source": {
            "provider": source_config.provider,
            "tocUrl": source_config.toc_url,
            "generatedAt": now,
            "notes": "Полные тексты собраны из открытых источников по конфигу инструкций.",
        },
        "instructions": instructions,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Build full instructions dataset.")
    parser.add_argument(
        "--output",
        action="append",
        help="Output JSON path (can be passed multiple times).",
    )
    parser.add_argument(
        "--workers",
        type=int,
        default=6,
        help="Concurrent fetch workers (default: 6).",
    )
    parser.add_argument(
        "--sources-config",
        default=str(DEFAULT_SOURCES_CONFIG_PATH),
        help="Path to source definitions JSON (default: assets/instructions/sources.v2.json).",
    )
    args = parser.parse_args()

    outputs = args.output or [
        "assets/instructions/catalog.v2.json",
        "data/instructions/catalog.v2.json",
    ]

    source_config_path = Path(args.sources_config) if args.sources_config else None
    dataset = build_dataset(
        max_workers=max(1, args.workers),
        source_config_path=source_config_path,
    )
    payload = json.dumps(dataset, ensure_ascii=False, indent=2)

    for output in outputs:
        path = Path(output)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(payload, encoding="utf-8")
        print(f"Wrote {path}", file=sys.stderr)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
