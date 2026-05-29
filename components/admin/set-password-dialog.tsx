"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { KeyRound, Loader2 } from "lucide-react";

interface Props {
  userId: string;
  userName: string;
}

export function SetPasswordDialog({ userId, userName }: Props) {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMsg(null);
    const res = await fetch(`/api/admin/usuarios/${userId}/password`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    const data = await res.json();
    setLoading(false);
    if (res.ok) {
      setMsg({ ok: true, text: "Contraseña actualizada" });
      setTimeout(() => { setOpen(false); setPassword(""); setMsg(null); }, 1200);
    } else {
      setMsg({ ok: false, text: data.error ?? "Error desconocido" });
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setPassword(""); setMsg(null); } }}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground">
          <KeyRound className="h-3.5 w-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xs">
        <DialogHeader>
          <DialogTitle className="text-sm">Asignar contraseña</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground -mt-1">{userName}</p>
        <form onSubmit={handleSubmit} className="space-y-3 mt-1">
          <div className="space-y-1">
            <Label className="text-xs">Nueva contraseña</Label>
            <Input
              type="text"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="ej. 12345678juan"
              className="text-sm"
              autoFocus
            />
            <p className="text-[10px] text-muted-foreground">Mínimo 6 caracteres. Se aplica de inmediato.</p>
          </div>
          {msg && (
            <p className={`text-xs font-medium ${msg.ok ? "text-green-600" : "text-red-500"}`}>{msg.text}</p>
          )}
          <Button type="submit" disabled={loading || password.length < 6} className="w-full h-8 text-xs">
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Guardar contraseña"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
