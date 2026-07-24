"use client";

import { useState, useMemo } from "react";
import { useApi } from "@/lib/api-store";
import type { ApiKasMutasi, ApiKasBiaya } from "@/lib/api-types";
import { Wallet, ArrowUpRight, ArrowDownRight, TrendingUp, TrendingDown, DollarSign } from "lucide-react";

export default function KasPage() {
  const { items: mutasis } = useApi<ApiKasMutasi>("kas-mutasi");
  const { items: biayas } = useApi<ApiKasBiaya>("kas-biaya");
  const [limit] = useState(10);
  const [showAll, setShowAll] = useState(false);

  const totalMasuk = useMemo(() => mutasis.filter((m) => m.type === "masuk").reduce((s, m) => s + m.amount, 0), [mutasis]);
  const totalKeluar = useMemo(() => mutasis.filter((m) => m.type === "keluar").reduce((s, m) => s + m.amount, 0), [mutasis]);
  const saldo = totalMasuk - totalKeluar;

  const sorted = useMemo(() => [...mutasis].sort((a, b) => new Date(b.tanggal).getTime() - new Date(a.tanggal).getTime()), [mutasis]);
  const displayed = showAll ? sorted : sorted.slice(0, limit);

  const summaryByBiaya = useMemo(() => {
    const map = new Map<string, { name: string; type: string; total: number; count: number }>();
    mutasis.forEach((m) => {
      const key = m.biayaId || "__no_category";
      const name = m.biayaId ? (biayas.find((b) => b.id === m.biayaId)?.name || "Tanpa Kategori") : "Tanpa Kategori";
      if (!map.has(key)) map.set(key, { name, type: m.type, total: 0, count: 0 });
      const entry = map.get(key)!;
      entry.total += m.amount;
      entry.count += 1;
    });
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [mutasis, biayas]);

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Kas PB</h1>
        <p className="mt-0.5 text-sm text-gray-500">Ringkasan keuangan {mutasis.length} transaksi</p>
      </div>

      <div className="mb-6 grid grid-cols-3 gap-3 sm:gap-4">
        <div className="rounded-2xl border border-green-200 bg-green-50 p-4 sm:p-5">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-green-600" />
            <p className="text-xs font-medium text-green-600">Total Pemasukan</p>
          </div>
          <p className="mt-2 text-2xl font-bold text-green-700">Rp {totalMasuk.toLocaleString("id-ID")}</p>
        </div>
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 sm:p-5">
          <div className="flex items-center gap-2">
            <TrendingDown className="h-4 w-4 text-red-600" />
            <p className="text-xs font-medium text-red-600">Total Pengeluaran</p>
          </div>
          <p className="mt-2 text-2xl font-bold text-red-700">Rp {totalKeluar.toLocaleString("id-ID")}</p>
        </div>
        <div className={`rounded-2xl border p-4 sm:p-5 ${saldo >= 0 ? "border-[#0d9488] bg-[#f0fdfa]" : "border-red-300 bg-red-50"}`}>
          <div className="flex items-center gap-2">
            <DollarSign className={`h-4 w-4 ${saldo >= 0 ? "text-[#0d9488]" : "text-red-600"}`} />
            <p className="text-xs font-medium text-gray-600">Saldo</p>
          </div>
          <p className={`mt-2 text-2xl font-bold ${saldo >= 0 ? "text-[#0d9488]" : "text-red-600"}`}>Rp {saldo.toLocaleString("id-ID")}</p>
        </div>
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5 shadow-sm">
          <h2 className="mb-3 text-sm font-bold text-gray-700">Pemasukan per Kategori</h2>
          {summaryByBiaya.filter((s) => s.type === "masuk").length === 0 ? (
            <p className="py-4 text-center text-sm text-gray-400">Belum ada data</p>
          ) : (
            <div className="space-y-2">
              {summaryByBiaya.filter((s) => s.type === "masuk").map((s) => (
                <div key={s.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ArrowUpRight className="h-3.5 w-3.5 text-green-500" />
                    <span className="text-sm text-gray-700">{s.name}</span>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-green-600">Rp {s.total.toLocaleString("id-ID")}</p>
                    <p className="text-[10px] text-gray-400">{s.count}x transaksi</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5 shadow-sm">
          <h2 className="mb-3 text-sm font-bold text-gray-700">Pengeluaran per Kategori</h2>
          {summaryByBiaya.filter((s) => s.type === "keluar").length === 0 ? (
            <p className="py-4 text-center text-sm text-gray-400">Belum ada data</p>
          ) : (
            <div className="space-y-2">
              {summaryByBiaya.filter((s) => s.type === "keluar").map((s) => (
                <div key={s.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ArrowDownRight className="h-3.5 w-3.5 text-red-500" />
                    <span className="text-sm text-gray-700">{s.name}</span>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-red-600">Rp {s.total.toLocaleString("id-ID")}</p>
                    <p className="text-[10px] text-gray-400">{s.count}x transaksi</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-100 px-5 py-4">
          <h2 className="text-sm font-bold text-gray-700">Transaksi Terbaru</h2>
        </div>
        {sorted.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <Wallet className="mx-auto h-8 w-8 text-gray-300" />
            <p className="mt-2 text-sm text-gray-500">Belum ada transaksi</p>
          </div>
        ) : (
          <>
            {displayed.map((m) => (
              <div key={m.id} className="flex items-center justify-between border-b border-gray-50 px-5 py-3 last:border-0">
                <div className="flex items-center gap-3">
                  <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${m.type === "masuk" ? "bg-green-100" : "bg-red-100"}`}>
                    {m.type === "masuk" ? <ArrowUpRight className="h-4 w-4 text-green-600" /> : <ArrowDownRight className="h-4 w-4 text-red-600" />}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{m.description}</p>
                    <p className="text-xs text-gray-400">{new Date(m.tanggal).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}</p>
                  </div>
                </div>
                <span className={`text-sm font-bold ${m.type === "masuk" ? "text-green-600" : "text-red-600"}`}>
                  {m.type === "masuk" ? "+" : "-"} Rp {m.amount.toLocaleString("id-ID")}
                </span>
              </div>
            ))}
            {sorted.length > limit && (
              <button onClick={() => setShowAll(!showAll)} className="w-full px-5 py-3 text-center text-sm font-medium text-[#0d9488] hover:bg-gray-50 transition-colors">
                {showAll ? "Tampilkan lebih sedikit" : `Tampilkan ${sorted.length - limit} transaksi lagi`}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}