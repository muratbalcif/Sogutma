import { LegalDocument } from "@/components/legal/legal-document";
import { legalService } from "@/services/legal.service";

export default async function TermsPage() {
  const page = await legalService.get("terms");
  return <LegalDocument page={page} />;
}
