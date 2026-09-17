import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatMoney, shouldShowCompareAt } from "./money.ts";

describe("formatMoney", () => {
  it("formats TRY amounts for display", () => {
    const formatted = formatMoney("1250.50");
    assert.match(formatted, /1[.\u00a0]?250/);
    assert.match(formatted, /50/);
  });

  it("does not treat compare-at equal prices as discount", () => {
    assert.equal(shouldShowCompareAt("100", "100"), false);
    assert.equal(shouldShowCompareAt("90", "100"), true);
    assert.equal(shouldShowCompareAt("100", null), false);
  });
});
