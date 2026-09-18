import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { bankTransferClaimUiState } from "./bank-transfer-claim.ts";

describe("bankTransferClaimUiState", () => {
  it("allows claim when unpaid and no pending notification", () => {
    assert.equal(
      bankTransferClaimUiState({
        paymentMethod: "BANK_TRANSFER",
        paymentStatus: "PENDING",
        remainingAmount: "1000.00",
        pendingBankTransferId: null,
      }),
      "can_claim",
    );
  });

  it("shows pending review when a PENDING claim exists", () => {
    assert.equal(
      bankTransferClaimUiState({
        paymentMethod: "BANK_TRANSFER",
        paymentStatus: "PARTIALLY_PAID",
        remainingAmount: "700.00",
        pendingBankTransferId: "n1",
      }),
      "pending_review",
    );
  });

  it("hides claim when remaining is zero or paid", () => {
    assert.equal(
      bankTransferClaimUiState({
        paymentMethod: "BANK_TRANSFER",
        paymentStatus: "PARTIALLY_PAID",
        remainingAmount: "0.00",
        pendingBankTransferId: null,
      }),
      "hidden",
    );
    assert.equal(
      bankTransferClaimUiState({
        paymentMethod: "BANK_TRANSFER",
        paymentStatus: "PAID",
        remainingAmount: "0.00",
        pendingBankTransferId: null,
      }),
      "hidden",
    );
  });
});
