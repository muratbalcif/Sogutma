import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatMoney,
  shouldShowCompareAt,
  toApiMoneyAmount,
} from "./money.ts";

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

describe("toApiMoneyAmount", () => {
  it("accepts plain and tr-TR inputs", () => {
    assert.equal(toApiMoneyAmount("18000"), "18000.00");
    assert.equal(toApiMoneyAmount("18000.5"), "18000.50");
    assert.equal(toApiMoneyAmount("18.000,50"), "18000.50");
    assert.equal(toApiMoneyAmount("18.000"), "18000.00");
  });

  it("rejects empty, zero, and invalid values", () => {
    assert.equal(toApiMoneyAmount(""), null);
    assert.equal(toApiMoneyAmount("0"), null);
    assert.equal(toApiMoneyAmount("-1"), null);
    assert.equal(toApiMoneyAmount("abc"), null);
  });
});
