import { format, formatDistanceToNow, isPast, isWithinInterval, addDays } from "date-fns";
import { es } from "date-fns/locale";
import { EstadoItem } from "@/types/database";

export function formatFecha(fecha: string | null | undefined): string {
  if (!fecha) return "—";
  return format(new Date(fecha), "dd/MM/yyyy", { locale: es });
}

export function formatFechaRelativa(fecha: string | null | undefined): string {
  if (!fecha) return "—";
  return formatDistanceToNow(new Date(fecha), { addSuffix: true, locale: es });
}

export function calcularEstado(fechaVencimiento: string | null, esBorrador: boolean, estadoActual: EstadoItem): EstadoItem {
  if (esBorrador) return "borrador";
  if (estadoActual === "obsoleto" || estadoActual === "pendiente_aprobacion") return estadoActual;
  if (!fechaVencimiento) return "vigente";

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const vencimiento = new Date(fechaVencimiento);

  if (isPast(vencimiento) && vencimiento < hoy) return "vencido";
  if (isWithinInterval(vencimiento, { start: hoy, end: addDays(hoy, 7) })) return "por_vencer";
  return "vigente";
}

export function diasHastaVencimiento(fechaVencimiento: string | null): number | null {
  if (!fechaVencimiento) return null;
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const vencimiento = new Date(fechaVencimiento);
  const diff = Math.ceil((vencimiento.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
  return diff;
}

export function formatBytes(bytes: number | null): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
