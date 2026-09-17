import { LegalDocument } from "@/components/legal/legal-document";
import { legalService } from "@/services/legal.service";

export default async function PrivacyPage() {
  const page = await legalService.get("privacy");
  return <LegalDocument page={page} />;
}
