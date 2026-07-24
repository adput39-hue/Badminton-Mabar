"use client";

import { useState, useEffect, useCallback } from "react";
import { useApi } from "@/lib/api-store";
import type { ApiMember } from "@/lib/api-types";
import Link from "next/link";
import { BookOpen, Search, Pencil, X, Save, Mars, Venus } from "lucide-react";
import { getClientPbId } from "@/lib/tenant";

interface HutangRekap {
  memberId: string;
  memberName: string;
  memberClass: string;
  gender: string | null;
  saldoAwal: number;
  totalUnpaidHtm: number;
  totalDebt: number;
}

export default function HutangPage() {
  const [data, setData] = useState<HutangRekap[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [editSaldo, setEditSaldo] = useState<string | null>(null);
  const [saldoValue, setSaldoValue] = useState("");
  const { update: updateMember } = useApi<ApiMember>("members");

  const fetchData = useCallback(async () => {
    const pbId = getClientPbId();
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (pbId) headers["x-pb-id"] = pbId;
    try {
      const res = await fetch("/api/hutang", { headers });
      if (res.ok) setData(await res.json());
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  async function saveSaldoAwal(memberId: string) {
    const amount = parseInt(saldoValue) || 0;
    await updateMember(memberId, { saldoAwalHutang: amount });
    setData((prev) => prev.map((d) => d.memberId === memberId ? { ...d, saldoAwal: amount, totalDebt: amount + d.totalUnpaidHtm } : d));
    setEditSaldo(null);
  }

  const filtered = data.filter((d) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return d.memberName.toLowerCase().includes(q);
  });

  const totalHutang = data.reduce((sum, d) => sum + d.totalDebt, 0);

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Kartu Hutang Anggota</h1>
          <p className="mt-0.5 text-sm text-gray-500">
            {data.length} anggota dengan total hutang <strong className="text-red-600">Rp {totalHutang.toLocaleString("id-ID")}</strong>
          </p>
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari anggota..." className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 pl-10 text-sm shadow-sm focus:border-[#0d9488] focus:ring-2 focus:ring-[#0d9488]/10" />
        </div>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-gray-200 bg-white px-6 py-16 text-center shadow-sm">
          <p className="text-sm text-gray-400">Memuat...</p>
        </div>
      ) : data.length === 0 ? (
        <div className="rounded-2xl border border-gray-200 bg-white px-6 py-16 text-center shadow-sm">
          <BookOpen className="mx-auto h-10 w-10 text-gray-300" />
          <p className="mt-3 text-sm text-gray-500">Belum ada data hutang anggota</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/80 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                <th className="px-5 py-3">Anggota</th>
                <th className="px-5 py-3 text-right">Saldo Awal</th>
                <th className="px-5 py-3 text-right hidden sm:table-cell">HTM Belum Bayar</th>
                <th className="px-5 py-3 text-right">Total Hutang</th>
                <th className="px-5 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((d) => (
                <tr key={d.memberId} className="transition-colors hover:bg-gray-50/50">
                  <td className="px-5 py-3">
                    <Link href={`/hutang/${d.memberId}`} className="flex items-center gap-2.5 group">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-xs font-bold text-gray-600 group-hover:bg-[#0d9488]/10 group-hover:text-[#0d9488] transition-colors">
                        {d.gender === "L" ? (
                          <Mars className="h-4 w-4 text-blue-500" />
                        ) : d.gender === "P" ? (
                          <Venus className="h-4 w-4 text-pink-500" />
                        ) : (
                          d.memberName.charAt(0)
                        )}
                      </span>
                      <div>
                        <p className="font-medium text-gray-900 group-hover:text-[#0d9488] transition-colors">{d.memberName}</p>
                        <p className="text-xs text-gray-400">{d.memberClass}</p>
                      </div>
                    </Link>
                  </td>
                  <td className="px-5 py-3 text-right">
                    {editSaldo === d.memberId ? (
                      <div className="inline-flex items-center gap-1">
                        <input type="number" value={saldoValue} onChange={(e) => setSaldoValue(e.target.value)} className="w-24 rounded-lg border border-gray-200 px-2 py-1 text-right text-sm" />
                        <button onClick={() => saveSaldoAwal(d.memberId)} className="rounded-lg p-1 text-[#0d9488] hover:bg-[#ccfbf1]"><Save className="h-3.5 w-3.5" /></button>
                        <button onClick={() => setEditSaldo(null)} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100"><X className="h-3.5 w-3.5" /></button>
                      </div>
                    ) : d.saldoAwal > 0 ? (
                      <span className="font-medium text-gray-900">Rp {d.saldoAwal.toLocaleString("id-ID")}</span>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-right hidden sm:table-cell">
                    {d.totalUnpaidHtm > 0 ? (
                      <span className="font-medium text-gray-900">Rp {d.totalUnpaidHtm.toLocaleString("id-ID")}</span>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-right">
                    {d.totalDebt > 0 ? (
                      <span className="inline-block rounded-full bg-red-50 px-3 py-0.5 text-xs font-bold text-red-600">Rp {d.totalDebt.toLocaleString("id-ID")}</span>
                    ) : (
                      <span className="inline-block rounded-full bg-green-50 px-3 py-0.5 text-xs font-medium text-green-600">Lunas</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => { setEditSaldo(d.memberId); setSaldoValue(String(d.saldoAwal)); }} className="rounded-lg p-1.5 text-gray-400 hover:bg-blue-50 hover:text-blue-600" title="Edit Saldo Awal">
                        <Pencil className="h-4 w-4" />
                      </button>
                      <Link href={`/hutang/${d.memberId}`} className="rounded-lg px-3 py-1.5 text-xs font-medium text-[#0d9488] hover:bg-[#ccfbf1]">
                        Detail
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}