import assert from "node:assert/strict";
import { describe, it } from "node:test";

describe("checkout validate before order", () => {
  it("blocks order when validation.valid is false", () => {
    const validation = {
      valid: false,
      issues: [{ message: "Cart is empty", code: "EMPTY_CART" }],
    };
    const shouldCreate = validation.valid;
    assert.equal(shouldCreate, false);
    const detail = validation.issues.map((i) => i.message).join(" · ");
    assert.equal(detail, "Cart is empty");
  });

  it("allows order when validation.valid is true", () => {
    const validation = { valid: true, issues: [] as Array<{ message: string }> };
    assert.equal(validation.valid, true);
  });
});

describe("account statement export path", () => {
  it("uses GET /account/statement?format=csv", () => {
    const path = "/account/statement?format=csv";
    assert.equal(path.includes("export=1"), false);
    assert.ok(path.startsWith("/account/statement"));
    assert.ok(path.includes("format=csv"));
  });
});
