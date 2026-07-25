"use client";

import { useState, useMemo } from "react";
import { useApi } from "@/lib/api-store";
import type { ApiLabaRugi, ApiSchedule } from "@/lib/api-types";
import { FileText, ChevronDown, ChevronUp, TrendingUp, TrendingDown, DollarSign, Target, Receipt, Filter } from "lucide-react";

const monthNames = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

function formatRupiah(n: number) {
  return "Rp" + n.toLocaleString("id-ID");
}

function getMonthKey(d: string) {
  const dt = new Date(d);
  return dt.getFullYear() + "-" + String(dt.getMonth() + 1).padStart(2, "0");
}

function getMonthLabel(key: string) {
  const [y, m] = key.split("-");
  return monthNames[parseInt(m) - 1] + " " + y;
}

export default function LaporanPage() {
  const { items: labaRugis } = useApi<ApiLabaRugi>("laba-rugi");
  const { items: schedules } = useApi<ApiSchedule>("schedules");

  const now = new Date();
  const [yearFilter, setYearFilter] = useState(now.getFullYear().toString());

  const years = useMemo(() => {
    const s = new Set<string>();
    labaRugis.forEach((l) => {
      if (l.schedule) s.add(new Date(l.schedule.date).getFullYear().toString());
    });
    return Array.from(s).sort().reverse();
  }, [labaRugis]);

  const monthlyData = useMemo(() => {
    const map = new Map<string, { count: number; totalIncome: number; totalCock: number; totalCourt: number; totalProfit: number; items: ApiLabaRugi[] }>();

    labaRugis.forEach((lr) => {
      if (!lr.schedule) return;
      const year = new Date(lr.schedule.date).getFullYear().toString();
      if (yearFilter && year !== yearFilter) return;
      const key = getMonthKey(lr.schedule.date);
      const existing = map.get(key) || { count: 0, totalIncome: 0, totalCock: 0, totalCourt: 0, totalProfit: 0, items: [] };
      existing.count++;
      existing.totalIncome += lr.totalIncome;
      existing.totalCock += lr.cockCost;
      existing.totalCourt += lr.courtCost;
      existing.totalProfit += lr.profitLoss;
      existing.items.push(lr);
      map.set(key, existing);
    });

    return Array.from(map.entries())
      .map(([key, data]) => ({ key, ...data }))
      .sort((a, b) => b.key.localeCompare(a.key));
  }, [labaRugis, yearFilter]);

  const totals = useMemo(() => {
    return monthlyData.reduce(
      (acc, m) => ({
        totalIncome: acc.totalIncome + m.totalIncome,
        totalCock: acc.totalCock + m.totalCock,
        totalCourt: acc.totalCourt + m.totalCourt,
        totalProfit: acc.totalProfit + m.totalProfit,
        count: acc.count + m.count,
      }),
      { totalIncome: 0, totalCock: 0, totalCourt: 0, totalProfit: 0, count: 0 }
    );
  }, [monthlyData]);

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><FileText className="h-6 w-6 text-[var(--color-primary)]" /> Laporan Laba Rugi</h1>
          <p className="mt-0.5 text-sm text-gray-500">Rekap laba rugi per bulan</p>
        </div>
        <select value={yearFilter} onChange={(e) => setYearFilter(e.target.value)}
          className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm shadow-sm focus:border-[var(--color-primary)]">
          {years.length === 0 && <option value={now.getFullYear().toString()}>{now.getFullYear()}</option>}
          {years.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      {monthlyData.length > 0 && (
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-2xl border border-gray-200 bg-white p-4">
            <p className="text-xs text-gray-500">Total Jadwal</p>
            <p className="mt-1 text-xl font-bold text-gray-900">{totals.count}</p>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-4">
            <p className="text-xs text-gray-500">Pemasukan</p>
            <p className="mt-1 text-xl font-bold text-green-600">{formatRupiah(totals.totalIncome)}</p>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-4">
            <p className="text-xs text-gray-500">Pengeluaran</p>
            <p className="mt-1 text-xl font-bold text-orange-600">{formatRupiah(totals.totalCock + totals.totalCourt)}</p>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-4">
            <p className="text-xs text-gray-500">Laba / Rugi</p>
            <p className={`mt-1 text-xl font-bold ${totals.totalProfit >= 0 ? "text-green-600" : "text-red-600"}`}>
              {totals.totalProfit >= 0 ? "+" : ""}{formatRupiah(totals.totalProfit)}
            </p>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {monthlyData.map((m) => (
          <div key={m.key} className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
            <div className="flex items-center justify-between bg-gray-50 px-5 py-3 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">{getMonthLabel(m.key)}</h3>
              <span className="text-xs text-gray-400">{m.count} jadwal</span>
            </div>
            <div className="grid grid-cols-2 gap-4 p-5 sm:grid-cols-4">
              <div>
                <p className="text-xs text-gray-500 flex items-center gap-1"><DollarSign className="h-3 w-3" /> Pemasukan</p>
                <p className="mt-0.5 text-sm font-bold text-green-600">{formatRupiah(m.totalIncome)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 flex items-center gap-1"><Target className="h-3 w-3" /> Cock</p>
                <p className="mt-0.5 text-sm font-bold text-gray-700">{formatRupiah(m.totalCock)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 flex items-center gap-1"><Receipt className="h-3 w-3" /> Lapangan</p>
                <p className="mt-0.5 text-sm font-bold text-gray-700">{formatRupiah(m.totalCourt)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 flex items-center gap-1">{m.totalProfit >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />} Laba / Rugi</p>
                <p className={`mt-0.5 text-sm font-bold ${m.totalProfit >= 0 ? "text-green-600" : "text-red-600"}`}>
                  {m.totalProfit >= 0 ? "+" : ""}{formatRupiah(m.totalProfit)}
                </p>
              </div>
            </div>
          </div>
        ))}
        {monthlyData.length === 0 && (
          <div className="rounded-2xl border border-gray-200 bg-white p-10 text-center">
            <FileText className="mx-auto h-10 w-10 text-gray-300" />
            <p className="mt-3 text-sm text-gray-500">Belum ada data laba rugi untuk tahun ini</p>
          </div>
        )}
      </div>
    </div>
  );
}
