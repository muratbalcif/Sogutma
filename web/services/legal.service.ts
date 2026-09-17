import { serverApiFetch } from "@/lib/api/server";

export type LegalPage = {
  slug: string;
  title: string;
  body: string;
  version?: number;
  updatedAt: string;
};

export const legalService = {
  get: (slug: string) =>
    serverApiFetch<LegalPage>(`/site/legal/${encodeURIComponent(slug)}`),
  list: () => serverApiFetch<LegalPage[]>("/site/legal"),
};
