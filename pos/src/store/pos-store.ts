import { create } from "zustand";
import type { PosPaymentMethod, PosProductLookup } from "../types/api";
import { estimateCartTotal, lineTotal, money } from "../utils/money";

export interface CartLine {
  productId: string;
  name: string;
  sku: string;
  barcode: string | null;
  unitPrice: string;
  quantity: number;
  lineDiscount: string;
  availableStock: number;
}

export interface SelectedCustomer {
  id: string;
  name: string;
  phone: string | null;
  balance: string;
  creditLimit: string | null;
  allowCredit: boolean;
}

export interface PaymentDraft {
  method: PosPaymentMethod;
  amount: string;
}

interface PosState {
  registerId: string | null;
  registerLabel: string | null;
  cart: CartLine[];
  selectedLineId: string | null;
  customer: SelectedCustomer | null;
  cartDiscountAmount: string;
  cartDiscountPercent: string;
  payments: PaymentDraft[];
  addProduct: (product: PosProductLookup) => void;
  setQuantity: (productId: string, quantity: number) => void;
  increment: (productId: string) => void;
  decrement: (productId: string) => void;
  removeLine: (productId: string) => void;
  selectLine: (productId: string | null) => void;
  setCustomer: (customer: SelectedCustomer | null) => void;
  setRegister: (id: string, label: string) => void;
  setCartDiscountAmount: (amount: string) => void;
  setCartDiscountPercent: (percent: string) => void;
  setPayments: (payments: PaymentDraft[]) => void;
  clearCart: () => void;
  resetSale: () => void;
  estimatedTotal: () => string;
}

export const usePosStore = create<PosState>((set, get) => ({
  registerId: null,
  registerLabel: null,
  cart: [],
  selectedLineId: null,
  customer: null,
  cartDiscountAmount: "0",
  cartDiscountPercent: "0",
  payments: [],

  addProduct: (product) => {
    if (!product.unitPrice) return;
    set((state) => {
      const existing = state.cart.find((c) => c.productId === product.id);
      if (existing) {
        return {
          cart: state.cart.map((c) =>
            c.productId === product.id
              ? { ...c, quantity: c.quantity + 1 }
              : c,
          ),
          selectedLineId: product.id,
        };
      }
      return {
        cart: [
          ...state.cart,
          {
            productId: product.id,
            name: product.name,
            sku: product.sku,
            barcode: product.barcode,
            unitPrice: product.unitPrice!,
            quantity: 1,
            lineDiscount: "0",
            availableStock: product.availableStock,
          },
        ],
        selectedLineId: product.id,
      };
    });
  },

  setQuantity: (productId, quantity) => {
    const q = Math.max(1, Math.floor(quantity));
    set((state) => ({
      cart: state.cart.map((c) =>
        c.productId === productId ? { ...c, quantity: q } : c,
      ),
    }));
  },

  increment: (productId) => {
    set((state) => ({
      cart: state.cart.map((c) =>
        c.productId === productId ? { ...c, quantity: c.quantity + 1 } : c,
      ),
    }));
  },

  decrement: (productId) => {
    set((state) => ({
      cart: state.cart
        .map((c) =>
          c.productId === productId
            ? { ...c, quantity: Math.max(1, c.quantity - 1) }
            : c,
        )
        .filter((c) => c.quantity > 0),
    }));
  },

  removeLine: (productId) => {
    set((state) => ({
      cart: state.cart.filter((c) => c.productId !== productId),
      selectedLineId:
        state.selectedLineId === productId ? null : state.selectedLineId,
    }));
  },

  selectLine: (productId) => set({ selectedLineId: productId }),

  setCustomer: (customer) => set({ customer }),

  setRegister: (id, label) => set({ registerId: id, registerLabel: label }),

  setCartDiscountAmount: (amount) => {
    const cleaned = money(amount || 0).toFixed(2);
    set({ cartDiscountAmount: cleaned, cartDiscountPercent: "0" });
  },

  setCartDiscountPercent: (percent) => {
    set({ cartDiscountPercent: String(percent || 0), cartDiscountAmount: "0" });
  },

  setPayments: (payments) => set({ payments }),

  clearCart: () =>
    set({
      cart: [],
      selectedLineId: null,
      cartDiscountAmount: "0",
      cartDiscountPercent: "0",
      payments: [],
    }),

  resetSale: () =>
    set({
      cart: [],
      selectedLineId: null,
      customer: null,
      cartDiscountAmount: "0",
      cartDiscountPercent: "0",
      payments: [],
    }),

  estimatedTotal: () => {
    const state = get();
    let discount = state.cartDiscountAmount;
    if (money(state.cartDiscountPercent).greaterThan(0)) {
      const gross = state.cart.reduce(
        (acc, line) =>
          acc.add(money(lineTotal(line.unitPrice, line.quantity))),
        money(0),
      );
      discount = gross
        .mul(state.cartDiscountPercent)
        .div(100)
        .toFixed(2);
    }
    return estimateCartTotal(
      state.cart.map((c) => ({
        unitPrice: c.unitPrice,
        quantity: c.quantity,
        lineDiscount: c.lineDiscount,
      })),
      discount,
    );
  },
}));
