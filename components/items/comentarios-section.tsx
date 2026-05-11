"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { formatFechaRelativa } from "@/lib/utils/format";
import { Loader2, Send, MessageSquare } from "lucide-react";

interface ComentarioConUsuario {
  id: string;
  contenido: string;
  created_at: string;
  usuario_id: string;
  usuarios: { nombre: string };
}

export function ComentariosSection({ itemId }: { itemId: string }) {
  const supabase = createClient();
  const [comentarios, setComentarios] = useState<ComentarioConUsuario[]>([]);
  const [nuevo, setNuevo] = useState("");
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    const { data } = await supabase
      .from("comentarios")
      .select("*, usuarios(nombre)")
      .eq("item_id", itemId)
      .order("created_at", { ascending: true });
    setComentarios((data as ComentarioConUsuario[]) ?? []);
  }, [supabase, itemId]);

  useEffect(() => {
    cargar();
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, [cargar, supabase]);

  async function handleEnviar() {
    if (!nuevo.trim()) return;
    setLoading(true);
    const { error } = await supabase.from("comentarios").insert({
      item_id: itemId,
      contenido: nuevo.trim(),
    });
    if (!error) {
      setNuevo("");
      await cargar();
    }
    setLoading(false);
  }

  async function handleEliminar(id: string) {
    await supabase.from("comentarios").delete().eq("id", id);
    await cargar();
  }

  return (
    <Card>
      <CardContent className="p-6 space-y-4">
        {comentarios.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm">No hay comentarios todavía.</p>
            <p className="text-xs">Los comentarios quedan auditados en el sistema.</p>
          </div>
        ) : (
          <ul className="space-y-4">
            {comentarios.map((c) => (
              <li key={c.id} className="flex gap-3">
                <Avatar className="h-8 w-8 shrink-0">
                  <AvatarFallback className="text-xs">
                    {c.usuarios?.nombre?.slice(0, 2).toUpperCase() ?? "?"}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{c.usuarios?.nombre}</span>
                    <span className="text-xs text-muted-foreground">{formatFechaRelativa(c.created_at)}</span>
                  </div>
                  <p className="text-sm mt-1 whitespace-pre-wrap">{c.contenido}</p>
                  {userId === c.usuario_id && (
                    <button
                      onClick={() => handleEliminar(c.id)}
                      className="text-xs text-muted-foreground hover:text-destructive mt-1 transition-colors"
                    >
                      Eliminar
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}

        {/* Nuevo comentario */}
        <div className="flex gap-3 pt-2 border-t">
          <div className="flex-1">
            <Textarea
              placeholder="Escribí un comentario... (queda auditado)"
              value={nuevo}
              onChange={(e) => setNuevo(e.target.value)}
              rows={2}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleEnviar();
              }}
            />
            <p className="text-xs text-muted-foreground mt-1">⌘Enter para enviar</p>
          </div>
          <Button onClick={handleEnviar} disabled={loading || !nuevo.trim()} size="icon" className="self-start mt-0.5">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
