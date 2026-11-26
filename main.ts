// The World Today — 26 November 2026
// Entry point: validate poster.png and copy it byte-for-byte to the
// output directory as entry.png.
//
// Usage:  MAKEFUN_OUTPUT_DIR=/output node main.ts
// (MAKEFUN_OUTPUT_DIR defaults to /output when unset.)
//
// Node standard library only — no network, no clock, no randomness.

import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const MAX_BYTES = 1_048_576;
const EXPECTED_WIDTH = 1024;
const EXPECTED_HEIGHT = 1024;

// PNG signature: 89 50 4E 47 0D 0A 1A 0A
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
// IEND chunk tail: length 0, type "IEND", CRC AE 42 60 82
const IEND_TAIL = Buffer.from([
  0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
]);

function fail(message: string): never {
  console.error(`error: ${message}`);
  process.exit(1);
}

function main(): void {
  const here = dirname(fileURLToPath(import.meta.url));
  const sourcePath = join(here, "poster.png");

  if (!existsSync(sourcePath)) {
    fail(`poster.png not found next to main.ts (${sourcePath})`);
  }

  const png = readFileSync(sourcePath);

  // 1. Magic bytes: must be a PNG.
  if (png.length < PNG_MAGIC.length || !png.subarray(0, 8).equals(PNG_MAGIC)) {
    fail("poster.png is not a PNG file (bad magic bytes)");
  }

  // 2. Size cap: at most 1 MiB.
  if (png.length > MAX_BYTES) {
    fail(`poster.png is ${png.length} bytes, over the ${MAX_BYTES} byte cap`);
  }

  // 3. Dimensions from the IHDR chunk (width at bytes 16-19,
  //    height at bytes 20-23, big-endian uint32).
  if (png.length < 24 || png.toString("ascii", 12, 16) !== "IHDR") {
    fail("poster.png has no IHDR chunk where one was expected");
  }
  const width = png.readUInt32BE(16);
  const height = png.readUInt32BE(20);
  if (width !== EXPECTED_WIDTH || height !== EXPECTED_HEIGHT) {
    fail(
      `poster.png is ${width}x${height}, expected ${EXPECTED_WIDTH}x${EXPECTED_HEIGHT}`,
    );
  }

  // 4. Must end with the IEND chunk.
  if (png.length < IEND_TAIL.length || !png.subarray(-12).equals(IEND_TAIL)) {
    fail("poster.png does not end with an IEND chunk");
  }

  // 5. Copy byte-for-byte to the output directory as entry.png.
  const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? "/output";
  mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, "entry.png");
  copyFileSync(sourcePath, outPath);

  // 6. Verify the copy: same size and same sha256.
  const copied = readFileSync(outPath);
  const sourceHash = createHash("sha256").update(png).digest("hex");
  const copiedHash = createHash("sha256").update(copied).digest("hex");
  if (copied.length !== png.length || copiedHash !== sourceHash) {
    fail("entry.png does not match poster.png after copying");
  }

  console.log(
    `ok: poster.png ${width}x${height}, ${png.length} bytes, ` +
      `sha256 ${sourceHash} -> ${outPath}`,
  );
}

main();
