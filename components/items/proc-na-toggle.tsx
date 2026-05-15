"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Loader2, Undo2 } from "lucide-react";

export function ProcNaToggle({ itemId, value }: { itemId: string; value: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function toggle() {
    setLoading(true);
    await fetch(`/api/items/${itemId}/quick-edit`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ procedimiento_na: !value }),
    });
    setLoading(false);
    router.refresh();
  }

  if (value) {
    return (
      <div className="flex items-center justify-between px-3 py-2 bg-green-50 border border-green-200 rounded-lg">
        <span className="text-sm text-green-700 font-medium flex items-center gap-1.5">
          <CheckCircle2 className="h-4 w-4" />
          No corresponde
        </span>
        <Button size="sm" variant="ghost" className="h-7 text-xs text-muted-foreground" onClick={toggle} disabled={loading}>
          {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <><Undo2 className="h-3 w-3 mr-1" />Deshacer</>}
        </Button>
      </div>
    );
  }

  return (
    <Button size="sm" variant="outline" className="w-full text-xs" onClick={toggle} disabled={loading}>
      {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
      No corresponde para este documento
    </Button>
  );
}
