import {
  Home, Users, Heart, Swords, Calendar, Wallet, BarChart3, FileText, Settings, Trophy, Monitor, Shield, UserCog, DollarSign, ArrowUpRight, Tag, BookOpen, TrendingUp, Target, Grid3X3, QrCode,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  menuKey: string;
  color: string;
  desc?: string;
}

export const allNavItems: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: Home, menuKey: "dashboard", color: "bg-gradient-to-br from-indigo-500 to-indigo-600", desc: "Ringkasan kegiatan PB" },
  { href: "/members", label: "Anggota", icon: Users, menuKey: "members", color: "bg-gradient-to-br from-sky-500 to-sky-600", desc: "Kelola data anggota" },
  { href: "/schedules", label: "Jadwal", icon: Calendar, menuKey: "schedules", color: "bg-gradient-to-br from-emerald-500 to-emerald-600", desc: "Atur jadwal main" },
  { href: "/mabar", label: "Mabar", icon: Heart, menuKey: "mabar", color: "bg-gradient-to-br from-rose-500 to-rose-600", desc: "Main bareng seru" },
  { href: "/qr-absen", label: "QR Absen", icon: QrCode, menuKey: "qr-absen", color: "bg-gradient-to-br from-violet-500 to-violet-600", desc: "Absensi via QR Code" },
  { href: "/papan-lapangan", label: "Papan Lapangan", icon: Grid3X3, menuKey: "papan-lapangan", color: "bg-gradient-to-br from-teal-500 to-teal-600", desc: "Pantau lapangan aktif" },
  { href: "/sparing", label: "Sparing", icon: Swords, menuKey: "sparing", color: "bg-gradient-to-br from-orange-500 to-orange-600", desc: "Atur sparing match" },
  { href: "/league", label: "League", icon: Trophy, menuKey: "turnamen", color: "bg-gradient-to-br from-amber-500 to-amber-600", desc: "Turnamen & liga" },
  { href: "/riwayat", label: "Riwayat", icon: Trophy, menuKey: "riwayat", color: "bg-gradient-to-br from-slate-500 to-slate-600", desc: "Lihat riwayat match" },
  { href: "/sparing/match", label: "Match", icon: Swords, menuKey: "sparing", color: "bg-gradient-to-br from-fuchsia-500 to-fuchsia-600", desc: "Kelola match sparing" },
  { href: "/scoreboard", label: "Scoreboard", icon: Monitor, menuKey: "scoreboard", color: "bg-gradient-to-br from-cyan-500 to-cyan-600", desc: "Lihat live scoreboard" },
  { href: "/scoreboard-live", label: "Live Score", icon: Trophy, menuKey: "live-score", color: "bg-gradient-to-br from-pink-500 to-pink-600", desc: "Pantau live score" },
  { href: "/laporan-cock", label: "Lap. Cock", icon: Target, menuKey: "laporan-cock", color: "bg-gradient-to-br from-lime-500 to-lime-600", desc: "Laporan pemakaian cock" },
  { href: "/bayar-htm", label: "Bayar HTM", icon: DollarSign, menuKey: "htm", color: "bg-gradient-to-br from-green-500 to-green-600", desc: "Pembayaran HTM" },
  { href: "/master-biaya", label: "Master Biaya", icon: Tag, menuKey: "master-biaya", color: "bg-gradient-to-br from-red-500 to-red-600", desc: "Kelola master biaya" },
  { href: "/kas-mutasi", label: "Mutasi Kas", icon: ArrowUpRight, menuKey: "kas-mutasi", color: "bg-gradient-to-br from-blue-500 to-blue-600", desc: "Mutasi kas PB" },
  { href: "/kas", label: "Kas PB", icon: Wallet, menuKey: "finances", color: "bg-gradient-to-br from-yellow-500 to-yellow-600", desc: "Saldo kas PB" },
  { href: "/hutang", label: "Kartu Hutang", icon: BookOpen, menuKey: "hutang", color: "bg-gradient-to-br from-purple-500 to-purple-600", desc: "Kelola kartu hutang" },
  { href: "/laba-rugi", label: "Laba Rugi", icon: TrendingUp, menuKey: "laba-rugi", color: "bg-gradient-to-br from-indigo-500 to-blue-600", desc: "Laporan laba rugi" },
  { href: "/laporan", label: "Laporan", icon: FileText, menuKey: "reports", color: "bg-gradient-to-br from-sky-500 to-cyan-600", desc: "Laporan keuangan" },
  { href: "/statistik", label: "Statistik", icon: BarChart3, menuKey: "stats", color: "bg-gradient-to-br from-blue-600 to-indigo-600", desc: "Statistik pemain" },
  { href: "/users", label: "Master User", icon: Shield, menuKey: "users", color: "bg-gradient-to-br from-gray-600 to-gray-700", desc: "Kelola user" },
  { href: "/user-levels", label: "Level Manager", icon: UserCog, menuKey: "user-levels", color: "bg-gradient-to-br from-indigo-600 to-violet-600", desc: "Atur level & hak akses" },
  { href: "/settings", label: "Pengaturan", icon: Settings, menuKey: "settings", color: "bg-gradient-to-br from-stone-500 to-stone-600", desc: "Pengaturan aplikasi" },
];

export interface DashboardUser {
  role?: string;
  level?: { menus: string[] };
}

export function getGrantedNavItems(user: DashboardUser | null): NavItem[] {
  if (!user) return [];
  if (user.role === "superadmin") return allNavItems;
  if (Array.isArray(user.level?.menus)) return allNavItems.filter((item) => user.level!.menus.includes(item.menuKey));
  return allNavItems;
}
