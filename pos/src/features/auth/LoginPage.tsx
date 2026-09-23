import { FormEvent, useState } from "react";
import { login } from "../../api/auth";
import { friendlyErrorMessage } from "../../api/http";
import type { AuthUser } from "../../types/api";

export function LoginPage({
  onSuccess,
}: {
  onSuccess: (user: AuthUser) => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const result = await login(email.trim(), password);
      onSuccess(result.user);
    } catch (err) {
      setError(friendlyErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-full items-center justify-center bg-gradient-to-br from-[var(--primary-light)] via-[var(--bg)] to-slate-100 p-6">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-white p-8 shadow-lg"
      >
        <p className="text-sm font-semibold uppercase tracking-wide text-[var(--primary)]">
          FurkanSoğutma
        </p>
        <h1 className="mt-1 text-3xl font-bold text-[var(--text)]">POS Giriş</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Kasa personeli hesabı ile giriş yapın.
        </p>

        <label className="mt-6 block text-sm font-medium">
          E-posta
          <input
            className="mt-1 w-full rounded-xl border border-[var(--border)] px-4 py-3 text-base outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/20"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoFocus
          />
        </label>

        <label className="mt-4 block text-sm font-medium">
          Şifre
          <input
            className="mt-1 w-full rounded-xl border border-[var(--border)] px-4 py-3 text-base outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/20"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>

        {error ? (
          <p className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-[var(--error)]" role="alert">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={loading}
          className="mt-6 w-full rounded-xl bg-[var(--primary)] py-3.5 text-lg font-semibold text-white hover:bg-[var(--primary-dark)]"
        >
          {loading ? "Giriş yapılıyor…" : "Giriş"}
        </button>
      </form>
    </div>
  );
}
