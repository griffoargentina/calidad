import { createAdminClient } from "@/lib/supabase/admin";

export async function generarCodigo(
  sectorId: string,
  tipoPrefijo: string,
): Promise<string | null> {
  const admin = createAdminClient();

  const { data: sector } = await admin
    .from("proc_sectores")
    .select("abreviatura")
    .eq("id", sectorId)
    .single();

  const abrev = sector?.abreviatura;
  if (!abrev) return null;  // sector has no abbreviation yet

  // Get max correlativo across both tables to avoid duplicates
  const pattern = `${tipoPrefijo}-${abrev}-%`;
  const [{ data: instRows }, { data: flujRows }] = await Promise.all([
    admin.from("proc_instructivos").select("codigo").like("codigo", pattern),
    admin.from("proc_flujogramas").select("codigo").like("codigo", pattern),
  ]);

  const allCodigos = [...(instRows ?? []), ...(flujRows ?? [])];
  const maxNum = allCodigos.reduce((max, row) => {
    if (!row.codigo) return max;
    const parts = row.codigo.split("-");
    const num = parseInt(parts[parts.length - 1]);
    return Math.max(max, isNaN(num) ? 0 : num);
  }, 0);

  return `${tipoPrefijo}-${abrev}-${String(maxNum + 1).padStart(2, "0")}`;
}
