import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getResend } from "@/lib/email/resend";

export const dynamic = "force-dynamic";

const TO = ["calidad@griffo.com.ar", "dgriffo@griffo.com.ar"];
const CC = ["javier@griffo.com.ar"];

function formatDate(d: string | null) {
  if (!d) return "—";
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

function buildHtml(
  por_vencer_30: Array<{ nombre: string; ubicacion_nombre: string; fecha_vencimiento: string; dias_hasta_vencimiento: number }>,
  por_vencer_7: Array<{ nombre: string; ubicacion_nombre: string; fecha_vencimiento: string; dias_hasta_vencimiento: number }>,
  vencidos: Array<{ nombre: string; ubicacion_nombre: string; fecha_vencimiento: string; dias_vencido: number }>,
): string {
  const rows = (items: typeof por_vencer_30, color: string) =>
    items.map((i) => `
      <tr>
        <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9">${i.nombre}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#64748b">${i.ubicacion_nombre}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;font-weight:600;color:${color}">${formatDate(i.fecha_vencimiento)}</td>
      </tr>`).join("");

  const vencidosRows = vencidos.map((i) => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9">${i.nombre}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#64748b">${i.ubicacion_nombre}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;font-weight:600;color:#dc2626">${formatDate(i.fecha_vencimiento)} (${i.dias_vencido}d)</td>
    </tr>`).join("");

  const section = (title: string, color: string, bodyRows: string) =>
    bodyRows ? `
      <h3 style="color:${color};margin:24px 0 8px">${title}</h3>
      <table style="width:100%;border-collapse:collapse;font-size:14px">
        <thead><tr style="background:#f8fafc">
          <th style="padding:8px 12px;text-align:left;font-weight:600;border-bottom:2px solid #e2e8f0">Requisito</th>
          <th style="padding:8px 12px;text-align:left;font-weight:600;border-bottom:2px solid #e2e8f0">Ubicación</th>
          <th style="padding:8px 12px;text-align:left;font-weight:600;border-bottom:2px solid #e2e8f0">Vencimiento</th>
        </tr></thead>
        <tbody>${bodyRows}</tbody>
      </table>` : "";

  return `<!DOCTYPE html><html><body style="font-family:sans-serif;color:#1e293b;max-width:640px;margin:0 auto;padding:24px">
    <h2 style="color:#1e293b">Alerta SEH — Vencimientos</h2>
    <p style="color:#64748b">Resumen de requisitos de Seguridad e Higiene / Medio Ambiente que requieren atención.</p>
    ${section("🔴 Vencidos", "#dc2626", vencidosRows)}
    ${section("🟠 Próximos a vencer (7 días)", "#ea580c", rows(por_vencer_7, "#ea580c"))}
    ${section("🟡 Próximos a vencer (30 días)", "#d97706", rows(por_vencer_30.filter(i => i.dias_hasta_vencimiento > 7), "#d97706"))}
    <hr style="margin:32px 0;border:none;border-top:1px solid #e2e8f0">
    <p style="color:#94a3b8;font-size:12px">Sistema de Calidad — Griffo S.R.L.</p>
  </body></html>`;
}

// GET — called by Vercel cron
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("Authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  return runAlerta();
}

// POST — manual trigger (admin only)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function POST(_req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const admin = createAdminClient();
  const { data: usuario } = await admin.from("usuarios").select("rol").eq("id", user.id).single();
  if (usuario?.rol !== "admin") return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

  return runAlerta();
}

async function runAlerta() {
  const admin = createAdminClient();
  const hoy = new Date().toISOString().split("T")[0];
  const en30 = new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0];

  const { data: items } = await admin
    .from("seh_v_estado")
    .select("nombre, ubicacion_nombre, fecha_vencimiento, dias_vencido, dias_hasta_vencimiento, estado, ambito, activo")
    .eq("activo", true)
    .neq("estado", "no_corresponde")
    .neq("estado", "completado");

  if (!items || items.length === 0) {
    return NextResponse.json({ ok: true, message: "Sin alertas" });
  }

  const vencidos = items
    .filter((i) => i.estado === "vencido")
    .sort((a, b) => (b.dias_vencido ?? 0) - (a.dias_vencido ?? 0)) as Array<{
      nombre: string; ubicacion_nombre: string; fecha_vencimiento: string; dias_vencido: number;
    }>;

  const por_vencer_7 = items
    .filter((i) => i.estado === "proximo_a_vencer" && (i.dias_hasta_vencimiento ?? 999) <= 7)
    .sort((a, b) => (a.dias_hasta_vencimiento ?? 999) - (b.dias_hasta_vencimiento ?? 999)) as Array<{
      nombre: string; ubicacion_nombre: string; fecha_vencimiento: string; dias_hasta_vencimiento: number;
    }>;

  const por_vencer_30 = items
    .filter((i) => i.estado === "proximo_a_vencer")
    .sort((a, b) => (a.dias_hasta_vencimiento ?? 999) - (b.dias_hasta_vencimiento ?? 999)) as Array<{
      nombre: string; ubicacion_nombre: string; fecha_vencimiento: string; dias_hasta_vencimiento: number;
    }>;

  if (vencidos.length === 0 && por_vencer_30.length === 0) {
    return NextResponse.json({ ok: true, message: "Sin alertas" });
  }

  const subject = vencidos.length > 0
    ? `⚠️ SEH: ${vencidos.length} requisito(s) vencido(s)`
    : `📅 SEH: ${por_vencer_30.length} requisito(s) por vencer`;

  const resend = getResend();
  const { error } = await resend.emails.send({
    from: "calidad@griffo.com.ar",
    to: TO,
    cc: CC,
    subject,
    html: buildHtml(por_vencer_30, por_vencer_7, vencidos),
  });

  if (error) return NextResponse.json({ error }, { status: 500 });

  void hoy; void en30;
  return NextResponse.json({ ok: true, vencidos: vencidos.length, por_vencer: por_vencer_30.length });
}
