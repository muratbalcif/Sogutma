/** Client-side bank visual mapping — API has no logo URLs. */
export type BankBrand = {
  initials: string;
  bgClass: string;
  textClass: string;
};

const BRANDS: Array<{ match: RegExp; brand: Omit<BankBrand, "initials"> }> = [
  {
    match: /ziraat/i,
    brand: { bgClass: "bg-[#E30A17]", textClass: "text-white" },
  },
  {
    match: /garanti|bbva/i,
    brand: { bgClass: "bg-[#00ADEF]", textClass: "text-white" },
  },
  {
    match: /i[sş]\s*bank|işbank/i,
    brand: { bgClass: "bg-[#0033A0]", textClass: "text-white" },
  },
  {
    match: /yap[iı]\s*kredi|yapikredi/i,
    brand: { bgClass: "bg-[#004B93]", textClass: "text-white" },
  },
  {
    match: /akbank/i,
    brand: { bgClass: "bg-[#E10600]", textClass: "text-white" },
  },
  {
    match: /qnb|finansbank/i,
    brand: { bgClass: "bg-[#6C1D5F]", textClass: "text-white" },
  },
  {
    match: /vak[iı]f/i,
    brand: { bgClass: "bg-[#F7A600]", textClass: "text-slate-900" },
  },
  {
    match: /halk/i,
    brand: { bgClass: "bg-[#1B4F9C]", textClass: "text-white" },
  },
  {
    match: /deniz/i,
    brand: { bgClass: "bg-[#E31C23]", textClass: "text-white" },
  },
  {
    match: /ing/i,
    brand: { bgClass: "bg-[#FF6200]", textClass: "text-white" },
  },
];

export function bankInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

export function resolveBankBrand(bankName: string): BankBrand {
  const initials = bankInitials(bankName) || "?";
  const hit = BRANDS.find((b) => b.match.test(bankName));
  if (hit) {
    return { initials, ...hit.brand };
  }
  return {
    initials,
    bgClass: "bg-slate-100",
    textClass: "text-slate-700",
  };
}
