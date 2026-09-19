import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  API_MAX_UPLOAD_BYTES,
  WEBP_QUALITY_STEPS,
  computeTargetSize,
  formatByteSize,
  formatSizeReduction,
  shouldSkipOptimization,
  toWebpFilename,
} from "./resize-image.ts";

describe("computeTargetSize", () => {
  it("keeps size when within 1920 bounds", () => {
    assert.deepEqual(computeTargetSize(800, 600, 1920, 1920), {
      width: 800,
      height: 600,
    });
  });

  it("scales down images above 1920px keeping aspect ratio", () => {
    const next = computeTargetSize(4000, 3000, 1920, 1920);
    assert.equal(next.width, 1920);
    assert.equal(next.height, 1440);
    assert.ok(Math.abs(next.width / next.height - 4000 / 3000) < 0.01);
  });

  it("scales by the tighter dimension", () => {
    assert.deepEqual(computeTargetSize(3000, 1000, 1000, 2000), {
      width: 1000,
      height: 333,
    });
  });
});

describe("shouldSkipOptimization", () => {
  it("skips small JPEG/PNG/WebP within resolution", () => {
    assert.equal(
      shouldSkipOptimization({
        size: 1 * 1024 * 1024,
        type: "image/webp",
        width: 1200,
        height: 800,
      }),
      true,
    );
    assert.equal(
      shouldSkipOptimization({
        size: 500_000,
        type: "image/png",
        width: 800,
        height: 600,
      }),
      true,
    );
  });

  it("does not skip large JPEG", () => {
    assert.equal(
      shouldSkipOptimization({
        size: 8 * 1024 * 1024,
        type: "image/jpeg",
        width: 4000,
        height: 3000,
      }),
      false,
    );
  });

  it("does not skip WebP above max edge", () => {
    assert.equal(
      shouldSkipOptimization({
        size: 2 * 1024 * 1024,
        type: "image/webp",
        width: 3000,
        height: 2000,
      }),
      false,
    );
  });

  it("does not skip WebP over 5 MB", () => {
    assert.equal(
      shouldSkipOptimization({
        size: API_MAX_UPLOAD_BYTES + 1,
        type: "image/webp",
        width: 1000,
        height: 1000,
      }),
      false,
    );
  });
});

describe("webp naming and quality ladder", () => {
  it("builds .webp filename from original", () => {
    assert.equal(toWebpFilename("klima.JPG"), "klima.webp");
    assert.equal(toWebpFilename("photo.png"), "photo.webp");
  });

  it("uses finite quality steps starting at 0.85", () => {
    assert.deepEqual([...WEBP_QUALITY_STEPS], [0.85, 0.8, 0.75, 0.7, 0.65]);
  });

  it("formats size reduction for UI", () => {
    assert.equal(formatByteSize(1024), "1.0 KB");
    assert.match(formatSizeReduction(8.4 * 1024 * 1024, 1.8 * 1024 * 1024), /MB/);
  });
});
