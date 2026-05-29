"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, FileText, Loader2 } from "lucide-react";
import { Item } from "@/types/database";
import { TIPO_ITEM_LABELS, ESTADO_COLORS, ESTADO_LABELS } from "@/lib/constants/items";
import { cn } from "@/lib/utils";

export function GlobalSearch() {
  const router = useRouter();
  const supabase = createClient();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen(true);
      }
    }
    function handleOpen() { setOpen(true); }
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("open-global-search", handleOpen);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("open-global-search", handleOpen);
    };
  }, []);

  useEffect(() => {
    if (open) {
      const t = setTimeout(() => inputRef.current?.focus(), 80);
      return () => clearTimeout(t);
    } else {
      setQuery("");
      setResults([]);
    }
  }, [open]);

  const search = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); return; }
    setLoading(true);
    const { data } = await supabase
      .from("items")
      .select("*")
      .or(`titulo.ilike.%${q}%,codigo.ilike.%${q}%,codigo_completo.ilike.%${q}%,codigo_formal.ilike.%${q}%,descripcion.ilike.%${q}%`)
      .eq("es_borrador", false)
      .limit(8);
    setResults(data || []);
    setSelectedIndex(0);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    const timer = setTimeout(() => search(query), 200);
    return () => clearTimeout(timer);
  }, [query, search]);

  function handleSelect(item: Item) {
    router.push(`/items/${item.id}`);
    setOpen(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && results[selectedIndex]) {
      handleSelect(results[selectedIndex]);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        className="p-0 max-w-xl gap-0 overflow-hidden"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className="flex items-center border-b px-4">
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <Input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Buscar por código, título, descripción..."
            className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0 text-base"
          />
          {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground shrink-0" />}
        </div>

        {results.length > 0 && (
          <ul className="max-h-80 overflow-y-auto py-2">
            {results.map((item, i) => (
              <li key={item.id}>
                <button
                  onClick={() => handleSelect(item)}
                  className={cn(
                    "w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted transition-colors",
                    i === selectedIndex && "bg-muted"
                  )}
                >
                  <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 overflow-hidden">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-muted-foreground">{item.codigo}</span>
                      <Badge variant={ESTADO_COLORS[item.estado] as Parameters<typeof Badge>[0]["variant"]} className="text-[10px] py-0">
                        {ESTADO_LABELS[item.estado]}
                      </Badge>
                    </div>
                    <p className="text-sm font-medium truncate">{item.titulo}</p>
                    <p className="text-xs text-muted-foreground">{TIPO_ITEM_LABELS[item.tipo]}</p>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}

        {query && !loading && results.length === 0 && (
          <div className="py-10 text-center text-sm text-muted-foreground">
            No se encontraron documentos para &ldquo;{query}&rdquo;
          </div>
        )}

        {!query && (
          <div className="py-6 text-center text-xs text-muted-foreground">
            Escribí para buscar · <kbd className="font-mono">↑↓</kbd> navegar · <kbd className="font-mono">Enter</kbd> abrir · <kbd className="font-mono">Esc</kbd> cerrar
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
