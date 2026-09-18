/**
 * Shared claim CTA state for bank-transfer "Ödemeyi Yaptım" UX.
 * API 409 remains the source of truth; this only drives UI.
 */
export type BankTransferClaimUiState =
  | "hidden"
  | "pending_review"
  | "can_claim";

export function bankTransferClaimUiState(input: {
  paymentMethod?: string | null;
  paymentStatus?: string | null;
  remainingAmount?: string | null;
  pendingBankTransferId?: string | null;
}): BankTransferClaimUiState {
  if (input.paymentMethod && input.paymentMethod !== "BANK_TRANSFER") {
    return "hidden";
  }
  if (
    input.paymentStatus !== "PENDING" &&
    input.paymentStatus !== "PARTIALLY_PAID"
  ) {
    return "hidden";
  }
  const remaining = Number(input.remainingAmount ?? "0");
  if (!Number.isFinite(remaining) || remaining <= 0) {
    return "hidden";
  }
  if (input.pendingBankTransferId) {
    return "pending_review";
  }
  return "can_claim";
}
