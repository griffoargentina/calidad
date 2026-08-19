import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Resend } from "resend";
import {
  isoVencimientoHtml,
  isoVencimientoText,
  indFinDeMesHtml,
  indFinDeMesText,
  indVencidoHtml,
  indVencidoText,
  type IsoAlertItem,
  type IndAlertItem,
} from "@/lib/email/templates";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = `${process.env.RESEND_FROM_NAME ?? "Sistema de Calidad Griffo"} <${process.env.RESEND_FROM_EMAIL ?? "calidad@griffo.com.ar"}>`;

// Protege el endpoint con un secret para que solo el cron de Vercel lo llame
function isAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // si no está configurado, solo funciona en dev
  const auth = req.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

export async function POST(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const admin = createAdminClient();
  const hoy = new Date();
  const resultados: string[] = [];

  // ─── 1. ALERTAS ISO (documentos con fecha de vencimiento) ─────────────────

  const { data: items } = await admin
    .from("items")
    .select("id, codigo, nombre, area, fecha_vencimiento, responsable_id, responsable:usuarios!responsable_id(id, nombre, email)")
    .not("fecha_vencimiento", "is", null)
    .in("estado", ["vigente", "por_vencer", "vencido"])
    .order("fecha_vencimiento");

  // Grupos ISO: 30d, 15d, 7d, 0d (hoy vence), y 1d (ayer venció = recordatorio)
  const ISO_VENTANAS = [30, 15, 7, 0];

  if (items && items.length > 0) {
    // Agrupar items por responsable
    const porResponsable: Record<string, { usuario: { id: string; nombre: string; email: string }; items: IsoAlertItem[] }> = {};

    for (const item of items) {
      const resp = Array.isArray(item.responsable) ? item.responsable[0] : item.responsable;
      if (!resp?.email) continue;

      const fechaVenc = new Date(item.fecha_vencimiento as string);
      const diffMs = fechaVenc.getTime() - hoy.getTime();
      const dias = Math.round(diffMs / (1000 * 60 * 60 * 24));

      // Entra solo si corresponde a una ventana exacta (o es vencido reciente ≤ 7 días)
      const esVentana = ISO_VENTANAS.includes(dias) || (dias < 0 && dias >= -7);
      if (!esVentana) continue;

      // Deduplicar: no enviar si ya se mandó hoy el mismo tipo
      const tipoNotif = dias >= 0 ? `${dias}d` : "post_vencimiento";
      const { data: yaEnviada } = await admin
        .from("notificaciones")
        .select("id")
        .eq("item_id", item.id)
        .eq("tipo", tipoNotif)
        .gte("enviada_at", hoy.toISOString().slice(0, 10)) // hoy
        .maybeSingle();
      if (yaEnviada) continue;

      if (!porResponsable[resp.id]) {
        porResponsable[resp.id] = { usuario: resp, items: [] };
      }
      porResponsable[resp.id].items.push({
        codigo: item.codigo,
        nombre: item.nombre,
        area: item.area ?? "—",
        fecha_vencimiento: new Date(item.fecha_vencimiento as string).toLocaleDateString("es-AR", { day: "numeric", month: "short", year: "numeric" }),
        dias,
      });
    }

    for (const { usuario, items: itemsResp } of Object.values(porResponsable)) {
      if (itemsResp.length === 0) continue;

      const hayVencidos = itemsResp.some((i) => i.dias <= 0);
      const subject = hayVencidos
        ? `Documento${itemsResp.length > 1 ? "s" : ""} vencido${itemsResp.length > 1 ? "s" : ""} — revisión requerida`
        : `Documento${itemsResp.length > 1 ? "s" : ""} por vencer — recordatorio`;

      const { error } = await resend.emails.send({
        from: FROM,
        to: usuario.email,
        subject,
        html: isoVencimientoHtml(usuario.nombre.split(" ")[0], itemsResp),
        text: isoVencimientoText(usuario.nombre.split(" ")[0], itemsResp),
      });

      if (!error) {
        // Registrar en notificaciones para no repetir
        for (const item of itemsResp) {
          const tipoNotif = item.dias >= 0 ? `${item.dias}d` : "post_vencimiento";
          const itemDb = items.find((i) => i.codigo === item.codigo);
          if (itemDb) {
            await admin.from("notificaciones").insert({
              item_id: itemDb.id,
              tipo: tipoNotif as never,
              destinatario_id: usuario.id,
              estado: "enviada",
            });
          }
        }
        resultados.push(`ISO → ${usuario.email} (${itemsResp.length} items)`);
      } else {
        resultados.push(`ISO ERROR → ${usuario.email}: ${error.message}`);
      }
    }
  }

  // ─── 2. ALERTAS INDICADORES ───────────────────────────────────────────────

  const diaDelMes = hoy.getDate();
  const mesActual = hoy.getMonth() + 1; // 1-12
  const anioActual = hoy.getFullYear();

  // Último día del mes actual
  const ultimoDia = new Date(anioActual, mesActual, 0).getDate();
  const esUltimoDia = diaDelMes === ultimoDia;

  // 7 días después del fin del mes anterior
  // Si estamos el día 7 de este mes → mes anterior venció hace 7 días
  const esPost7 = diaDelMes === 7;

  if (esUltimoDia || esPost7) {
    const mesAlerta = esUltimoDia ? mesActual : mesActual - 1 === 0 ? 12 : mesActual - 1;
    const anioAlerta = esUltimoDia ? anioActual : mesActual - 1 === 0 ? anioActual - 1 : anioActual;

    const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
    const mesNombre = MESES[mesAlerta - 1];

    const { data: indicadores } = await admin
      .from("indicadores")
      .select("id, nombre, sector, frecuencia, responsable_id, responsable:usuarios!responsable_id(id, nombre, email)")
      .eq("activo", true)
      .eq("frecuencia", "mensual");

    if (indicadores && indicadores.length > 0) {
      // Para cada indicador, ver si tiene registro en el mes/año de alerta
      const indIds = indicadores.map((i) => i.id);
      const { data: registros } = await admin
        .from("indicador_registros")
        .select("indicador_id")
        .in("indicador_id", indIds)
        .eq("anio", anioAlerta)
        .eq("mes", mesAlerta);

      const conDatos = new Set((registros ?? []).map((r) => r.indicador_id));

      // Agrupar sin datos por responsable
      const porResponsable: Record<string, { usuario: { id: string; nombre: string; email: string }; items: IndAlertItem[] }> = {};

      for (const ind of indicadores) {
        if (conDatos.has(ind.id)) continue;
        const resp = Array.isArray(ind.responsable) ? ind.responsable[0] : ind.responsable;
        if (!resp?.email) continue;

        if (!porResponsable[resp.id]) {
          porResponsable[resp.id] = { usuario: resp, items: [] };
        }
        porResponsable[resp.id].items.push({
          id: ind.id,
          nombre: ind.nombre,
          sector: ind.sector,
        });
      }

      for (const { usuario, items: inds } of Object.values(porResponsable)) {
        if (inds.length === 0) continue;

        const html = esUltimoDia
          ? indFinDeMesHtml(usuario.nombre.split(" ")[0], mesNombre, inds)
          : indVencidoHtml(usuario.nombre.split(" ")[0], mesNombre, inds);
        const text = esUltimoDia
          ? indFinDeMesText(usuario.nombre.split(" ")[0], mesNombre, inds)
          : indVencidoText(usuario.nombre.split(" ")[0], mesNombre, inds);
        const subject = esUltimoDia
          ? `Recordatorio — Cargar datos de ${mesNombre} en indicadores`
          : `Indicadores de ${mesNombre} siguen sin datos`;

        const { error } = await resend.emails.send({ from: FROM, to: usuario.email, subject, html, text });

        if (!error) {
          resultados.push(`IND (${esUltimoDia ? "fin-mes" : "7d"}) → ${usuario.email} (${inds.length} indicadores)`);
        } else {
          resultados.push(`IND ERROR → ${usuario.email}: ${error.message}`);
        }
      }
    }
  }

  return NextResponse.json({
    ok: true,
    fecha: hoy.toISOString(),
    enviados: resultados.length,
    detalle: resultados,
  });
}

// GET — lo usa el cron de Vercel (envía GET con Authorization: Bearer <CRON_SECRET>)
export async function GET(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  return POST(req);
}
