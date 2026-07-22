"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { Building2, Settings, LogOut, Menu, X, Shield, ChevronLeft, ChevronRight, Users, Globe, Phone as PhoneIcon } from "lucide-react";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<{ fullName: string; email: string; role: string } | null>(null);
  const [checked, setChecked] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("user");
      if (raw) {
        const u = JSON.parse(raw);
        if (u.role !== "superadmin") {
          router.replace("/admin/login");
          return;
        }
        setUser(u);
      } else {
        router.replace("/admin/login");
      }
    } catch {
      router.replace("/admin/login");
    }
    setChecked(true);
  }, [router]);

  if (pathname === "/admin/login") return <>{children}</>;

  if (!checked || !user) return <div className="flex min-h-screen items-center justify-center bg-[#f0fdfa]"><div className="h-8 w-8 animate-spin rounded-full border-4 border-[#0d9488] border-t-transparent" /></div>;

  function logout() {
    localStorage.removeItem("user");
    router.replace("/admin/login");
  }

  const navItems = [
    { href: "/admin", label: "PB Dashboard", icon: Building2 },
  ];

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");

  return (
    <div className="flex min-h-screen bg-[#f0fdfa]">
      {mobileOpen && <div className="fixed inset-0 z-40 bg-black/40 lg:hidden" onClick={() => setMobileOpen(false)} />}

      <aside className={`fixed inset-y-0 left-0 z-50 flex flex-col border-r border-gray-200 bg-white transition-all duration-300 lg:static lg:translate-x-0 ${mobileOpen ? "translate-x-0" : "-translate-x-full"} ${collapsed ? "w-16" : "w-60"}`}>
        <div className="flex items-center gap-3 border-b border-gray-100 px-5 py-4 min-h-[68px]">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#0d9488] text-xl shrink-0">🏸</div>
          {!collapsed && (
            <div className="overflow-hidden">
              <p className="text-sm font-bold text-gray-900 truncate">Admin Panel</p>
              <p className="text-xs text-[#0d9488] font-medium">Master PB</p>
            </div>
          )}
          <button onClick={() => setCollapsed(!collapsed)} className="ml-auto rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hidden lg:block">{collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}</button>
          <button onClick={() => setMobileOpen(false)} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 lg:hidden"><X className="h-5 w-5" /></button>
        </div>

        <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link key={item.href} href={item.href} onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium transition-all ${collapsed ? "justify-center px-0" : ""} ${
                  isActive(item.href) ? "bg-[#0d9488] text-white shadow-sm" : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                }`}>
                <Icon className="h-4 w-4 shrink-0" />
                {!collapsed && item.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-gray-100 p-3">
          <div className="flex items-center gap-3 rounded-xl px-3 py-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#0d9488] text-xs font-bold text-white shrink-0">
              {user.fullName.charAt(0).toUpperCase()}
            </div>
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-gray-900 truncate">{user.fullName}</p>
                <p className="text-[10px] text-gray-500 truncate">Super Admin</p>
              </div>
            )}
            <button onClick={logout} className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600" title="Logout">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      <div className="flex flex-1 flex-col min-w-0">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-gray-200 bg-white/90 px-4 py-3 backdrop-blur sm:px-6">
          <button onClick={() => setMobileOpen(true)} className="rounded-lg p-2 text-gray-600 hover:bg-gray-100 lg:hidden"><Menu className="h-5 w-5" /></button>
          <div className="flex-1">
            <h1 className="text-lg font-bold text-gray-900">Panel Admin</h1>
          </div>
          <div className="flex items-center gap-2 rounded-xl bg-[#ccfbf1] px-3 py-1.5">
            <Shield className="h-4 w-4 text-[#0d9488]" />
            <span className="text-xs font-semibold text-[#0d9488]">Super Admin</span>
          </div>
          <button onClick={logout} className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 px-4 py-2 text-xs font-medium text-red-600 transition-all hover:bg-red-50 hover:shadow-sm" title="Keluar">
            <LogOut className="h-3.5 w-3.5" /> Keluar
          </button>
        </header>
        <main className="flex-1 p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
