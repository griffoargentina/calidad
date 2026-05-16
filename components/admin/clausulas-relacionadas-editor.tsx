"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pencil, Check, X, Plus } from "lucide-react";

interface Props {
  clausulaId: string;
  relacionadas: string[];
}

export function ClausulasRelacionadasEditor({ clausulaId, relacionadas: inicial }: Props) {
  const [editing, setEditing] = useState(false);
  const [items, setItems] = useState<string[]>(inicial);
  const [nuevo, setNuevo] = useState("");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    await fetch(`/api/admin/clausulas/${clausulaId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ relacionadas: items }),
    });
    setSaving(false);
    setEditing(false);
  }

  function cancel() {
    setItems(inicial);
    setNuevo("");
    setEditing(false);
  }

  function add() {
    const v = nuevo.trim();
    if (v && !items.includes(v)) setItems([...items, v]);
    setNuevo("");
  }

  function remove(i: number) {
    setItems(items.filter((_, idx) => idx !== i));
  }

  if (!editing) {
    return (
      <div className="flex items-center gap-2 flex-wrap">
        {items.length === 0
          ? <span className="text-sm text-muted-foreground">—</span>
          : items.map(r => (
              <span key={r} className="font-mono text-xs bg-muted border rounded px-1.5 py-0.5">{r}</span>
            ))
        }
        <Button size="icon" variant="ghost" className="h-6 w-6 opacity-40 hover:opacity-100"
          onClick={() => setEditing(true)}>
          <Pencil className="h-3 w-3" />
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {items.map((r, i) => (
          <span key={r} className="flex items-center gap-1 font-mono text-xs bg-muted border rounded px-1.5 py-0.5">
            {r}
            <button onClick={() => remove(i)} className="text-muted-foreground hover:text-red-500">
              <X className="h-2.5 w-2.5" />
            </button>
          </span>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <Input
          value={nuevo}
          onChange={e => setNuevo(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
          placeholder="ej: 6.1"
          className="h-7 text-sm w-28"
        />
        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={add}>
          <Plus className="h-3.5 w-3.5" />
        </Button>
        <Button size="icon" variant="ghost" className="h-7 w-7" disabled={saving} onClick={save}>
          <Check className="h-3.5 w-3.5 text-green-600" />
        </Button>
        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={cancel}>
          <X className="h-3.5 w-3.5 text-red-500" />
        </Button>
      </div>
    </div>
  );
}
