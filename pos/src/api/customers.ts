import { posRequest } from "./http";
import type { CustomerDetail, CustomerListItem, Paginated } from "../types/api";

export function searchCustomers(
  search: string,
  page = 1,
  limit = 20,
): Promise<Paginated<CustomerListItem>> {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });
  if (search.trim()) params.set("search", search.trim());
  return posRequest<Paginated<CustomerListItem>>(
    `/admin/customers?${params.toString()}`,
  );
}

export function getCustomerDetail(id: string): Promise<CustomerDetail> {
  return posRequest<CustomerDetail>(`/admin/customers/${id}`);
}
