"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useParams, useRouter } from "next/navigation";
import { Topbar } from "@/components/layout/topbar";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2 } from "lucide-react";
import { FlujogramaEditor, pasosToFlow } from "@/components/procesos/flujograma-editor";
import type { Node, Edge } from "@xyflow/react";
import type { NodeData, Sector, Instructivo } from "@/components/procesos/flujograma-editor";

interface Flujograma {
  id: string;
  nombre: string;
  sector_id: string;
  version: number;
  estado: string;
  flow_data: { nodes: Node<NodeData>[]; edges: Edge[] } | null;
  sector: { id: string; nombre: string } | { id: string; nombre: string }[] | null;
  pasos: Array<{
    id: string; nombre: string; tipo: string; orden: number;
    sectores: Sector[];
    instructivo: Instructivo | null;
  }>;
}

export default function FlujogramaEditorPage() {
  const params = useParams();
  const router = useRouter();
  const sectorId = params.id as string;
  const fid = params.fid as string;

  const [flujograma, setFlujograma] = useState<Flujograma | null>(null);
  const [initialNodes, setInitialNodes] = useState<Node<NodeData>[]>([]);
  const [initialEdges, setInitialEdges] = useState<Edge[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRol, setUserRol] = useState("lector");
  const [allSectores, setAllSectores] = useState<Sector[]>([]);
  const [sectorInstructivos, setSectorInstructivos] = useState<Instructivo[]>([]);
  const [editorKey, setEditorKey] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/procesos/flujogramas/${fid}`);
    if (!res.ok) { router.push(`/procesos/${sectorId}`); return; }
    const data: Flujograma = await res.json();
    setFlujograma(data);

    if (data.flow_data?.nodes) {
      setInitialNodes(data.flow_data.nodes);
      setInitialEdges(data.flow_data.edges ?? []);
    } else {
      const { nodes, edges } = pasosToFlow(data.pasos ?? []);
      setInitialNodes(nodes);
      setInitialEdges(edges);
    }

    setLoading(false);
    setEditorKey((k) => k + 1);
  }, [fid, sectorId, router]);

  useEffect(() => {
    load();
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      const { data } = await supabase.from("usuarios").select("rol").eq("id", user.id).single();
      setUserRol(data?.rol ?? "lector");
    });
    supabase.from("proc_sectores").select("id, nombre").eq("activo", true).order("orden").then(({ data }) => {
      setAllSectores(data ?? []);
    });
  }, [load]);

  useEffect(() => {
    if (!flujograma) return;
    fetch(`/api/procesos/instructivos?sector_id=${flujograma.sector_id}`)
      .then((r) => r.json())
      .then((d) => setSectorInstructivos(Array.isArray(d) ? d : []));
  }, [flujograma]);

  const canEdit = ["admin", "editor"].includes(userRol);
  const isAdmin = userRol === "admin";

  const sectorNombre = (() => {
    if (!flujograma?.sector) return "";
    const s = Array.isArray(flujograma.sector) ? flujograma.sector[0] : flujograma.sector;
    return s?.nombre ?? "";
  })();

  if (loading) {
    return (
      <div className="flex flex-col h-full">
        <Topbar title="Flujograma" />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (!flujograma) return null;

  return (
    <div className="flex flex-col h-full">
      <Topbar title={flujograma.nombre} />

      {/* Sub-header */}
      <div className="border-b bg-white px-6 py-3 flex items-center gap-3 shrink-0">
        <Button variant="ghost" size="sm" className="h-7 px-2"
          onClick={() => router.push(`/procesos/${sectorId}`)}>
          <ArrowLeft className="h-4 w-4 mr-1" />Sector
        </Button>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm">{flujograma.nombre}</span>
            <span className="text-xs text-muted-foreground">v{flujograma.version}</span>
            <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
              flujograma.estado === "vigente" ? "bg-green-100 text-green-700" :
              flujograma.estado === "borrador" ? "bg-slate-100 text-slate-600" :
              "bg-gray-100 text-gray-500"
            }`}>{flujograma.estado}</span>
          </div>
          <p className="text-xs text-muted-foreground">{sectorNombre}</p>
        </div>
      </div>

      {/* Editor fills remaining space */}
      <div className="flex-1 overflow-hidden">
        <FlujogramaEditor
          key={editorKey}
          flujogramaId={fid}
          initialNodes={initialNodes}
          initialEdges={initialEdges}
          allSectores={allSectores}
          instructivos={sectorInstructivos}
          canEdit={canEdit}
          isAdmin={isAdmin}
          onSaved={load}
        />
      </div>
    </div>
  );
}
