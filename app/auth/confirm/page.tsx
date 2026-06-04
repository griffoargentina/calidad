"use client";

import { useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Loader2 } from "lucide-react";

function AuthConfirm() {
  const searchParams = useSearchParams();

  useEffect(() => {
    const next = searchParams.get("next") ?? "/dashboard";
    const supabase = createClient();
    const code       = searchParams.get("code");
    const token_hash = searchParams.get("token_hash");
    const type       = searchParams.get("type") ?? "recovery";

    async function handle() {
      // --- PKCE flow (code en query param) ---
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (!error) { window.location.href = next; return; }
      }

      // --- OTP / token_hash flow ---
      if (token_hash) {
        const { error } = await supabase.auth.verifyOtp({
          token_hash,
          type: type as "recovery" | "signup" | "invite" | "magiclink" | "email",
        });
        if (!error) { window.location.href = next; return; }
      }

      // --- Flujo implícito (tokens en hash fragment #access_token=...) ---
      // El cliente de Supabase los detecta automáticamente al inicializarse.
      // Esperamos el evento de autenticación.
      const { data: { subscription } } = supabase.auth.onAuthStateChange(
        (event, session) => {
          if ((event === "SIGNED_IN" || event === "PASSWORD_RECOVERY") && session) {
            subscription.unsubscribe();
            window.location.href = next;
          }
        }
      );

      // Verificar sesión ya establecida
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        subscription.unsubscribe();
        window.location.href = next;
        return;
      }

      // Timeout: si en 8s no hay sesión, el link es inválido
      setTimeout(() => {
        subscription.unsubscribe();
        window.location.href = "/login?error=link_invalido";
      }, 8000);
    }

    handle();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="text-center space-y-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
        <p className="text-sm text-muted-foreground">Verificando acceso...</p>
      </div>
    </div>
  );
}

export default function AuthConfirmPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      }
    >
      <AuthConfirm />
    </Suspense>
  );
}
