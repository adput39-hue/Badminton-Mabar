"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import {
  Home, Users, Heart, Swords, Calendar, Wallet, BarChart3, FileText, Settings, Menu, X, Search, Bell, Trophy, ChevronLeft, ChevronRight, Monitor, Shield, UserCog, DollarSign, ArrowUpRight, Tag,
} from "lucide-react";

const allNavItems = [
  { href: "/dashboard", label: "Dashboard", icon: Home, menuKey: "dashboard" },
  { href: "/members", label: "Anggota", icon: Users, menuKey: "members" },
  { href: "/schedules", label: "Jadwal", icon: Calendar, menuKey: "schedules" },
  { href: "/mabar", label: "Mabar", icon: Heart, menuKey: "mabar" },
  { href: "/riwayat", label: "Riwayat", icon: Trophy, menuKey: "riwayat" },
  { href: "/sparing", label: "Sparing", icon: Swords, menuKey: "sparing" },
  { href: "/sparing/match", label: "Match", icon: Swords, menuKey: "sparing" },
  { href: "/scoreboard", label: "Scoreboard", icon: Monitor, menuKey: "scoreboard" },
  { href: "/scoreboard-live", label: "Live Score", icon: Trophy, menuKey: "live-score" },
  { href: "/bayar-htm", label: "Bayar HTM", icon: DollarSign, menuKey: "htm" },
  { href: "/kas", label: "Kas PB", icon: Wallet, menuKey: "finances" },
  { href: "/kas-mutasi", label: "Mutasi Kas", icon: ArrowUpRight, menuKey: "kas-mutasi" },
  { href: "/master-biaya", label: "Master Biaya", icon: Tag, menuKey: "master-biaya" },
  { href: "/users", label: "Master User", icon: Shield, menuKey: "users" },
  { href: "/user-levels", label: "Level Manager", icon: UserCog, menuKey: "user-levels" },
  { href: "/settings", label: "Statistik", icon: BarChart3, menuKey: "stats" },
  { href: "/settings", label: "Laporan", icon: FileText, menuKey: "reports" },
  { href: "/settings", label: "Pengaturan", icon: Settings, menuKey: "settings" },
];

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

  const grantedMenus = user?.level?.menus;
  const navItems = user?.role === "superadmin"
    ? allNavItems
    : grantedMenus
      ? allNavItems.filter((item) => grantedMenus.includes(item.menuKey))
      : allNavItems;

  function logout() {
    localStorage.removeItem("user");
    router.replace("/auth/login");
  }

  return (
    <div className="flex min-h-screen bg-[#f0fdfa]">
      {mobileOpen && <div className="fixed inset-0 z-40 bg-black/40 lg:hidden" onClick={() => setMobileOpen(false)} />}

      <aside className={`fixed inset-y-0 left-0 z-50 flex flex-col border-r border-gray-200 bg-white transition-all duration-300 lg:static lg:translate-x-0 ${mobileOpen ? "translate-x-0" : "-translate-x-full"} ${collapsed ? "w-16" : "w-60"}`}>
        <div className="flex items-center gap-3 border-b border-gray-100 px-5 py-4 min-h-[68px]">
          <div className={`flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl text-xl shrink-0 ${user?.pb?.logoUrl ? "" : "bg-[#0d9488]"}`}>{user?.pb?.logoUrl ? <img src={user.pb.logoUrl} alt="Logo" className="h-full w-full object-cover" /> : <span></span>}</div>
          {!collapsed && (
            <div className="overflow-hidden">
              <p className="text-sm font-bold text-gray-900 truncate">{user?.pb?.name || "PB"}</p>
              <p className="text-xs text-[#0d9488] font-medium">Main Bareng</p>
            </div>
          )}
          <button onClick={() => setCollapsed(!collapsed)} className="ml-auto rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hidden lg:block">{collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}</button>
          <button onClick={() => setMobileOpen(false)} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 lg:hidden"><X className="h-5 w-5" /></button>
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
                  isActive ? "bg-[#0d9488] text-white shadow-sm" : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                }`}>
                <Icon className="h-4 w-4 shrink-0" />
                {!collapsed && item.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      <div className="flex flex-1 flex-col min-w-0">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-gray-200 bg-white/90 px-4 py-3 backdrop-blur sm:px-6">
          <button onClick={() => setMobileOpen(true)} className="rounded-lg p-2 text-gray-600 hover:bg-gray-100 lg:hidden"><Menu className="h-5 w-5" /></button>
          <div className="flex-1">
            <h1 className="text-lg font-bold text-gray-900 flex items-center gap-2">Dashboard <span className="text-xl">👋</span></h1>
            <p className="text-xs text-gray-500">Selamat datang kembali{user ? `, ${user.fullName}` : ''}</p>
          </div>
          <div className="relative hidden sm:block">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input placeholder="Cari anggota, jadwal, match..." className="w-64 rounded-xl border border-gray-200 bg-gray-50 py-2 pl-10 pr-4 text-sm placeholder:text-gray-400 focus:border-[#0d9488] focus:bg-white" />
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-1.5">
            <div className="h-7 w-7 rounded-full bg-[#0d9488] flex items-center justify-center text-white text-xs font-bold">{user ? user.fullName.charAt(0).toUpperCase() : 'A'}</div>
            <div className="hidden sm:block">
              <p className="text-xs font-semibold text-gray-900">{user?.fullName || 'Admin'}</p>
              <p className="text-[10px] text-gray-500">Admin PB</p>
            </div>
          </div>
          <button onClick={logout} className="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors" title="Keluar">
            <LogOut className="h-4 w-4" />
          </button>
        </header>

        <main className="flex-1 p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
