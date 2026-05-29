"use client";

import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSearch } from "./search-context";

interface TopbarProps {
  title: string;
  actions?: React.ReactNode;
}

export function Topbar({ title, actions }: TopbarProps) {
  const { setOpen } = useSearch();

  return (
    <header className="h-14 border-b bg-white flex items-center px-6 gap-4 shrink-0">
      <h1 className="text-lg font-semibold flex-1">{title}</h1>

      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="hidden sm:flex items-center gap-2 text-muted-foreground"
      >
        <Search className="h-4 w-4" />
        <span className="text-sm">Buscar...</span>
        <kbd className="ml-2 pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
          <span className="text-xs">⌘</span>K
        </kbd>
      </Button>

      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </header>
  );
}
