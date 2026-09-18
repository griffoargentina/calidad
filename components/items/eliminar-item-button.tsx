"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Trash2, Loader2 } from "lucide-react";

export function EliminarItemButton({ itemId, titulo }: { itemId: string; titulo: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function eliminar() {
    setLoading(true);
    await fetch(`/api/items/${itemId}`, { method: "DELETE" });
    setLoading(false);
    setOpen(false);
    router.push("/items");
  }

  return (
    <>
      <Button variant="destructive" size="sm" onClick={() => setOpen(true)}>
        <Trash2 className="h-4 w-4 mr-1.5" />
        Eliminar
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Eliminar este documento?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Se eliminarán <strong className="text-foreground">{titulo}</strong> y todos sus archivos e historial. Esta acción no se puede deshacer.
          </p>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={loading}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={eliminar} disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
              Sí, eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
