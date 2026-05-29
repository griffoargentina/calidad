"use client";

import { Sidebar } from "./sidebar";
import { SearchProvider } from "./search-context";
import { GlobalSearch } from "@/components/shared/global-search";
import { Usuario } from "@/types/database";

interface AppShellProps {
  usuario: Usuario;
  children: React.ReactNode;
}

export function AppShell({ usuario, children }: AppShellProps) {
  return (
    <SearchProvider>
      <div className="flex h-screen overflow-hidden bg-slate-50">
        <Sidebar usuario={usuario} />
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
        <GlobalSearch />
      </div>
    </SearchProvider>
  );
}
