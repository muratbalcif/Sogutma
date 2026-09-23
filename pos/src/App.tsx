import { useEffect, useState } from "react";
import { canUsePos, fetchMe, logout as apiLogout } from "./api/auth";
import { authStorage } from "./api/client";
import type { AuthUser } from "./types/api";
import { LoginPage } from "./features/auth/LoginPage";
import { RegisterSelectPage } from "./features/pos/RegisterSelectPage";
import { PosPage } from "./features/pos/PosPage";
import { usePosStore } from "./store/pos-store";

type Screen = "loading" | "login" | "register" | "pos" | "forbidden";

export function App() {
  const [screen, setScreen] = useState<Screen>("loading");
  const [user, setUser] = useState<AuthUser | null>(null);
  const registerId = usePosStore((s) => s.registerId);
  const setRegister = usePosStore((s) => s.setRegister);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const token = authStorage.getAccessToken();
      const cached = authStorage.getUser();
      if (!token || !cached) {
        if (!cancelled) setScreen("login");
        return;
      }
      try {
        const me = await fetchMe();
        if (cancelled) return;
        authStorage.setSession(
          authStorage.getAccessToken()!,
          authStorage.getRefreshToken()!,
          me,
        );
        setUser(me);
        if (!canUsePos(me)) {
          setScreen("forbidden");
          return;
        }
        setScreen(registerId ? "pos" : "register");
      } catch {
        authStorage.clear();
        if (!cancelled) setScreen("login");
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- boot once
  }, []);

  async function handleLogout() {
    await apiLogout();
    setUser(null);
    usePosStore.getState().resetSale();
    usePosStore.setState({ registerId: null, registerLabel: null });
    setScreen("login");
  }

  if (screen === "loading") {
    return (
      <div className="flex h-full items-center justify-center text-slate-500">
        Yükleniyor…
      </div>
    );
  }

  if (screen === "login") {
    return (
      <LoginPage
        onSuccess={(u) => {
          setUser(u);
          if (!canUsePos(u)) {
            setScreen("forbidden");
            return;
          }
          setScreen("register");
        }}
      />
    );
  }

  if (screen === "forbidden") {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 p-8">
        <h1 className="text-2xl font-bold text-[var(--error)]">Yetkisiz</h1>
        <p className="text-slate-600">
          POS için SUPER_ADMIN, POS_CASHIER veya pos.sell yetkisi gerekli.
        </p>
        <button
          type="button"
          className="rounded-xl bg-[var(--primary)] px-6 py-3 font-semibold text-white"
          onClick={() => void handleLogout()}
        >
          Çıkış
        </button>
      </div>
    );
  }

  if (screen === "register") {
    return (
      <RegisterSelectPage
        user={user!}
        onSelected={(reg) => {
          setRegister(reg.id, `${reg.name} (${reg.code})`);
          setScreen("pos");
        }}
        onLogout={() => void handleLogout()}
      />
    );
  }

  return (
    <PosPage user={user!} onLogout={() => void handleLogout()} />
  );
}
