import { Suspense } from "react";
import LoginPageClient from "./login-client";

export default function LoginPage() {
  return (
    <Suspense fallback={<p>Yükleniyor…</p>}>
      <LoginPageClient />
    </Suspense>
  );
}
