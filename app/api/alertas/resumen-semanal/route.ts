import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resend } from "@/lib/email/resend";
import {
  resumenSemanalHtml,
  resumenSemanalText,
  ItemVencido,
  ItemProximo,
  IndicadorSinDatos,
} from "@/lib/email/resumen-semanal";

// ── Destinatarios fijos ────────────────────────────────────────────────────
const TO = ["calidad@griffo.com.ar", "dgriffo@griffo.com.ar"];
const CC = ["javier@griffo.com.ar"];
const FROM = "Sistema de Calidad <calidad@griffo.com.ar>";
const PANEL_URL = "https://calidad.griffo.com.ar";

// ── Helpers ────────────────────────────────────────────────────────────────
function isAuthorized(req: NextRequest): boolean {
  const auth = req.headers.get("authorization") ?? "";
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return auth === `Bearer ${secret}`;
}

function diasDesdeHoy(fechaStr: string): number {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const fecha = new Date(fechaStr + "T00:00:00");
  return Math.floor((hoy.getTime() - fecha.getTime()) / 86400000);
}

function diasHastaVencimiento(fechaStr: string): number {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const fecha = new Date(fechaStr + "T00:00:00");
  return Math.floor((fecha.getTime() - hoy.getTime()) / 86400000);
}

function formatFecha(date: Date): string {
  return date.toLocaleDateString("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatMes(date: Date): string {
  return date.toLocaleDateString("es-AR", { month: "long", year: "numeric" });
}

// ── Lógica principal ───────────────────────────────────────────────────────
async function enviarResumen() {
  const admin = createAdminClient();
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const hoyStr = hoy.toISOString().split("T")[0];

  // Ventana: próximos 30 días
  const en30 = new Date(hoy);
  en30.setDate(en30.getDate() + 30);
  const en30Str = en30.toISOString().split("T")[0];

  // Mes anterior para indicadores (si estamos en los primeros 7 días, usamos mes anterior)
  const diaDelMes = hoy.getDate();
  const mesRef =
    diaDelMes <= 7
      ? new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1)
      : new Date(hoy.getFullYear(), hoy.getMonth(), 1);
  const anioRef = mesRef.getFullYear();
  const mesNumRef = mesRef.getMonth() + 1; // 1-12

  // ── 1. Documentos vencidos ─────────────────────────────────────────────
  const { data: itemsVencidos } = await admin
    .from("items")
    .select("id, codigo, titulo, fecha_vencimiento, responsable:usuarios!responsable_id(nombre), area:areas!area_id(nombre)")
    .eq("estado", "vencido")
    .eq("es_borrador", false)
    .order("fecha_vencimiento", { ascending: true });

  // ── 2. Documentos próximos a vencer ───────────────────────────────────
  const { data: itemsProximos } = await admin
    .from("items")
    .select("id, codigo, titulo, fecha_vencimiento, responsable:usuarios!responsable_id(nombre), area:areas!area_id(nombre)")
    .in("estado", ["por_vencer", "vigente"])
    .not("fecha_vencimiento", "is", null)
    .lte("fecha_vencimiento", en30Str)
    .gte("fecha_vencimiento", hoyStr)
    .eq("es_borrador", false)
    .order("fecha_vencimiento", { ascending: true });

  // ── 3. Calibraciones vencidas ─────────────────────────────────────────
  // Traemos todos los equipos activos con su última calibración
  const { data: equipos } = await admin
    .from("equipos_calibracion")
    .select("id, nombre, codigo, lugar_uso")
    .eq("activo", true);

  const equipoIds = (equipos ?? []).map((e: { id: string }) => e.id);
  const ultimasCalibraciones: Record<string, { fecha_vencimiento: string }> = {};

  if (equipoIds.length > 0) {
    const { data: calibraciones } = await admin
      .from("calibraciones")
      .select("equipo_id, fecha_vencimiento")
      .in("equipo_id", equipoIds)
      .order("fecha_calibracion", { ascending: false });

    for (const c of calibraciones ?? []) {
      const cal = c as { equipo_id: string; fecha_vencimiento: string };
      if (!ultimasCalibraciones[cal.equipo_id]) {
        ultimasCalibraciones[cal.equipo_id] = { fecha_vencimiento: cal.fecha_vencimiento };
      }
    }
  }

  const calVencidas: ItemVencido[] = [];
  const calProximas: ItemProximo[] = [];

  for (const equipo of equipos ?? []) {
    const eq = equipo as { id: string; nombre: string; codigo: string | null; lugar_uso: string | null };
    const ultima = ultimasCalibraciones[eq.id];
    if (!ultima?.fecha_vencimiento) continue;

    const dias = diasDesdeHoy(ultima.fecha_vencimiento);
    if (dias > 0) {
      calVencidas.push({
        tipo: "cal",
        codigo: eq.codigo,
        nombre: eq.nombre,
        area: eq.lugar_uso,
        responsable: null,
        diasVencido: dias,
      });
    } else {
      const restantes = -dias;
      if (restantes <= 30) {
        calProximas.push({
          tipo: "cal",
          codigo: eq.codigo,
          nombre: eq.nombre,
          area: eq.lugar_uso,
          responsable: null,
          diasRestantes: restantes,
        });
      }
    }
  }

  // ── 4. Auditorías vencidas y próximas ─────────────────────────────────
  const { data: auditoriasData } = await admin
    .from("auditorias")
    .select("id, titulo, fecha_vencimiento, estado, responsable:usuarios!responsable_id(nombre), areas(nombre)")
    .neq("estado", "completada")
    .not("fecha_vencimiento", "is", null)
    .lte("fecha_vencimiento", en30Str)
    .order("fecha_vencimiento", { ascending: true });

  const audVencidas: ItemVencido[] = [];
  const audProximas: ItemProximo[] = [];

  for (const aud of auditoriasData ?? []) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const a = aud as any;
    const dias = diasDesdeHoy(a.fecha_vencimiento);
    const area = (a.areas as { nombre: string } | null)?.nombre ?? null;
    const responsable = (a.responsable as { nombre: string } | null)?.nombre ?? null;

    if (dias > 0) {
      audVencidas.push({
        tipo: "aud",
        nombre: a.titulo,
        area,
        responsable,
        diasVencido: dias,
      });
    } else {
      audProximas.push({
        tipo: "aud",
        nombre: a.titulo,
        area,
        responsable,
        diasRestantes: -dias,
      });
    }
  }

  // ── 5. Indicadores sin datos ───────────────────────────────────────────
  const { data: todosIndicadores } = await admin
    .from("indicadores")
    .select("id, nombre, sector, responsable:usuarios!responsable_id(nombre)")
    .eq("activo", true)
    .neq("frecuencia", "anual");

  const indIds = (todosIndicadores ?? []).map((i: { id: string }) => i.id);
  const indicadoresSinDatos: IndicadorSinDatos[] = [];

  if (indIds.length > 0) {
    const { data: registros } = await admin
      .from("indicador_registros")
      .select("indicador_id")
      .in("indicador_id", indIds)
      .eq("anio", anioRef)
      .eq("mes", mesNumRef);

    const conDatos = new Set((registros ?? []).map((r: { indicador_id: string }) => r.indicador_id));

    for (const ind of todosIndicadores ?? []) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const i = ind as any;
      if (!conDatos.has(i.id)) {
        indicadoresSinDatos.push({
          nombre: i.nombre,
          responsable: (i.responsable as { nombre: string } | null)?.nombre ?? null,
          sector: i.sector ?? null,
        });
      }
    }
  }

  // ── 6. Ensamblar listas ────────────────────────────────────────────────
  const vencidos: ItemVencido[] = [
    ...(itemsVencidos ?? []).map((item) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const i = item as any;
      return {
        tipo: "doc" as const,
        codigo: i.codigo,
        nombre: i.titulo,
        area: (i.area as { nombre: string } | null)?.nombre ?? null,
        responsable: (i.responsable as { nombre: string } | null)?.nombre ?? null,
        diasVencido: diasDesdeHoy(i.fecha_vencimiento),
      };
    }),
    ...calVencidas,
    ...audVencidas,
  ].sort((a, b) => b.diasVencido - a.diasVencido);

  const proximos: ItemProximo[] = [
    ...(itemsProximos ?? []).map((item) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const i = item as any;
      return {
        tipo: "doc" as const,
        codigo: i.codigo,
        nombre: i.titulo,
        area: (i.area as { nombre: string } | null)?.nombre ?? null,
        responsable: (i.responsable as { nombre: string } | null)?.nombre ?? null,
        diasRestantes: diasHastaVencimiento(i.fecha_vencimiento),
      };
    }),
    ...calProximas,
    ...audProximas,
  ].sort((a, b) => a.diasRestantes - b.diasRestantes);

  // ── 7. Total "al día" ──────────────────────────────────────────────────
  const { count: totalItems } = await admin
    .from("items")
    .select("id", { count: "exact", head: true })
    .eq("es_borrador", false)
    .eq("estado", "vigente");

  const totalAlDia = (totalItems ?? 0);

  // ── 8. Verificar deduplicación semanal ────────────────────────────────
  const inicioDeSemana = new Date(hoy);
  inicioDeSemana.setDate(hoy.getDate() - hoy.getDay()); // domingo
  const inicioDeSemanaStr = inicioDeSemana.toISOString();

  const { data: yaEnviado } = await admin
    .from("notificaciones")
    .select("id")
    .eq("tipo", "resumen_semanal")
    .gte("enviada_at", inicioDeSemanaStr)
    .limit(1);

  if (yaEnviado && yaEnviado.length > 0) {
    return { ok: true, message: "Ya se envió el resumen esta semana" };
  }

  // ── 9. Construir y enviar email ────────────────────────────────────────
  const fechaLabel = formatFecha(hoy);
  const mesLabel = formatMes(mesRef);

  const htmlContent = resumenSemanalHtml({
    vencidos,
    proximos,
    indicadoresSinDatos,
    totalAlDia,
    mes: mesLabel,
    fecha: fechaLabel,
    panelUrl: PANEL_URL,
  });

  const textContent = resumenSemanalText({
    vencidos,
    proximos,
    indicadoresSinDatos,
    totalAlDia,
    mes: mesLabel,
    fecha: fechaLabel,
    panelUrl: PANEL_URL,
  });

  const totalProblemas = vencidos.length + indicadoresSinDatos.length;
  const asunto =
    totalProblemas > 0
      ? `[Calidad] Resumen semanal — ${totalProblemas} ítem${totalProblemas === 1 ? "" : "s"} requieren atención`
      : "[Calidad] Resumen semanal — Todo al día";

  const { error: sendError } = await resend.emails.send({
    from: FROM,
    to: TO,
    cc: CC,
    subject: asunto,
    html: htmlContent,
    text: textContent,
  });

  if (sendError) {
    console.error("Error enviando resumen semanal:", sendError);
    return { ok: false, error: sendError.message };
  }

  // ── 10. Registrar en notificaciones ────────────────────────────────────
  // Usamos el primer destinatario como referencia (sin item_id para el resumen)
  await admin.from("notificaciones").insert({
    tipo: "resumen_semanal",
    destinatario_id: null, // resumen global, sin destinatario individual
    estado: "enviada",
    enviada_at: new Date().toISOString(),
  });

  return {
    ok: true,
    message: "Resumen semanal enviado",
    stats: {
      vencidos: vencidos.length,
      proximos: proximos.length,
      indicadoresSinDatos: indicadoresSinDatos.length,
      totalAlDia,
    },
  };
}

// ── GET — invocado por Vercel cron ─────────────────────────────────────────
export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const result = await enviarResumen();
    return NextResponse.json(result);
  } catch (err) {
    console.error("Error en resumen semanal:", err);
    return NextResponse.json(
      { error: "Error interno", detail: String(err) },
      { status: 500 }
    );
  }
}

// ── POST — disparo manual desde el panel (solo admin) ─────────────────────
export async function POST(_req: NextRequest) {
  const admin = createAdminClient();
  // Verificar sesión de usuario admin
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: usuario } = await admin
    .from("usuarios")
    .select("rol")
    .eq("id", user.id)
    .single();

  if (usuario?.rol !== "admin") {
    return NextResponse.json({ error: "Solo admin puede disparar el resumen manualmente" }, { status: 403 });
  }

  try {
    const result = await enviarResumen();
    return NextResponse.json(result);
  } catch (err) {
    console.error("Error en resumen semanal (manual):", err);
    return NextResponse.json(
      { error: "Error interno", detail: String(err) },
      { status: 500 }
    );
  }
}
