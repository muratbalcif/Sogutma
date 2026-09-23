import { describe, expect, it } from "vitest";
import {
  amountsEqual,
  estimateCartTotal,
  formatTry,
  lineTotal,
  sumAmounts,
} from "./money";
import { createIdempotencyKey } from "./idempotency";
import { friendlyErrorMessage, ApiError } from "../api/http";
import { canUsePos } from "../api/permissions";
import { usePosStore } from "../store/pos-store";

describe("money utils", () => {
  it("formats TRY with thousand dots", () => {
    expect(formatTry("1250.5")).toBe("₺1.250,50");
  });

  it("computes line total without float drift", () => {
    expect(lineTotal("35.10", 3)).toBe("105.30");
  });

  it("sums and compares amounts", () => {
    expect(sumAmounts(["400", "300", "300"])).toBe("1000.00");
    expect(amountsEqual("1000", "1000.00")).toBe(true);
  });

  it("estimates cart total with discount", () => {
    expect(
      estimateCartTotal(
        [
          { unitPrice: "100", quantity: 2 },
          { unitPrice: "50", quantity: 1 },
        ],
        "20",
      ),
    ).toBe("230.00");
  });
});

describe("idempotency", () => {
  it("creates unique keys", () => {
    const a = createIdempotencyKey();
    const b = createIdempotencyKey();
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThan(8);
  });
});

describe("errors", () => {
  it("maps stock and credit limit errors", () => {
    expect(
      friendlyErrorMessage(new ApiError(409, "Insufficient stock", null)),
    ).toContain("stok");
    expect(
      friendlyErrorMessage(
        new ApiError(400, "Credit limit exceeded: balance 1 + order 2 > limit 1", null),
      ),
    ).toContain("kredi limiti");
    expect(
      friendlyErrorMessage(new ApiError(403, "Forbidden", null)),
    ).toContain("yetkiniz");
  });
});

describe("auth gates", () => {
  it("allows SUPER_ADMIN and POS_CASHIER", () => {
    expect(
      canUsePos({
        id: "1",
        email: "a",
        firstName: "A",
        lastName: "B",
        phone: null,
        userType: "INDIVIDUAL",
        status: "ACTIVE",
        roles: ["SUPER_ADMIN"],
        permissions: [],
      }),
    ).toBe(true);
    expect(
      canUsePos({
        id: "1",
        email: "a",
        firstName: "A",
        lastName: "B",
        phone: null,
        userType: "INDIVIDUAL",
        status: "ACTIVE",
        roles: ["POS_CASHIER"],
        permissions: ["pos.sell"],
      }),
    ).toBe(true);
    expect(
      canUsePos({
        id: "1",
        email: "a",
        firstName: "A",
        lastName: "B",
        phone: null,
        userType: "INDIVIDUAL",
        status: "ACTIVE",
        roles: [],
        permissions: [],
      }),
    ).toBe(false);
  });
});

describe("cart store", () => {
  it("adds product, increments, decrements, removes", () => {
    usePosStore.getState().resetSale();
    usePosStore.getState().addProduct({
      id: "p1",
      name: "Cola",
      sku: "C1",
      barcode: "869",
      vatRate: "20",
      unitPrice: "35.00",
      availableStock: 10,
    });
    expect(usePosStore.getState().cart).toHaveLength(1);
    usePosStore.getState().addProduct({
      id: "p1",
      name: "Cola",
      sku: "C1",
      barcode: "869",
      vatRate: "20",
      unitPrice: "35.00",
      availableStock: 10,
    });
    expect(usePosStore.getState().cart[0]!.quantity).toBe(2);
    usePosStore.getState().increment("p1");
    expect(usePosStore.getState().cart[0]!.quantity).toBe(3);
    usePosStore.getState().decrement("p1");
    expect(usePosStore.getState().cart[0]!.quantity).toBe(2);
    usePosStore.getState().removeLine("p1");
    expect(usePosStore.getState().cart).toHaveLength(0);
  });

  it("blocks empty estimated total as zero", () => {
    usePosStore.getState().resetSale();
    expect(usePosStore.getState().estimatedTotal()).toBe("0.00");
  });
});

describe("payment validation helpers", () => {
  it("split payment must equal total", () => {
    const total = "1000.00";
    const paid = sumAmounts(["400", "300", "300"]);
    expect(amountsEqual(paid, total)).toBe(true);
    expect(amountsEqual(sumAmounts(["400", "300"]), total)).toBe(false);
  });
});
