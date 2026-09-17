export type CartSummary = {
  items: Array<{
    quantity: number;
    product?: { id: string };
  }>;
  summary: {
    total: string;
    currency: string;
  };
};

export function cartItemCount(cart: CartSummary | null | undefined): number {
  if (!cart?.items?.length) return 0;
  return cart.items.reduce((sum, item) => sum + (item.quantity || 0), 0);
}

export function formatCartTotal(cart: CartSummary | null | undefined): string | null {
  if (!cart?.summary?.total) return null;
  return `${cart.summary.total} ${cart.summary.currency}`;
}
