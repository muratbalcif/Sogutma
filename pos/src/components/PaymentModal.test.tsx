import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PaymentModal } from "./PaymentModal";

describe("PaymentModal", () => {
  it("blocks ON_ACCOUNT without customer", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(
      <PaymentModal
        total="100.00"
        hasCustomer={false}
        submitting={false}
        onClose={() => undefined}
        onConfirm={onConfirm}
      />,
    );
    await user.click(screen.getByRole("button", { name: "VERESİYE" }));
    expect(screen.getByRole("alert")).toHaveTextContent(/müşteri/i);
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
