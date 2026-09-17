import assert from "node:assert/strict";
import { describe, it } from "node:test";

function productPricesPath(productId: string) {
  return `/admin/pricing/products/${productId}`;
}

function customerPricesPath(customerId: string) {
  return `/admin/pricing/customers/${customerId}`;
}

function deactivateCustomerPricePath(priceId: string) {
  return `/admin/pricing/customer-prices/${priceId}`;
}

function relatedProductsPath(slug: string) {
  return `/products/${encodeURIComponent(slug)}/related`;
}

describe("admin pricing paths", () => {
  it("uses product and customer pricing endpoints", () => {
    assert.equal(
      productPricesPath("11111111-1111-4111-8111-111111111111"),
      "/admin/pricing/products/11111111-1111-4111-8111-111111111111",
    );
    assert.equal(
      customerPricesPath("22222222-2222-4222-8222-222222222222"),
      "/admin/pricing/customers/22222222-2222-4222-8222-222222222222",
    );
    assert.equal(
      deactivateCustomerPricePath("33333333-3333-4333-8333-333333333333"),
      "/admin/pricing/customer-prices/33333333-3333-4333-8333-333333333333",
    );
  });
});

describe("web related products path", () => {
  it("encodes slug for related endpoint", () => {
    assert.equal(
      relatedProductsPath("klima-a++"),
      "/products/klima-a%2B%2B/related",
    );
  });
});
