// news-image-20261126 — "The World Today, Thursday 26 November 2026".
//
// Entry program for the make.fun bounty "Sum up 26 November's world news in
// one image". The poster itself (poster.png, typeset in poster.html and
// rendered once with headless Chromium) is the deliverable; this program
// validates it rigorously and copies it, byte for byte, to
// <output>/entry.png. Standard library only: no network, no clock, no
// randomness — two runs always produce identical bytes.

import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const MAX_BYTES = 1_048_576; // 1 MiB hard cap from the bounty rules
const EXPECTED = 1024; // poster must be exactly 1024x1024

function fail(message: string): never {
  console.error(`news-image-26: ${message}`);
  process.exit(1);
}

const here = dirname(fileURLToPath(import.meta.url));
const sourcePath = join(here, "poster.png");
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? "/output";
const targetPath = join(outDir, "entry.png");

let png: Buffer;
try {
  png = readFileSync(sourcePath);
} catch {
  fail(`poster.png is missing next to main.ts (${sourcePath})`);
}

// --- structural validation of the PNG -------------------------------------
const MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
if (png.length < 8 || !MAGIC.every((b, i) => png[i] === b)) {
  fail("poster.png does not start with the PNG magic bytes");
}
if (png.length > MAX_BYTES) {
  fail(`poster.png is ${png.length} bytes, over the 1 MiB cap`);
}
// IHDR is the first chunk: width and height are big-endian uint32 at 16/20.
const width = png.readUInt32BE(16);
const height = png.readUInt32BE(20);
if (width !== EXPECTED || height !== EXPECTED) {
  fail(`poster.png is ${width}x${height}, expected ${EXPECTED}x${EXPECTED}`);
}
// A well-formed PNG ends with the IEND chunk (type bytes at length-8).
const tail = png.subarray(png.length - 8, png.length - 4).toString("latin1");
if (tail !== "IEND") {
  fail("poster.png does not end with an IEND chunk (truncated file?)");
}

// --- copy + verify ----------------------------------------------------------
mkdirSync(outDir, { recursive: true });
writeFileSync(targetPath, png);

const written = readFileSync(targetPath);
const digest = (buf: Buffer) => createHash("sha256").update(buf).digest("hex");
if (!written.equals(png) || digest(written) !== digest(png)) {
  fail("verification failed: entry.png differs from poster.png after copy");
}

console.log(
  `news-image-26: wrote ${targetPath} (${png.length} bytes, sha256 ${digest(png)})`,
);
