import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { AppShell } from "@/components/layout/app-shell";
import { Usuario } from "@/types/database";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Usamos admin client para bypassear RLS y evitar loops si la policy falla
  const admin = createAdminClient();
  const { data: usuario } = await admin
    .from("usuarios")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!usuario || !usuario.activo) redirect("/login");

  return <AppShell usuario={usuario as Usuario}>{children}</AppShell>;
}
