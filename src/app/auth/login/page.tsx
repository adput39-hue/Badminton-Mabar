"use client";

import { useState, useEffect } from "react";
import { Mail, Lock, Eye, EyeOff } from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [bg, setBg] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/config?key=login_background").then((r) => r.json()).then((d) => { if (d.value) setBg(d.value); }).catch(() => {});
  }, []);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError("");
    try {
      const res = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Login gagal"); setLoading(false); return; }
      localStorage.setItem("user", JSON.stringify(data.user));
      window.location.href = "/dashboard";
    } catch {
      setError("Terjadi kesalahan. Coba lagi.");
      setLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-[#d1f0ed] via-[#e8faf8] to-[#c4ebe7] px-4"
      style={bg ? { backgroundImage: `url(${bg})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}}>
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {bg && <div className="absolute inset-0 bg-black/10" />}
        {!bg && (
          <>
            <div className="absolute -left-40 top-1/3 w-[500px] h-[500px] rounded-full border border-white/30 opacity-40" />
            <div className="absolute -left-20 top-1/2 w-[400px] h-[400px] rounded-full border border-white/20 opacity-30" />
            <div className="absolute -right-40 bottom-1/4 w-[500px] h-[500px] rounded-full border border-white/30 opacity-40" />
            <div className="absolute -right-20 bottom-1/3 w-[350px] h-[350px] rounded-full border border-white/20 opacity-25" />
            <div className="absolute top-0 right-0 w-1/3 h-1/3 bg-gradient-to-bl from-white/40 to-transparent" />
            <div className="absolute bottom-0 left-0 w-1/3 h-1/3 bg-gradient-to-tr from-white/30 to-transparent" />
          </>
        )}
      </div>

      <div className="relative w-full max-w-sm">
        <div className="mb-3 text-center">
          <h2 className="text-2xl font-bold text-gray-900">Masuk ke Akun</h2>
          <p className="mt-1.5 text-sm text-gray-500">Masuk sebagai admin PB</p>
        </div>

        <div className="rounded-2xl bg-white p-8 shadow-xl shadow-gray-200/40">
          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700">Email</label>
              <div className="relative mt-1.5">
                <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
                  className="w-full rounded-xl border border-gray-200 py-3 pl-10 pr-4 text-sm text-gray-900 placeholder:text-gray-400 shadow-sm focus:border-[#0d9488] focus:ring-2 focus:ring-[#0d9488]/10"
                  placeholder="email@example.com" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Password</label>
              <div className="relative mt-1.5">
                <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input type={showPw ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} required
                  className="w-full rounded-xl border border-gray-200 py-3 pl-10 pr-10 text-sm text-gray-900 placeholder:text-gray-400 shadow-sm focus:border-[#0d9488] focus:ring-2 focus:ring-[#0d9488]/10"
                  placeholder="••••••••" />
                <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            {error && <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>}
            <button type="submit" disabled={loading}
              className="w-full rounded-xl bg-[#0d9488] py-3 text-sm font-semibold text-white shadow-sm transition-all hover:bg-[#0f766e] hover:shadow-md disabled:opacity-50">
              {loading ? "Memuat..." : "Masuk"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
