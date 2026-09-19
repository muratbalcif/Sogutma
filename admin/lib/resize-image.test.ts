import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  computeTargetSize,
  scaleDownKeepingAspect,
} from "./resize-image.ts";

describe("computeTargetSize", () => {
  it("keeps size when within bounds", () => {
    assert.deepEqual(computeTargetSize(800, 600, 2048, 2048), {
      width: 800,
      height: 600,
    });
  });

  it("scales down to fit max edge", () => {
    assert.deepEqual(computeTargetSize(4000, 3000, 2048, 2048), {
      width: 2048,
      height: 1536,
    });
  });

  it("scales by the tighter dimension", () => {
    assert.deepEqual(computeTargetSize(3000, 1000, 1000, 2000), {
      width: 1000,
      height: 333,
    });
  });
});

describe("scaleDownKeepingAspect", () => {
  it("scales proportionally", () => {
    assert.deepEqual(scaleDownKeepingAspect(2000, 1000, 0.9, 1280), {
      width: 1800,
      height: 900,
    });
  });

  it("clamps to minEdge instead of going soft", () => {
    const next = scaleDownKeepingAspect(1300, 800, 0.5, 1280);
    assert.equal(Math.max(next.width, next.height), 1280);
    const ratio = next.width / next.height;
    const expected = 1300 / 800;
    assert.ok(Math.abs(ratio - expected) < 0.02);
  });
});
