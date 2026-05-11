"use client";

import { useState, useEffect } from "react";
import { Sidebar } from "./sidebar";
import { GlobalSearch } from "@/components/shared/global-search";
import { Usuario } from "@/types/database";

interface AppShellProps {
  usuario: Usuario;
  children: React.ReactNode;
}

export function AppShell({ usuario, children }: AppShellProps) {
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      <Sidebar usuario={usuario} />
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
      <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
}
