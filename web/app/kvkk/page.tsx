import { LegalDocument } from "@/components/legal/legal-document";
import { legalService } from "@/services/legal.service";

export default async function KvkkPage() {
  const page = await legalService.get("kvkk");
  return <LegalDocument page={page} />;
}
