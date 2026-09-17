import { EmptyState } from "@/components/ui/empty-state";

export default function ForgotPasswordPage() {
  return (
    <EmptyState
      title="Şifre sıfırlama henüz aktif değil"
      description="Backend'de forgot-password uç noktası bulunmuyor. Destek ile iletişime geçin."
      actionHref="/login"
      actionLabel="Girişe dön"
    />
  );
}
