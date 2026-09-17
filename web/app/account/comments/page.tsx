import { EmptyState } from "@/components/ui/empty-state";

export default function CommentsPage() {
  return (
    <div>
      <h1 className="mb-4 font-[family-name:var(--font-display)] text-3xl text-navy">
        Yorumlarım
      </h1>
      <EmptyState title="Henüz yorumunuz bulunmuyor." />
    </div>
  );
}
