const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://calidad.griffo.com.ar";
const EMPRESA = "Griffo S.R.L.";

function base(content: string): string {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Sistema de Calidad ${EMPRESA}</title>
</head>
<body style="margin:0;padding:0;background:#E8ECF0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#E8ECF0;padding:32px 16px 48px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.08);">
        <!-- Header -->
        <tr>
          <td style="background:#0D1B3E;padding:18px 28px;">
            <span style="color:#ffffff;font-size:13px;font-weight:600;letter-spacing:.02em;">Sistema de Calidad</span>
            <span style="color:rgba(255,255,255,.45);font-size:11px;font-weight:400;margin-left:8px;letter-spacing:.04em;">${EMPRESA.toUpperCase()}</span>
          </td>
        </tr>
        ${content}
        <!-- Footer -->
        <tr>
          <td style="border-top:1px solid #E2E8F0;padding:14px 28px 20px;">
            <p style="margin:0;font-size:11px;color:#94A3B8;line-height:1.6;">
              Sistema de Calidad ${EMPRESA} · <a href="${APP_URL}" style="color:#94A3B8;">${APP_URL.replace("https://", "")}</a><br>
              Para dejar de recibir estos avisos, contactá al administrador del sistema.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ─── ISO: por vencer ────────────────────────────────────────────────────────

export interface IsoAlertItem {
  codigo: string;
  nombre: string;
  area: string;
  fecha_vencimiento: string;
  dias: number; // positivo = días restantes, negativo = días vencido
}

export function isoVencimientoHtml(
  nombre: string,
  items: IsoAlertItem[]
): string {
  const vencidos = items.filter((i) => i.dias <= 0);
  const porVencer = items.filter((i) => i.dias > 0);
  const stripColor = vencidos.length > 0 ? "#C0392B" : "#F59E0B";

  function renderItem(item: IsoAlertItem) {
    const esVencido = item.dias <= 0;
    const diasLabel = esVencido
      ? `Venció hace ${Math.abs(item.dias)} día${Math.abs(item.dias) !== 1 ? "s" : ""}`
      : `Vence en ${item.dias} día${item.dias !== 1 ? "s" : ""}`;
    const badgeColor = esVencido ? "#C0392B" : "#B45309";
    const headerBg = esVencido ? "#FEF2F2" : "#FFFBEB";
    const headerBorder = esVencido ? "#FECACA" : "#FDE68A";

    return `
      <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #E2E8F0;border-radius:6px;overflow:hidden;margin-bottom:12px;">
        <tr>
          <td style="background:${headerBg};border-bottom:1px solid ${headerBorder};padding:8px 14px;">
            <span style="font-size:11px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:${badgeColor};">${diasLabel}</span>
            <span style="float:right;font-size:11px;color:#64748B;">${item.fecha_vencimiento}</span>
          </td>
        </tr>
        <tr>
          <td style="padding:12px 14px;">
            <div style="font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#1E3A6E;margin-bottom:3px;">${item.codigo}</div>
            <div style="font-size:13px;font-weight:600;color:#1A202C;margin-bottom:4px;line-height:1.3;">${item.nombre}</div>
            <div style="font-size:11px;color:#64748B;">Área: ${item.area}</div>
          </td>
        </tr>
      </table>`;
  }

  const content = `
    <tr><td style="height:3px;background:${stripColor};"></td></tr>
    <tr>
      <td style="padding:28px 28px 24px;">
        <p style="margin:0 0 16px;font-size:14px;color:#64748B;">Hola, ${nombre} —</p>
        <h2 style="margin:0 0 20px;font-size:17px;font-weight:600;color:#1A202C;line-height:1.3;">
          ${vencidos.length > 0
            ? `Tenés ${vencidos.length} documento${vencidos.length !== 1 ? "s" : ""} vencido${vencidos.length !== 1 ? "s" : ""}`
            : `Tenés documentos por vencer`}
        </h2>
        ${[...vencidos, ...porVencer].map(renderItem).join("")}
        <table cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
          <tr>
            <td style="background:#1E3A6E;border-radius:6px;padding:10px 20px;">
              <a href="${APP_URL}/vencimientos" style="color:#ffffff;text-decoration:none;font-size:13px;font-weight:600;letter-spacing:.01em;">Ver documentos →</a>
            </td>
          </tr>
        </table>
        <p style="margin:0;font-size:12px;color:#64748B;line-height:1.6;">
          Si el documento ya está en revisión, podés ignorar este aviso.
        </p>
      </td>
    </tr>`;

  return base(content);
}

export function isoVencimientoText(nombre: string, items: IsoAlertItem[]): string {
  const lines = items.map((i) => {
    const label =
      i.dias <= 0
        ? `VENCIDO hace ${Math.abs(i.dias)} días`
        : `Vence en ${i.dias} días`;
    return `• [${i.codigo}] ${i.nombre} — ${label} (${i.fecha_vencimiento})`;
  });
  return `Hola ${nombre},\n\nTenés documentos que requieren atención:\n\n${lines.join("\n")}\n\nVer en: ${APP_URL}/vencimientos\n\n—\nSistema de Calidad ${EMPRESA}`;
}

// ─── Indicadores: recordatorio fin de mes ───────────────────────────────────

export interface IndAlertItem {
  id: string;
  nombre: string;
  sector: string;
}

export function indFinDeMesHtml(
  nombre: string,
  mes: string,
  items: IndAlertItem[]
): string {
  const content = `
    <tr><td style="height:3px;background:#3B82F6;"></td></tr>
    <tr>
      <td style="padding:28px 28px 24px;">
        <p style="margin:0 0 16px;font-size:14px;color:#64748B;">Hola, ${nombre} —</p>
        <h2 style="margin:0 0 20px;font-size:17px;font-weight:600;color:#1A202C;line-height:1.3;">
          Hoy es el último día de ${mes}. Hay indicadores sin datos.
        </h2>
        <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #E2E8F0;border-radius:6px;overflow:hidden;margin-bottom:20px;">
          <tr>
            <td style="background:#FFFBEB;border-bottom:1px solid #FDE68A;padding:9px 14px;">
              <span style="font-size:11px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:#B45309;">${items.length} indicador${items.length !== 1 ? "es" : ""} pendiente${items.length !== 1 ? "s" : ""} — ${mes}</span>
            </td>
          </tr>
          ${items
            .map(
              (ind) => `
          <tr style="border-bottom:1px solid #E2E8F0;">
            <td style="padding:10px 14px;">
              <span style="font-size:12px;font-weight:500;color:#1A202C;">${ind.nombre}</span>
              <span style="float:right;font-size:10px;color:#64748B;background:#F1F5F9;padding:2px 7px;border-radius:10px;">${ind.sector}</span>
            </td>
          </tr>`
            )
            .join("")}
        </table>
        <table cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
          <tr>
            <td style="background:#1E3A6E;border-radius:6px;padding:10px 20px;">
              <a href="${APP_URL}/indicadores" style="color:#ffffff;text-decoration:none;font-size:13px;font-weight:600;letter-spacing:.01em;">Cargar datos →</a>
            </td>
          </tr>
        </table>
        <p style="margin:0;font-size:12px;color:#64748B;line-height:1.6;">
          Si los datos se cargan mañana, el indicador figurará como vencido hasta que se registre el valor.
        </p>
      </td>
    </tr>`;

  return base(content);
}

export function indFinDeMesText(nombre: string, mes: string, items: IndAlertItem[]): string {
  const lines = items.map((i) => `• ${i.nombre} (${i.sector})`);
  return `Hola ${nombre},\n\nHoy es el último día de ${mes}. Los siguientes indicadores no tienen datos cargados:\n\n${lines.join("\n")}\n\nCargar datos: ${APP_URL}/indicadores\n\n—\nSistema de Calidad ${EMPRESA}`;
}

// ─── Indicadores: 7 días vencidos ───────────────────────────────────────────

export function indVencidoHtml(
  nombre: string,
  mes: string,
  items: IndAlertItem[]
): string {
  const content = `
    <tr><td style="height:3px;background:#C0392B;"></td></tr>
    <tr>
      <td style="padding:28px 28px 24px;">
        <p style="margin:0 0 16px;font-size:14px;color:#64748B;">Hola, ${nombre} —</p>
        <h2 style="margin:0 0 20px;font-size:17px;font-weight:600;color:#1A202C;line-height:1.3;">
          Indicadores de ${mes} siguen sin datos
        </h2>
        <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #E2E8F0;border-radius:6px;overflow:hidden;margin-bottom:20px;">
          <tr>
            <td style="background:#FEF2F2;border-bottom:1px solid #FECACA;padding:9px 14px;">
              <span style="font-size:11px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:#C0392B;">Sin registrar desde el 31 de ${mes}</span>
            </td>
          </tr>
          ${items
            .map(
              (ind) => `
          <tr style="border-bottom:1px solid #E2E8F0;">
            <td style="padding:10px 14px;">
              <span style="font-size:12px;font-weight:500;color:#1A202C;">${ind.nombre}</span>
              <span style="float:right;font-size:10px;color:#64748B;background:#F1F5F9;padding:2px 7px;border-radius:10px;">${ind.sector}</span>
            </td>
          </tr>`
            )
            .join("")}
        </table>
        <table cellpadding="0" cellspacing="0">
          <tr>
            <td style="background:#1E3A6E;border-radius:6px;padding:10px 20px;">
              <a href="${APP_URL}/indicadores" style="color:#ffffff;text-decoration:none;font-size:13px;font-weight:600;letter-spacing:.01em;">Cargar datos →</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>`;

  return base(content);
}

export function indVencidoText(nombre: string, mes: string, items: IndAlertItem[]): string {
  const lines = items.map((i) => `• ${i.nombre} (${i.sector})`);
  return `Hola ${nombre},\n\nLos siguientes indicadores de ${mes} llevan 7 días sin datos:\n\n${lines.join("\n")}\n\nCargar datos: ${APP_URL}/indicadores\n\n—\nSistema de Calidad Griffo S.R.L.`;
}
