import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { bankInitials, resolveBankBrand } from "./bank-brand.ts";

describe("resolveBankBrand", () => {
  it("maps known banks to brand colors", () => {
    const ziraat = resolveBankBrand("Ziraat Bankası");
    assert.equal(ziraat.bgClass, "bg-[#E30A17]");
    assert.ok(ziraat.initials.length > 0);
  });

  it("falls back to slate initials for unknown banks", () => {
    const other = resolveBankBrand("Özel Banka");
    assert.equal(other.bgClass, "bg-slate-100");
    assert.equal(bankInitials("Özel Banka"), "ÖB");
  });
});
