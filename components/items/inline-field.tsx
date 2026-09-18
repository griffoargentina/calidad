"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pencil, Check, X } from "lucide-react";

interface Option { value: string; label: string }

interface Props {
  itemId: string;
  field: string;
  value: string | null;
  displayValue: string;
  type: "date" | "select";
  options?: Option[];
  canEdit?: boolean;
  emptyClass?: string;
}

export function InlineField({ itemId, field, value, displayValue, type, options, canEdit, emptyClass }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(value ?? "");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    await fetch(`/api/items/${itemId}/quick-edit`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: val || null }),
    });
    setSaving(false);
    setEditing(false);
    router.refresh();
  }

  if (editing) {
    return (
      <div className="flex items-center gap-1.5">
        {type === "date" ? (
          <Input
            type="date"
            value={val}
            onChange={e => setVal(e.target.value)}
            className="h-7 text-sm w-36"
          />
        ) : (
          <select
            className="border rounded-md px-2 py-1 text-sm bg-white h-7"
            value={val}
            onChange={e => setVal(e.target.value)}
          >
            <option value="">Sin frecuencia</option>
            {options?.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        )}
        <Button size="icon" variant="ghost" className="h-6 w-6" disabled={saving} onClick={save}>
          <Check className="h-3.5 w-3.5 text-green-600" />
        </Button>
        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => { setEditing(false); setVal(value ?? ""); }}>
          <X className="h-3.5 w-3.5 text-red-500" />
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <span className={`font-medium text-sm ${emptyClass ?? ""}`}>{displayValue}</span>
      {canEdit && (
        <Button size="icon" variant="ghost" className="h-5 w-5 opacity-30 hover:opacity-100" onClick={() => setEditing(true)}>
          <Pencil className="h-3 w-3" />
        </Button>
      )}
    </div>
  );
}
