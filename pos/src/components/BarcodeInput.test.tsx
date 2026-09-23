import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BarcodeInput } from "./BarcodeInput";
import { createRef } from "react";

describe("BarcodeInput", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("submits on Enter", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    const ref = createRef<HTMLInputElement>();
    render(<BarcodeInput ref={ref} onSubmit={onSubmit} />);
    const input = screen.getByPlaceholderText(/Barkod okutun/);
    await user.type(input, "8691234567890{Enter}");
    expect(onSubmit).toHaveBeenCalledWith("8691234567890");
    expect((input as HTMLInputElement).value).toBe("");
  });
});
