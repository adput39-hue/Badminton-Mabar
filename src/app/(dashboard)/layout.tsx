"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, Menu, X, ChevronLeft, ChevronRight } from "lucide-react";
import { getGrantedNavItems } from "@/lib/nav-items";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<{ fullName: string; role: string; level?: { menus: string[] }; pb?: { id: string; name: string; logoUrl?: string } } | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("user");
      if (raw) setUser(JSON.parse(raw));
    } catch {}
  }, []);

  const navItems = getGrantedNavItems(user);
  function logout() {
    localStorage.removeItem("user");
    router.replace("/auth/login");
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--color-bg)]">
      {mobileOpen && <div className="fixed inset-0 z-40 bg-black opacity-40 2xl:hidden" onClick={() => setMobileOpen(false)} />}

      {/* Floating hamburger for mobile/tablet */}
      <button onClick={() => setMobileOpen(true)} className="fixed top-4 left-4 z-30 rounded-xl bg-white p-2.5 shadow-lg border border-gray-200 2xl:hidden">
        <Menu className="h-5 w-5 text-gray-700" />
      </button>

      <aside className={`fixed inset-y-0 left-0 z-50 flex flex-col border-r border-gray-200 bg-white transition-all duration-300 2xl:static ${mobileOpen ? "max-2xl:[transform:translateX(0%)]" : "max-2xl:[transform:translateX(-100%)]"} ${collapsed ? "w-16" : "w-60"}`}>
        <div className="flex items-center gap-3 border-b border-gray-100 px-5 py-4 min-h-[68px]">
          <div className={`flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl text-xl shrink-0 ${user?.pb?.logoUrl ? "" : "bg-[var(--color-primary)]"}`}>{user?.pb?.logoUrl ? <img src={user.pb.logoUrl} alt="Logo" className="h-full w-full object-cover" /> : <span></span>}</div>
          {!collapsed && (
            <div className="overflow-hidden">
              <p className="text-sm font-bold text-gray-900 truncate">{user?.pb?.name || "PB"}</p>
              <p className="text-xs text-[var(--color-primary)] font-medium">Main Bareng</p>
            </div>
          )}
          <button onClick={() => setCollapsed(!collapsed)} className="ml-auto rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hidden 2xl:block">{collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}</button>
          <button onClick={() => setMobileOpen(false)} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 2xl:hidden"><X className="h-5 w-5" /></button>
        </div>

        <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
          {navItems.length === 0 && !user && (
            <p className="px-4 text-xs text-gray-400 italic">Memuat menu...</p>
          )}
          {navItems.length === 0 && user && (
            <p className="px-4 text-xs text-gray-400 italic">Tidak ada akses menu</p>
          )}
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link key={item.href + item.label} href={item.href} onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium transition-all ${collapsed ? "justify-center px-0" : ""} ${
                  isActive ? "bg-[var(--color-primary)] text-white shadow-sm" : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                }`}>
                <Icon className="h-4 w-4 shrink-0" />
                {!collapsed && item.label}
              </Link>
            );
          })}
        </nav>

        {/* User info + Logout at bottom */}
        <div className="border-t border-gray-100 px-3 py-3">
          {!collapsed && (
            <div className="flex items-center gap-2.5 px-2 py-2 mb-1">
              <div className="h-8 w-8 rounded-full bg-[var(--color-primary)] flex items-center justify-center text-white text-xs font-bold shrink-0">{user ? user.fullName.charAt(0).toUpperCase() : 'A'}</div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-gray-900 truncate">{user?.fullName || 'Admin'}</p>
                <p className="text-[10px] text-gray-500 truncate">{user?.role || 'Admin PB'}</p>
              </div>
            </div>
          )}
          <button onClick={logout} className={`flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 transition-all w-full ${collapsed ? "justify-center px-0" : ""}`}>
            <LogOut className="h-4 w-4 shrink-0" />
            {!collapsed && <span>Keluar</span>}
          </button>
        </div>
      </aside>

      <div className="flex flex-1 flex-col min-w-0 overflow-y-auto">
        <main className="flex-1 p-4 sm:p-6 pt-16 2xl:pt-4">{children}</main>
      </div>
    </div>
  );
}
