import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Topbar } from "@/components/layout/topbar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatFecha } from "@/lib/utils/format";
import { CheckCircle2, XCircle } from "lucide-react";
import { InviteUsuarioDialog } from "@/components/admin/invite-usuario-dialog";

export default async function UsuariosPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: usuario } = await supabase.from("usuarios").select("rol").eq("id", user.id).single();
  if (usuario?.rol !== "admin") redirect("/dashboard");

  const [{ data: usuarios }, { data: areas }] = await Promise.all([
    supabase.from("usuarios").select("*, areas(nombre)").order("nombre"),
    supabase.from("areas").select("id, nombre").eq("activa", true).order("nombre"),
  ]);

  // Contar items por responsable y sus estados
  const { data: itemsStats } = await supabase
    .from("items")
    .select("responsable_id, estado")
    .eq("es_borrador", false);

  const statsMap: Record<string, { total: number; vencidos: number; porVencer: number }> = {};
  for (const item of itemsStats ?? []) {
    if (!item.responsable_id) continue;
    if (!statsMap[item.responsable_id]) statsMap[item.responsable_id] = { total: 0, vencidos: 0, porVencer: 0 };
    statsMap[item.responsable_id].total++;
    if (item.estado === "vencido") statsMap[item.responsable_id].vencidos++;
    if (item.estado === "por_vencer") statsMap[item.responsable_id].porVencer++;
  }

  // Ordenar: más problemáticos primero
  const usuariosOrdenados = [...(usuarios ?? [])].sort((a, b) => {
    const aV = statsMap[a.id]?.vencidos ?? 0;
    const bV = statsMap[b.id]?.vencidos ?? 0;
    return bV - aV;
  });

  const ROL_COLORS: Record<string, string> = {
    admin: "default",
    editor: "secondary",
    lector: "outline",
  };

  return (
    <div className="flex flex-col h-full">
      <Topbar title="Usuarios" actions={<InviteUsuarioDialog areas={areas ?? []} />} />
      <div className="flex-1 p-6">
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30 hover:bg-muted/30">
                  <TableHead>Usuario</TableHead>
                  <TableHead>Rol</TableHead>
                  <TableHead>Área</TableHead>
                  <TableHead className="w-24 text-center">Items</TableHead>
                  <TableHead className="w-28 text-center text-red-600">Vencidos</TableHead>
                  <TableHead className="w-28 text-center text-yellow-600">Por vencer</TableHead>
                  <TableHead className="w-24 text-center">% Cumpl.</TableHead>
                  <TableHead className="w-32">Último login</TableHead>
                  <TableHead className="w-16 text-center">Activo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(usuariosOrdenados as Array<{ id: string; nombre: string; email: string; rol: string; activo: boolean; ultimo_login: string | null; areas?: { nombre: string } | null }>).map((u) => {
                  const stats = statsMap[u.id] ?? { total: 0, vencidos: 0, porVencer: 0 };
                  const cumplimiento = stats.total > 0
                    ? Math.round(((stats.total - stats.vencidos) / stats.total) * 100)
                    : 100;

                  return (
                    <TableRow key={u.id} className={stats.vencidos > 0 ? "bg-red-50/30" : ""}>
                      <TableCell>
                        <div>
                          <p className="text-sm font-medium">{u.nombre}</p>
                          <p className="text-xs text-muted-foreground">{u.email}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={ROL_COLORS[u.rol] as Parameters<typeof Badge>[0]["variant"]} className="capitalize">{u.rol}</Badge>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">{u.areas?.nombre ?? "—"}</span>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="text-sm">{stats.total}</span>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className={`text-sm font-medium ${stats.vencidos > 0 ? "text-red-600" : "text-muted-foreground"}`}>
                          {stats.vencidos}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className={`text-sm ${stats.porVencer > 0 ? "text-yellow-600" : "text-muted-foreground"}`}>
                          {stats.porVencer}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className={`text-sm font-semibold ${
                          cumplimiento === 100 ? "text-green-600" :
                          cumplimiento >= 80 ? "text-yellow-600" : "text-red-600"
                        }`}>
                          {cumplimiento}%
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs text-muted-foreground">{formatFecha(u.ultimo_login)}</span>
                      </TableCell>
                      <TableCell className="text-center">
                        {u.activo
                          ? <CheckCircle2 className="h-4 w-4 text-green-500 mx-auto" />
                          : <XCircle className="h-4 w-4 text-muted-foreground mx-auto" />
                        }
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
