export interface ItemVencido {
  tipo: "doc" | "cal" | "aud";
  codigo?: string | null;
  nombre: string;
  area?: string | null;
  responsable?: string | null;
  diasVencido: number; // positivo = hace X días; negativo = vence en X días
}

export interface ItemProximo {
  tipo: "doc" | "cal" | "aud";
  codigo?: string | null;
  nombre: string;
  area?: string | null;
  responsable?: string | null;
  diasRestantes: number;
}

export interface IndicadorSinDatos {
  nombre: string;
  responsable?: string | null;
  sector?: string | null;
}

export interface ResumenSemanalData {
  vencidos: ItemVencido[];
  proximos: ItemProximo[];
  indicadoresSinDatos: IndicadorSinDatos[];
  totalAlDia: number;
  mes: string; // ej: "julio 2025"
  fecha: string; // ej: "viernes 22 de agosto de 2025"
  panelUrl: string;
}

const TIPO_LABELS: Record<string, string> = {
  doc: "Documento",
  cal: "Calibración",
  aud: "Auditoría",
};

const TIPO_COLORS: Record<string, { bg: string; text: string }> = {
  doc: { bg: "#E0E7FF", text: "#3730A3" },
  cal: { bg: "#FCE7F3", text: "#9D174D" },
  aud: { bg: "#D1FAE5", text: "#065F46" },
};

function chip(tipo: string) {
  const c = TIPO_COLORS[tipo] ?? { bg: "#E5E7EB", text: "#374151" };
  return `<span style="display:inline-block;font-size:9px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;padding:2px 6px;border-radius:3px;background:${c.bg};color:${c.text};white-space:nowrap">${TIPO_LABELS[tipo] ?? tipo}</span>`;
}

function pillRed(text: string) {
  return `<span style="display:inline-block;font-size:10px;font-weight:600;padding:2px 8px;border-radius:10px;background:#FEE2E2;color:#991B1B;white-space:nowrap">${text}</span>`;
}

function pillAmber(text: string) {
  return `<span style="display:inline-block;font-size:10px;font-weight:600;padding:2px 8px;border-radius:10px;background:#FEF3C7;color:#78350F;white-space:nowrap">${text}</span>`;
}

function sectorTag(text: string) {
  return `<span style="display:inline-block;font-size:10px;color:#6B7280;background:#E5E7EB;padding:2px 7px;border-radius:10px;white-space:nowrap">${text}</span>`;
}

function rowVencido(item: ItemVencido) {
  const label =
    item.diasVencido === 1 ? "hace 1 día" : `hace ${item.diasVencido} días`;
  const meta = [item.area, item.responsable].filter(Boolean).join(" · ");
  return `
    <tr style="border-bottom:1px solid #E5E7EB">
      <td style="padding:9px 12px;font-size:12px;vertical-align:middle">
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:2px">
          ${chip(item.tipo)}
          ${item.codigo ? `<span style="font-size:10px;font-weight:700;color:#1E3A6E;letter-spacing:.06em">${item.codigo}</span>` : ""}
        </div>
        <div style="font-size:12px;font-weight:500;color:#111827;line-height:1.35">${item.nombre}</div>
        ${meta ? `<div style="font-size:10.5px;color:#6B7280;margin-top:2px">${meta}</div>` : ""}
      </td>
      <td style="padding:9px 12px;white-space:nowrap;text-align:right;vertical-align:middle">${pillRed(label)}</td>
    </tr>`;
}

function rowProximo(item: ItemProximo) {
  const label =
    item.diasRestantes === 1 ? "1 día" : `${item.diasRestantes} días`;
  const meta = [item.area, item.responsable].filter(Boolean).join(" · ");
  return `
    <tr style="border-bottom:1px solid #E5E7EB">
      <td style="padding:9px 12px;font-size:12px;vertical-align:middle">
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:2px">
          ${chip(item.tipo)}
          ${item.codigo ? `<span style="font-size:10px;font-weight:700;color:#1E3A6E;letter-spacing:.06em">${item.codigo}</span>` : ""}
        </div>
        <div style="font-size:12px;font-weight:500;color:#111827;line-height:1.35">${item.nombre}</div>
        ${meta ? `<div style="font-size:10.5px;color:#6B7280;margin-top:2px">${meta}</div>` : ""}
      </td>
      <td style="padding:9px 12px;white-space:nowrap;text-align:right;vertical-align:middle">${pillAmber(label)}</td>
    </tr>`;
}

function rowIndicador(ind: IndicadorSinDatos) {
  return `
    <tr style="border-bottom:1px solid #E5E7EB">
      <td style="padding:9px 12px;font-size:12px;vertical-align:middle">
        <div style="font-size:12px;font-weight:500;color:#111827;line-height:1.35">${ind.nombre}</div>
        ${ind.responsable ? `<div style="font-size:10.5px;color:#6B7280;margin-top:2px">${ind.responsable}</div>` : ""}
      </td>
      <td style="padding:9px 12px;white-space:nowrap;text-align:right;vertical-align:middle">
        ${ind.sector ? sectorTag(ind.sector) : ""}
      </td>
    </tr>`;
}

