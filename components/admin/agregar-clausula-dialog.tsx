"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus } from "lucide-react";

export function AgregarClausulaDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [id, setId] = useState("");
  const [titulo, setTitulo] = useState("");
  const [descripcion, setDescripcion] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!id.trim() || !titulo.trim()) {
      setError("El ID y el título son obligatorios.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/admin/clausulas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: id.trim(), titulo: titulo.trim(), descripcion: descripcion.trim() || null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error al crear la cláusula");
      setOpen(false);
      setId(""); setTitulo(""); setDescripcion("");
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Plus className="h-4 w-4 mr-1" />
          Agregar cláusula
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Agregar cláusula al árbol ISO</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label htmlFor="clausula-id">ID de cláusula</Label>
            <Input
              id="clausula-id"
              placeholder="Ej: 4.1.1"
              value={id}
              onChange={(e) => setId(e.target.value)}
              className="font-mono"
            />
            <p className="text-xs text-muted-foreground">Formato numérico. Ej: 6.1.3, 8.4.2</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="clausula-titulo">Título</Label>
            <Input
              id="clausula-titulo"
              placeholder="Nombre de la cláusula"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="clausula-desc">Descripción (opcional)</Label>
            <Textarea
              id="clausula-desc"
              placeholder="Descripción o referencia ISO..."
              rows={3}
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
            />
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Guardando..." : "Agregar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
