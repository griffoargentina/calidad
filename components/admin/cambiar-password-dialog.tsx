"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { KeyRound, Loader2, CheckCircle2 } from "lucide-react";

interface Props {
  usuarioId: string;
  nombreUsuario: string;
}

export function CambiarPasswordDialog({ usuarioId, nombreUsuario }: Props) {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleGuardar() {
    if (password.length < 6) { setError("Mínimo 6 caracteres"); return; }
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/admin/usuarios/${usuarioId}/password`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) { setError(data.error ?? "Error"); return; }
    setDone(true);
    setTimeout(() => { setOpen(false); setDone(false); setPassword(""); }, 1200);
  }

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 opacity-50 hover:opacity-100"
        title="Cambiar contraseña"
        onClick={() => { setOpen(true); setPassword(""); setError(null); setDone(false); }}
      >
        <KeyRound className="h-3.5 w-3.5" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Cambiar contraseña</DialogTitle>
          </DialogHeader>

          {done ? (
            <div className="flex flex-col items-center py-6 gap-2 text-green-600">
              <CheckCircle2 className="h-10 w-10" />
              <p className="font-semibold">Contraseña actualizada</p>
            </div>
          ) : (
            <div className="space-y-4 py-2">
              <p className="text-sm text-muted-foreground">
                Usuario: <span className="font-medium text-foreground">{nombreUsuario}</span>
              </p>
              <div className="space-y-1.5">
                <Label>Nueva contraseña</Label>
                <Input
                  type="text"
                  placeholder="Mínimo 6 caracteres"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleGuardar()}
                  autoFocus
                />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
            </div>
          )}

          {!done && (
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>Cancelar</Button>
              <Button onClick={handleGuardar} disabled={loading || !password}>
                {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Guardando...</> : "Guardar"}
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
