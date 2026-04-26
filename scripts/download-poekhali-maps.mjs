import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const BUCKET = 'durable-zoo-113815.appspot.com';
const PREFIX = 'ek_files/';
const API_KEY = process.env.POEKHALI_FIREBASE_API_KEY || '';
const ROOT = path.resolve('assets/tracker');
const ZIP_DIR = path.join(ROOT, 'map-zips');
const MAPS_DIR = path.join(ROOT, 'maps');
const MANIFEST_PATH = path.join(ROOT, 'maps-manifest.json');

function requireApiKey() {
  if (!API_KEY) {
    throw new Error('Set POEKHALI_FIREBASE_API_KEY from the APK Firebase config before running this script.');
  }
}

function readUInt32LE(buffer, offset) {
  return buffer.readUInt32LE(offset);
}

function findEndOfCentralDirectory(buffer) {
  for (let i = buffer.length - 22; i >= Math.max(0, buffer.length - 65558); i--) {
    if (readUInt32LE(buffer, i) === 0x06054b50) return i;
  }
  throw new Error('ZIP end-of-central-directory record not found');
}

function safeFileName(name) {
  return path.basename(name).replace(/[^A-Za-z0-9_.-]/g, '_');
}

function slugify(title, index) {
  const translit = {
    а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z',
    и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r',
    с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'ts', ч: 'ch', ш: 'sh',
    щ: 'sch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
  };
  const slug = title.toLowerCase()
    .replace(/[а-яё]/g, char => translit[char] || char)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return slug || `map-${index + 1}`;
}

function uniqueSlug(base, used) {
  let candidate = base;
  let suffix = 2;
  while (used.has(candidate)) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
  used.add(candidate);
  return candidate;
}

function extractXmlFromZip(zipPath, outputDir) {
  const buffer = fs.readFileSync(zipPath);
  const eocd = findEndOfCentralDirectory(buffer);
  const entryCount = buffer.readUInt16LE(eocd + 10);
  let ptr = readUInt32LE(buffer, eocd + 16);
  const files = [];

  fs.rmSync(outputDir, { recursive: true, force: true });
  fs.mkdirSync(outputDir, { recursive: true });

  for (let i = 0; i < entryCount; i++) {
    if (readUInt32LE(buffer, ptr) !== 0x02014b50) {
      throw new Error('Invalid ZIP central directory');
    }
    const method = buffer.readUInt16LE(ptr + 10);
    const compressedSize = readUInt32LE(buffer, ptr + 20);
    const uncompressedSize = readUInt32LE(buffer, ptr + 24);
    const nameLength = buffer.readUInt16LE(ptr + 28);
    const extraLength = buffer.readUInt16LE(ptr + 30);
    const commentLength = buffer.readUInt16LE(ptr + 32);
    const localHeaderOffset = readUInt32LE(buffer, ptr + 42);
    const entryName = buffer.slice(ptr + 46, ptr + 46 + nameLength).toString('utf8');

    if (/\.xml$/i.test(entryName) && !entryName.endsWith('/')) {
      if (readUInt32LE(buffer, localHeaderOffset) !== 0x04034b50) {
        throw new Error(`Invalid local ZIP header for ${entryName}`);
      }
      const localNameLength = buffer.readUInt16LE(localHeaderOffset + 26);
      const localExtraLength = buffer.readUInt16LE(localHeaderOffset + 28);
      const dataStart = localHeaderOffset + 30 + localNameLength + localExtraLength;
      const compressed = buffer.slice(dataStart, dataStart + compressedSize);
      let data;
      if (method === 0) {
        data = compressed;
      } else if (method === 8) {
        data = zlib.inflateRawSync(compressed);
      } else {
        throw new Error(`Unsupported ZIP method ${method} for ${entryName}`);
      }
      if (data.length !== uncompressedSize) {
        throw new Error(`Unpacked size mismatch for ${entryName}`);
      }
      const fileName = safeFileName(entryName);
      fs.writeFileSync(path.join(outputDir, fileName), data);
      files.push(fileName);
    }

    ptr += 46 + nameLength + extraLength + commentLength;
  }

  return files.sort();
}

