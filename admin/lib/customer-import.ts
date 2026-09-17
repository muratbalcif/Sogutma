/**
 * Parses customer import CSV lines.
 * Header optional. Columns:
 * firstName,lastName,email,phone,userType,companyName,taxNumber,taxOffice
 */
export function parseCustomerImportCsv(raw: string): Array<{
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  userType?: string;
  companyName?: string;
  taxNumber?: string;
  taxOffice?: string;
}> {
  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) return [];

  const split = (line: string) =>
    line.split(",").map((c) => c.trim().replace(/^"|"$/g, ""));

  let start = 0;
  const first = split(lines[0]!).map((c) => c.toLowerCase());
  if (first.includes("email") && first.includes("firstname")) {
    start = 1;
  }

  const rows: Array<{
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
    userType?: string;
    companyName?: string;
    taxNumber?: string;
    taxOffice?: string;
  }> = [];

  for (let i = start; i < lines.length; i++) {
    const cols = split(lines[i]!);
    const [firstName, lastName, email, phone, userType, companyName, taxNumber, taxOffice] =
      cols;
    if (!firstName || !lastName || !email) continue;
    rows.push({
      firstName,
      lastName,
      email,
      phone: phone || undefined,
      userType: userType || undefined,
      companyName: companyName || undefined,
      taxNumber: taxNumber || undefined,
      taxOffice: taxOffice || undefined,
    });
  }
  return rows;
}
