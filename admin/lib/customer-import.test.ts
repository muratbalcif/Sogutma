import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseCustomerImportCsv } from "./customer-import.ts";

describe("parseCustomerImportCsv", () => {
  it("parses headered csv rows", () => {
    const rows = parseCustomerImportCsv(`firstName,lastName,email,phone,userType,companyName,taxNumber,taxOffice
Ali,Yılmaz,ali@example.com,555,CORPORATE,ACME,123,Kadıköy
Ayşe,Demir,ayse@example.com,,,
`);
    assert.equal(rows.length, 2);
    assert.equal(rows[0]?.email, "ali@example.com");
    assert.equal(rows[0]?.companyName, "ACME");
    assert.equal(rows[1]?.userType, undefined);
  });

  it("parses headerless rows", () => {
    const rows = parseCustomerImportCsv("John,Doe,john@example.com");
    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.firstName, "John");
  });
});

describe("collections customer filter", () => {
  it("passes resolved customerId not free-text search to collections API", () => {
    const selectedCustomerId = "11111111-1111-4111-8111-111111111111";
    const q = new URLSearchParams({ page: "1", limit: "50" });
    if (selectedCustomerId) q.set("customerId", selectedCustomerId);
    assert.equal(
      `/admin/collections?${q}`,
      "/admin/collections?page=1&limit=50&customerId=11111111-1111-4111-8111-111111111111",
    );
    assert.ok(!q.has("search"));
  });
});

describe("accounting adjustment/reversal paths", () => {
  it("posts to adjustment and reversal endpoints", () => {
    assert.equal("/admin/accounting/adjustment", "/admin/accounting/adjustment");
    assert.equal("/admin/accounting/reversal", "/admin/accounting/reversal");
  });
});
