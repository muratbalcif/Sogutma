import { clientApiFetch } from "@/lib/api/client";

export const accountService = {
  current: () => clientApiFetch("/account/current"),
  transactions: () => clientApiFetch("/account/transactions"),
};
