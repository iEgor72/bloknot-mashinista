from __future__ import annotations

import json
from pathlib import Path


def _write_json(path: Path, payload) -> None:
    temporary = path.with_name(path.name + ".tmp")
    temporary.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    temporary.replace(path)


def _public_config(config: dict) -> dict:
    result = {
        key: value
        for key, value in config.items()
        if key not in {"pdf", "compare_seed", "config_path"}
    }
    result["pdf_file_name"] = Path(config["pdf"]).name
    if config.get("compare_seed"):
        result["compare_seed_file_name"] = Path(config["compare_seed"]).name
    return result


def ensure_safe_output(output_dir: Path, repository_root: Path) -> Path:
    resolved = output_dir.resolve()
    product_dir = (repository_root / "assets" / "tracker" / "sections").resolve()
    try:
        resolved.relative_to(product_dir)
    except ValueError:
        pass
    else:
        raise ValueError(
            f"builder output cannot be inside product section directory: {resolved}"
        )
    resolved.mkdir(parents=True, exist_ok=True)
    return resolved


def _profile_gaps(elements: list[dict], range_start_m: int, range_end_m: int) -> list[dict]:
    gaps: list[dict] = []
    cursor = range_start_m
    for element in elements:
        start = int(element["start_m"])
        end = start + int(element["len_m"])
        if start > cursor:
            gaps.append({"start_m": cursor, "end_m": start})
        cursor = max(cursor, end)
    if cursor < range_end_m:
        gaps.append({"start_m": cursor, "end_m": range_end_m})
    return gaps


def _summary_markdown(result: dict) -> str:
    summary = result["summary"]
    config = result["config"]
    fingerprint = result["document"]["fingerprint"]
    confidence = summary.get("confidence") or {}
    lines = [
        f"# Regime profile builder: {config['id']}",
        "",
        f"- Source PDF: `{fingerprint['file_name']}`",
        f"- SHA-256: `{fingerprint['sha256']}`",
        f"- Pages: {result['document']['page_count']}",
        f"- Raw cells: {summary['raw_cells']}",
        f"- Logical elements: {summary['logical_elements']}",
        f"- Coverage: {summary['coverage_start_m']}..{summary['coverage_end_m']} m",
        f"- Review issues: {summary['review_issues']}",
        f"- Blocking issues: {summary['blocked_issues']}",
        f"- Profile SHA-256: `{summary['profile_sha256']}`",
        "",
        "## Confidence",
        "",
    ]
    for key, value in sorted(confidence.items()):
        lines.append(f"- `{key}`: {value}")
    lines.extend(["", "## Review queue", ""])
    if not result["issues"]:
        lines.append("No issues. Manual approval is still required before product integration.")
    for issue in result["issues"]:
        coordinate = issue.get("start_m") or issue.get("after_m") or "-"
        lines.append(
            f"- `{issue['issue_id']}` - {issue['severity']} - {issue['kind']} "
            f"(page {issue.get('page', '-')}, coordinate {coordinate})"
        )
    lines.extend(
        [
            "",
            "## Safety",
            "",
            "This run is a draft review artifact. The builder did not modify product section JSON files and never assigns product `verified` status.",
            "",
        ]
    )
    return "\n".join(lines)


def write_artifacts(
    result: dict,
    output_dir: Path,
    repository_root: Path,
    *,
    force: bool = False,
) -> dict:
    output = ensure_safe_output(output_dir, repository_root)
    config = result["config"]
    fingerprint = result["document"]["fingerprint"]
    known_outputs = [
        "run.json",
        "pages.json",
        "cells.json",
        "draft.profile.json",
        "review.json",
        "decisions.example.json",
        "summary.md",
    ]
    existing = [name for name in known_outputs if (output / name).exists()]
    if existing and not force:
        raise ValueError(
            f"builder run already exists in {output}; use --force to overwrite: {existing}"
        )
    run_payload = {
        "schema_version": "1.0",
        "builder_version": result["builder_version"],
        "config": _public_config(config),
        "source": {key: value for key, value in result["document"].items() if key != "path"},
        "summary": result["summary"],
    }
    pages_payload = {
        "inspection": result["inspection"],
        "diagnostics": result["page_diagnostics"],
        "calibration": result["calibration"],
    }
    draft_payload = {
        "schema_version": "1.0",
        "id": config["id"],
        "section_name": config.get("section_name") or config["id"],
        "source_pdf": fingerprint,
        "range": {
            "start_m": int(config["range_start_m"]),
            "end_m": int(config["range_end_m"]),
        },
        "elements": result["elements"],
        "profile_coverage": [
            {
                "start_m": result["summary"]["coverage_start_m"],
                "end_m": result["summary"]["coverage_end_m"],
            }
        ] if result["elements"] else [],
        "profile_gaps": _profile_gaps(
            result["elements"],
            int(config["range_start_m"]),
            int(config["range_end_m"]),
        ),
        "summary": result["summary"],
        "seed_comparison": result["seed_comparison"],
        "status": "builder_draft_needs_manual_approval",
    }
    review_payload = {
        "schema_version": "1.0",
        "pdf_sha256": fingerprint["sha256"],
        "issues": result["issues"],
        "counts": {
            "review": result["summary"]["review_issues"],
            "blocked": result["summary"]["blocked_issues"],
        },
    }
    decisions_payload = {
        "schema_version": "1.0",
        "pdf_sha256": fingerprint["sha256"],
        "decisions": [
            {
                "issue_id": issue["issue_id"],
                "action": (
                    "insert_gap_or_defer"
                    if str(issue.get("kind", "")).startswith("profile_")
                    else "accept_suggestion_or_set_grade_or_defer"
                ),
                "grade_permille": issue.get("suggested_grade"),
                "note": "",
            }
            for issue in result["issues"]
        ],
    }
    _write_json(output / "run.json", run_payload)
    _write_json(output / "pages.json", pages_payload)
    _write_json(output / "cells.json", result["profile_cells"])
    _write_json(output / "draft.profile.json", draft_payload)
    _write_json(output / "review.json", review_payload)
    _write_json(output / "decisions.example.json", decisions_payload)
    summary_path = output / "summary.md"
    summary_temporary = summary_path.with_name(summary_path.name + ".tmp")
    summary_temporary.write_text(_summary_markdown(result), encoding="utf-8")
    summary_temporary.replace(summary_path)
    return {
        "output_dir": str(output),
        "run": str(output / "run.json"),
        "draft": str(output / "draft.profile.json"),
        "review": str(output / "review.json"),
        "summary": str(output / "summary.md"),
    }


