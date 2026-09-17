import { AccountNav } from "@/components/account/account-nav";

export default function AccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
      <AccountNav />
      <div>{children}</div>
    </div>
  );
}
