"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  LayoutDashboard,
  FileText,
  Users,
  BookOpen,
  LogOut,
  ShieldCheck,
  Upload,
  LayoutTemplate,
  BarChart3,
  BarChart2,
  CalendarClock,
  ChevronRight,
  Gauge,
  ClipboardList,
  ClipboardCheck,
} from "lucide-react";
import { Usuario } from "@/types/database";

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  adminOnly?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/items", label: "Documentos", icon: FileText },
  { href: "/procedimientos", label: "Procedimientos", icon: ClipboardList },
  { href: "/auditorias", label: "Auditorías", icon: ClipboardCheck },
  { href: "/vencimientos", label: "Vencimientos", icon: CalendarClock },
  { href: "/calibracion", label: "Calibración", icon: Gauge },
  { href: "/indicadores", label: "Indicadores", icon: BarChart2 },
  { href: "/items/importar", label: "Importar Excel", icon: Upload },
];

const ADMIN_NAV_ITEMS: NavItem[] = [
  { href: "/admin/usuarios", label: "Usuarios", icon: Users, adminOnly: true },
  { href: "/admin/clausulas", label: "Cláusulas ISO", icon: BookOpen, adminOnly: true },
  { href: "/admin/reportes", label: "Reportes", icon: BarChart3, adminOnly: true },
];

const CONFIG_NAV_ITEMS: NavItem[] = [
  { href: "/configuracion/plantillas", label: "Plantillas", icon: LayoutTemplate },
];

interface SidebarProps {
  usuario: Usuario;
}

export function Sidebar({ usuario }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const isAdmin = usuario.rol === "admin";

  return (
    <aside className="flex flex-col w-64 min-h-screen bg-slate-900 text-slate-100 border-r border-slate-800">
      <div className="flex items-center gap-3 px-5 py-5 border-b border-slate-800">
        <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-primary shrink-0">
          <ShieldCheck className="w-5 h-5 text-white" />
        </div>
        <div className="overflow-hidden">
          <p className="font-semibold text-sm leading-tight truncate">Sistema de Calidad</p>
          <p className="text-xs text-slate-400 leading-tight">Griffo S.R.L.</p>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <NavSection items={NAV_ITEMS} pathname={pathname} />

        {isAdmin && (
          <>
            <Separator className="my-3 bg-slate-800" />
            <p className="px-2 py-1 text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Administración
            </p>
            <NavSection items={ADMIN_NAV_ITEMS} pathname={pathname} />
          </>
        )}

        <Separator className="my-3 bg-slate-800" />
        <p className="px-2 py-1 text-xs font-semibold text-slate-500 uppercase tracking-wider">
          Configuración
        </p>
        <NavSection items={CONFIG_NAV_ITEMS} pathname={pathname} />
      </nav>

      <div className="px-3 py-4 border-t border-slate-800 space-y-2">
        <div className="flex items-center gap-3 px-2 py-2 rounded-lg bg-slate-800">
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-white text-xs font-semibold shrink-0">
            {usuario.nombre.slice(0, 2).toUpperCase()}
          </div>
          <div className="overflow-hidden flex-1">
            <p className="text-sm font-medium truncate">{usuario.nombre}</p>
            <p className="text-xs text-slate-400 capitalize">{usuario.rol}</p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleLogout}
          className="w-full justify-start text-slate-400 hover:text-slate-100 hover:bg-slate-800"
        >
          <LogOut className="mr-2 h-4 w-4" />
          Cerrar sesión
        </Button>
      </div>
    </aside>
  );
}

function NavSection({ items, pathname }: { items: NavItem[]; pathname: string }) {
  return (
    <>
      {items.map((item) => {
        const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
        const Icon = item.icon;
        return (
          <Link key={item.href} href={item.href}>
            <span
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
                isActive
                  ? "bg-primary text-white"
                  : "text-slate-300 hover:bg-slate-800 hover:text-slate-100"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {item.label}
              {isActive && <ChevronRight className="ml-auto h-3 w-3 opacity-60" />}
            </span>
          </Link>
        );
      })}
    </>
  );
}