def _load_font(size: int):
    from PIL import ImageFont

    candidates = [
        Path("C:/Windows/Fonts/arial.ttf"),
        Path("C:/Windows/Fonts/segoeui.ttf"),
        Path("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"),
    ]
    for path in candidates:
        if path.is_file():
            return ImageFont.truetype(str(path), size=size)
    return ImageFont.load_default()


def render_review_bundle(result: dict, output_dir: Path) -> dict:
    issues = [
        issue
        for issue in result["issues"]
        if issue.get("page") and issue.get("crop_box")
    ]
    maximum = int(result["config"].get("max_review_crops", 40))
    issues = issues[:maximum]
    if not issues:
        return {"crops": [], "contact_sheet": None}

    import pdfplumber
    from PIL import Image, ImageDraw

    output = Path(output_dir).resolve()
    review_dir = output / "review"
    review_dir.mkdir(parents=True, exist_ok=True)
    dpi = int(result["config"].get("review_dpi", 220))
    scale = dpi / 72.0
    font = _load_font(17)
    crops: list[dict] = []
    rendered_pages: dict[int, Image.Image] = {}
    with pdfplumber.open(Path(result["config"]["pdf"])) as document:
        for order, issue in enumerate(issues, start=1):
            page_number = int(issue["page"])
            if page_number not in rendered_pages:
                rendered_pages[page_number] = document.pages[page_number - 1].to_image(
                    resolution=dpi,
                    antialias=True,
                ).original.convert("RGB")
            image = rendered_pages[page_number]
            x0, top, x1, bottom = [float(value) for value in issue["crop_box"]]
            box = (
                max(0, int(x0 * scale)),
                max(0, int(top * scale)),
                min(image.width, int(x1 * scale)),
                min(image.height, int(bottom * scale)),
            )
            crop = image.crop(box)
            label_height = 46
            card = Image.new("RGB", (crop.width, crop.height + label_height), "white")
            card.paste(crop, (0, label_height))
            draw = ImageDraw.Draw(card)
            label = (
                f"{issue['issue_id']}  "
                f"{issue.get('start_m', '')}-{issue.get('end_m', '')}  "
                f"{issue['kind']}"
            )
            draw.text((8, 11), label, fill="black", font=font)
            file_name = f"{order:03d}-{issue['issue_id']}.png"
            path = review_dir / file_name
            card.save(path, format="PNG")
            crops.append({"issue_id": issue["issue_id"], "path": str(path), "image": card})

    target_width = 760
    prepared: list[Image.Image] = []
    for item in crops:
        card = item["image"]
        if card.width > target_width:
            ratio = target_width / card.width
            card = card.resize(
                (target_width, max(1, int(card.height * ratio))),
                Image.Resampling.LANCZOS,
            )
        prepared.append(card)
    columns = 2 if len(prepared) > 1 else 1
    rows = (len(prepared) + columns - 1) // columns
    column_width = max(card.width for card in prepared) + 20
    row_height = max(card.height for card in prepared) + 20
    sheet = Image.new("RGB", (column_width * columns, row_height * rows), "#e8eaed")
    for index, card in enumerate(prepared):
        x = (index % columns) * column_width + 10
        y = (index // columns) * row_height + 10
        sheet.paste(card, (x, y))
    contact_path = review_dir / "contact-sheet.png"
    sheet.save(contact_path, format="PNG")
    return {
        "crops": [{key: value for key, value in item.items() if key != "image"} for item in crops],
        "contact_sheet": str(contact_path),
    }