function pickXml(files, name) {
  return files.find(file => file.toLowerCase() === name) || '';
}

async function fetchJson(url) {
  const response = await fetch(url);
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`${response.status} ${text.slice(0, 240).replace(/\s+/g, ' ')}`);
  }
  return JSON.parse(text);
}

async function fetchBuffer(url) {
  const response = await fetch(url);
  const body = Buffer.from(await response.arrayBuffer());
  if (!response.ok) {
    let message = body.toString('utf8').slice(0, 240).replace(/\s+/g, ' ');
    throw new Error(`${response.status} ${message}`);
  }
  return body;
}

function buildEmbeddedMap() {
  return {
    id: 'apk-embedded',
    title: 'Карта из APK',
    sourceName: 'assets/data.xml + assets/profile.xml',
    data: '/assets/tracker/data.xml',
    profile: '/assets/tracker/profile.xml',
    speed: '',
    files: ['/assets/tracker/data.xml', '/assets/tracker/profile.xml'],
    downloaded: true,
  };
}

async function main() {
  requireApiKey();
  fs.mkdirSync(ZIP_DIR, { recursive: true });
  fs.mkdirSync(MAPS_DIR, { recursive: true });

  const listUrl = `https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o?prefix=${encodeURIComponent(PREFIX)}&delimiter=%2F&key=${encodeURIComponent(API_KEY)}`;
  const listing = await fetchJson(listUrl);
  const items = (listing.items || []).filter(item => /\.zip$/i.test(item.name || ''));
  const usedSlugs = new Set();
  const maps = [buildEmbeddedMap()];
  const remote = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const title = path.basename(item.name, '.zip');
    const slug = uniqueSlug(slugify(title, i), usedSlugs);
    const zipName = `${slug}.zip`;
    const zipPath = path.join(ZIP_DIR, zipName);
    const mediaUrl = `https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o/${encodeURIComponent(item.name)}?alt=media&key=${encodeURIComponent(API_KEY)}`;
    const remoteItem = {
      id: slug,
      title,
      sourceName: item.name,
      zip: `/assets/tracker/map-zips/${zipName}`,
      downloaded: false,
    };

    try {
      const zip = await fetchBuffer(mediaUrl);
      fs.writeFileSync(zipPath, zip);
      const outputDir = path.join(MAPS_DIR, slug);
      const files = extractXmlFromZip(zipPath, outputDir);
      const data = pickXml(files, 'data.xml');
      const profile = pickXml(files, 'profile.xml');
      if (!data || !profile) {
        throw new Error(`ZIP does not contain data.xml/profile.xml: ${files.join(', ')}`);
      }
      Object.assign(remoteItem, {
        data: `/assets/tracker/maps/${slug}/${data}`,
        profile: `/assets/tracker/maps/${slug}/${profile}`,
        speed: pickXml(files, 'speed.xml') ? `/assets/tracker/maps/${slug}/${pickXml(files, 'speed.xml')}` : '',
        files: files.map(file => `/assets/tracker/maps/${slug}/${file}`),
        downloaded: true,
      });
      maps.push(remoteItem);
      console.log(`downloaded ${title}`);
    } catch (error) {
      remoteItem.downloadError = error && error.message ? error.message : 'download failed';
      console.log(`skipped ${title}: ${remoteItem.downloadError}`);
    }

    remote.push(remoteItem);
  }

  const manifest = {
    source: 'firebase-storage:ek_files',
    bucket: BUCKET,
    generatedAt: new Date().toISOString(),
    maps,
    remote,
  };
  fs.writeFileSync(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`wrote ${MANIFEST_PATH}`);
}

main().catch(error => {
  console.error(error && error.message ? error.message : error);
  process.exit(1);
});
