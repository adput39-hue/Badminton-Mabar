"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Mail, Lock, Eye, EyeOff, Shield } from "lucide-react";

export default function AdminLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPw, setShowPw] = useState(false);
  const router = useRouter();

  useEffect(() => {
    try {
      const raw = localStorage.getItem("user");
      if (raw) {
        const u = JSON.parse(raw);
        if (u.role === "superadmin") router.replace("/admin");
      }
    } catch {}
  }, [router]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Login gagal"); setLoading(false); return; }
      if (data.user.role !== "superadmin") {
        setError("Akses ditolak. Hanya Super Admin yang bisa masuk ke panel ini.");
        setLoading(false);
        return;
      }
      localStorage.setItem("user", JSON.stringify(data.user));
      router.push("/admin");
    } catch {
      setError("Terjadi kesalahan. Coba lagi.");
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#ccfbf1] via-white to-[#ccfbf1] px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <Link href="/" className="inline-flex items-center gap-2">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#0d9488] text-2xl shadow-lg shadow-[#0d9488]/20">🏸</div>
            <div className="text-left">
              <p className="text-lg font-bold text-gray-900">Admin Panel</p>
              <p className="text-xs text-[#0d9488] font-medium">Master PB</p>
            </div>
          </Link>
          <h2 className="mt-6 text-lg font-semibold text-gray-900">Masuk ke Admin Panel</h2>
          <p className="mt-1 text-sm text-gray-500">Khusus Super Admin</p>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-xl shadow-gray-100">
          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700">Email</label>
              <div className="relative mt-1.5">
                <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
                  className="w-full rounded-xl border border-gray-200 py-2.5 pl-10 pr-4 text-sm text-gray-900 placeholder:text-gray-400 shadow-sm focus:border-[#0d9488] focus:ring-2 focus:ring-[#0d9488]/10"
                  placeholder="admin@badminton.com" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Password</label>
              <div className="relative mt-1.5">
                <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input type={showPw ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} required
                  className="w-full rounded-xl border border-gray-200 py-2.5 pl-10 pr-10 text-sm text-gray-900 placeholder:text-gray-400 shadow-sm focus:border-[#0d9488] focus:ring-2 focus:ring-[#0d9488]/10"
                  placeholder="••••••••" />
                <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            {error && <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>}
            <button type="submit" disabled={loading}
              className="w-full rounded-xl bg-[#0d9488] py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-[#0f766e] hover:shadow-md disabled:opacity-50">
              {loading ? "Memuat..." : "Masuk ke Admin"}
            </button>
          </form>
          <div className="mt-4 text-center">
            <Link href="/auth/login" className="text-xs text-gray-400 hover:text-[#0d9488]">← Masuk sebagai Admin PB</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
