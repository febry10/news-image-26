// "The World Today" — one-image summary of Thursday 26 November 2026.
// make.fun competition: news-image-20261126.
//
// poster.png is the entry: a broadsheet front page typeset in poster.html
// and rendered a single time with headless Chromium. This program guards
// it on the way out — it inspects the PNG's structure (signature, IHDR
// dimensions, closing IEND chunk, byte size), refuses to ship anything
// that fails an inspection, and otherwise copies the file unchanged to
// <output>/entry.png and re-reads the copy to prove the bytes survived.
// Standard library only; no network, clock or randomness, so repeated
// runs are byte-identical.

import { createHash } from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const LIMIT_BYTES = 1_048_576; // 1 MiB, the bounty's hard cap
const REQUIRED_SIDE = 1024; // the bounty asks for exactly 1024 x 1024

function digestHex(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function refuse(reason: string): never {
  console.error(`world-today-26: refusing to ship — ${reason}`);
  process.exit(1);
}

// The PNG header layout this relies on: bytes 0..7 are the signature,
// bytes 8..11 the first chunk's length, bytes 12..15 its type ("IHDR"),
// and bytes 16..23 the width and height as big-endian uint32 values.
function inspect(bytes: Buffer): void {
  const magic = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  const hasMagic =
    bytes.length >= magic.length && magic.every((b, i) => bytes[i] === b);
  if (!hasMagic) refuse("poster.png does not open with the PNG signature");

  if (bytes.length > LIMIT_BYTES) {
    refuse(`poster.png weighs ${bytes.length} bytes; the cap is ${LIMIT_BYTES}`);
  }

  if (bytes.length < 24 || bytes.toString("latin1", 12, 16) !== "IHDR") {
    refuse("poster.png has no IHDR chunk at the expected offset");
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const width = view.getUint32(16);
  const height = view.getUint32(20);
  if (width !== REQUIRED_SIDE || height !== REQUIRED_SIDE) {
    refuse(`poster.png measures ${width}x${height}, not ${REQUIRED_SIDE}x${REQUIRED_SIDE}`);
  }

  const tailType = bytes.toString("latin1", bytes.length - 8, bytes.length - 4);
  if (tailType !== "IEND") {
    refuse("poster.png does not close with an IEND chunk (truncated?)");
  }
}

function main(): void {
  const folder = path.dirname(fileURLToPath(import.meta.url));
  const posterPath = path.join(folder, "poster.png");
  if (!fs.existsSync(posterPath)) {
    refuse(`poster.png is missing next to main.ts (${posterPath})`);
  }

  const poster = fs.readFileSync(posterPath);
  inspect(poster);

  const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? "/output";
  fs.mkdirSync(outDir, { recursive: true });
  const entryPath = path.join(outDir, "entry.png");
  fs.writeFileSync(entryPath, poster);

  const shipped = fs.readFileSync(entryPath);
  if (shipped.length !== poster.length || digestHex(shipped) !== digestHex(poster)) {
    refuse("entry.png came out different from poster.png after copying");
  }

  console.log(
    `world-today-26: poster.png ok — ${poster.length} bytes, sha256 ${digestHex(poster)} -> ${entryPath}`,
  );
}

main();