function sectionHead(label: string, count: number, color: "red" | "amber" | "blue") {
  const styles = {
    red: { bg: "#FEF2F2", text: "#B91C1C", border: "#FECACA", left: "#B91C1C", icon: "⚠" },
    amber: { bg: "#FFFBEB", text: "#92400E", border: "#FDE68A", left: "#D97706", icon: "↗" },
    blue: { bg: "#EFF6FF", text: "#1D4ED8", border: "#BFDBFE", left: "#1D4ED8", icon: "◎" },
  }[color];
  return `<div style="display:flex;align-items:center;gap:7px;padding:7px 12px;font-size:10.5px;font-weight:700;letter-spacing:.055em;text-transform:uppercase;border-radius:5px 5px 0 0;background:${styles.bg};color:${styles.text};border:1px solid ${styles.border};border-left:3px solid ${styles.left}">
    <span>${styles.icon}</span>
    ${label}
    <span style="margin-left:auto;font-size:10px;opacity:.65">${count} ítems</span>
  </div>`;
}

export function resumenSemanalHtml(data: ResumenSemanalData): string {
  const totalAccion =
    data.vencidos.length + data.indicadoresSinDatos.length + data.proximos.length;

  const vencidosSection =
    data.vencidos.length > 0
      ? `<div style="margin-bottom:18px">
          ${sectionHead("Vencidos", data.vencidos.length, "red")}
          <table style="width:100%;border-collapse:collapse;border:1px solid #E5E7EB;border-top:none;border-radius:0 0 5px 5px;overflow:hidden">
            ${data.vencidos.map(rowVencido).join("")}
          </table>
        </div>`
      : "";

  const indicadoresSection =
    data.indicadoresSinDatos.length > 0
      ? `<div style="margin-bottom:18px">
          ${sectionHead(`Indicadores sin datos — ${data.mes}`, data.indicadoresSinDatos.length, "blue")}
          <table style="width:100%;border-collapse:collapse;border:1px solid #E5E7EB;border-top:none;border-radius:0 0 5px 5px;overflow:hidden">
            ${data.indicadoresSinDatos.map(rowIndicador).join("")}
          </table>
        </div>`
      : "";

  const proximosSection =
    data.proximos.length > 0
      ? `<div style="margin-bottom:18px">
          ${sectionHead("Próximos a vencer", data.proximos.length, "amber")}
          <table style="width:100%;border-collapse:collapse;border:1px solid #E5E7EB;border-top:none;border-radius:0 0 5px 5px;overflow:hidden">
            ${data.proximos.map(rowProximo).join("")}
          </table>
        </div>`
      : "";

  const introText =
    totalAccion > 0
      ? `<strong>${totalAccion} ítems requieren atención.</strong> Revisá los vencimientos y completá los indicadores del mes.`
      : `<strong>Todo al día.</strong> No hay ítems vencidos ni indicadores pendientes.`;

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Resumen semanal — Sistema de Calidad Griffo</title>
</head>
<body style="margin:0;padding:0;background:#F0F2F5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F0F2F5;padding:32px 16px 64px">
    <tr><td align="center">
      <table width="620" cellpadding="0" cellspacing="0" style="max-width:620px;width:100%;background:#fff;border-radius:10px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08)">

        <!-- Header -->
        <tr>
          <td style="background:#0D1B3E;padding:20px 28px 0">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td>
                  <div style="color:#fff;font-size:15px;font-weight:700;letter-spacing:-.01em">Griffo S.R.L.</div>
                  <div style="color:rgba(255,255,255,.45);font-size:11px;font-weight:400;margin-top:1px;letter-spacing:.02em">Sistema de Gestión de Calidad</div>
                </td>
                <td align="right">
                  <span style="background:rgba(255,255,255,.12);color:rgba(255,255,255,.8);font-size:10px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;padding:4px 10px;border-radius:4px">Resumen Semanal</span>
                </td>
              </tr>
              <tr>
                <td colspan="2" style="padding-top:14px;padding-bottom:14px">
                  <div style="font-size:12px;color:rgba(255,255,255,.5)">${data.fecha}</div>
                </td>
              </tr>
            </table>
            <div style="height:3px;background:#2563EB;margin:0 -28px"></div>
          </td>
        </tr>

        <!-- Stats -->
        <tr>
          <td style="border-bottom:1px solid #E5E7EB">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td align="center" style="padding:14px 0 12px;border-right:1px solid #E5E7EB">
                  <div style="font-size:24px;font-weight:700;line-height:1;margin-bottom:3px;color:#B91C1C;font-variant-numeric:tabular-nums">${data.vencidos.length}</div>
                  <div style="font-size:9.5px;color:#6B7280;font-weight:500;letter-spacing:.04em;text-transform:uppercase">Vencidos</div>
                </td>
                <td align="center" style="padding:14px 0 12px;border-right:1px solid #E5E7EB">
                  <div style="font-size:24px;font-weight:700;line-height:1;margin-bottom:3px;color:#D97706;font-variant-numeric:tabular-nums">${data.indicadoresSinDatos.length}</div>
                  <div style="font-size:9.5px;color:#6B7280;font-weight:500;letter-spacing:.04em;text-transform:uppercase">Ind. sin datos</div>
                </td>
                <td align="center" style="padding:14px 0 12px;border-right:1px solid #E5E7EB">
                  <div style="font-size:24px;font-weight:700;line-height:1;margin-bottom:3px;color:#1D4ED8;font-variant-numeric:tabular-nums">${data.proximos.length}</div>
                  <div style="font-size:9.5px;color:#6B7280;font-weight:500;letter-spacing:.04em;text-transform:uppercase">Próximos</div>
                </td>
                <td align="center" style="padding:14px 0 12px">
                  <div style="font-size:24px;font-weight:700;line-height:1;margin-bottom:3px;color:#16A34A;font-variant-numeric:tabular-nums">${data.totalAlDia}</div>
                  <div style="font-size:9.5px;color:#6B7280;font-weight:500;letter-spacing:.04em;text-transform:uppercase">Al día</div>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:22px 28px 0">
            <p style="font-size:13px;color:#6B7280;margin-bottom:22px;line-height:1.55">${introText}</p>
            ${vencidosSection}
            ${indicadoresSection}
            ${proximosSection}
          </td>
        </tr>

        <!-- Legend -->
        <tr>
          <td style="padding:10px 28px;background:#F9FAFB;border-top:1px solid #E5E7EB">
            <table cellpadding="0" cellspacing="0">
              <tr>
                <td style="font-size:10px;color:#374151;font-weight:600;padding-right:10px">Referencias:</td>
                <td style="padding-right:8px">${chip("doc")}</td>
                <td style="padding-right:8px">${chip("cal")}</td>
                <td>${chip("aud")}</td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- CTA -->
        <tr>
          <td align="center" style="padding:20px 28px 24px;border-top:1px solid #E5E7EB">
            <a href="${data.panelUrl}" style="display:inline-block;background:#0D1B3E;color:#fff;text-decoration:none;font-size:13px;font-weight:600;padding:11px 28px;border-radius:6px;letter-spacing:.01em">Ver panel completo →</a>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:14px 28px 20px;border-top:1px solid #E5E7EB">
            <p style="font-size:11px;color:#9CA3AF;line-height:1.65;margin:0">Sistema de Gestión de Calidad — Griffo S.R.L. · calidad.griffo.com.ar<br>
            Este resumen se envía automáticamente todos los viernes a las 8 am.</p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export function resumenSemanalText(data: ResumenSemanalData): string {
  const lines: string[] = [
    "RESUMEN SEMANAL — SISTEMA DE GESTIÓN DE CALIDAD",
    `Griffo S.R.L. · ${data.fecha}`,
    "",
  ];

  if (data.vencidos.length > 0) {
    lines.push(`VENCIDOS (${data.vencidos.length})`);
    for (const v of data.vencidos) {
      const meta = [v.area, v.responsable].filter(Boolean).join(" · ");
      lines.push(
        `• [${TIPO_LABELS[v.tipo]}] ${v.codigo ? v.codigo + " — " : ""}${v.nombre}${meta ? " (" + meta + ")" : ""} — hace ${v.diasVencido} día${v.diasVencido === 1 ? "" : "s"}`
      );
    }
    lines.push("");
  }

  if (data.indicadoresSinDatos.length > 0) {
    lines.push(`INDICADORES SIN DATOS — ${data.mes.toUpperCase()} (${data.indicadoresSinDatos.length})`);
    for (const ind of data.indicadoresSinDatos) {
      lines.push(
        `• ${ind.nombre}${ind.responsable ? " (" + ind.responsable + ")" : ""}${ind.sector ? " [" + ind.sector + "]" : ""}`
      );
    }
    lines.push("");
  }

  if (data.proximos.length > 0) {
    lines.push(`PRÓXIMOS A VENCER (${data.proximos.length})`);
    for (const p of data.proximos) {
      const meta = [p.area, p.responsable].filter(Boolean).join(" · ");
      lines.push(
        `• [${TIPO_LABELS[p.tipo]}] ${p.codigo ? p.codigo + " — " : ""}${p.nombre}${meta ? " (" + meta + ")" : ""} — ${p.diasRestantes} día${p.diasRestantes === 1 ? "" : "s"}`
      );
    }
    lines.push("");
  }

  lines.push(`Al día: ${data.totalAlDia} ítems`);
  lines.push("");
  lines.push(`Ver panel: ${data.panelUrl}`);
  lines.push("");
  lines.push("---");
  lines.push("Sistema de Gestión de Calidad — Griffo S.R.L.");
  lines.push("Este resumen se envía automáticamente todos los viernes a las 8 am.");

  return lines.join("\n");
}
