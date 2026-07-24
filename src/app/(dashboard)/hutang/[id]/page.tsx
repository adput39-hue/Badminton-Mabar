"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { getClientPbId } from "@/lib/tenant";
import { ArrowLeft, Check, Save, Mars, Venus } from "lucide-react";
import Link from "next/link";

interface HutangEntry {
  type: "saldo_awal" | "htm" | "bayar";
  scheduleId?: string;
  title: string;
  tanggal: string;
  amount: number;
}

interface MemberInfo {
  id: string;
  name: string;
  class: string;
  gender: string | null;
  saldoAwalHutang: number | null;
}

export default function HutangDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [member, setMember] = useState<MemberInfo | null>(null);
  const [entries, setEntries] = useState<HutangEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  const fetchDetail = useCallback(async () => {
    const pbId = getClientPbId();
    if (!id) return;
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (pbId) headers["x-pb-id"] = pbId;
    try {
      const res = await fetch(`/api/hutang?memberId=${id}`, { headers });
      if (res.ok) {
        const json = await res.json();
        setMember(json.member);
        setEntries(json.entries);
      }
    } catch {}
    setLoading(false);
  }, [id]);

  useEffect(() => { fetchDetail(); }, [fetchDetail]);

  function toggleSelect(scheduleId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(scheduleId)) next.delete(scheduleId);
      else next.add(scheduleId);
      return next;
    });
  }

  async function bayarSelected() {
    const pbId = getClientPbId();
    if (!pbId || selected.size === 0) return;
    setSaving(true);
    try {
      const res = await fetch("/api/hutang", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-pb-id": pbId },
        body: JSON.stringify({ memberId: id, scheduleIds: Array.from(selected) }),
      });
      if (res.ok) {
        setSelected(new Set());
        await fetchDetail();
      }
    } catch {}
    setSaving(false);
  }

  if (loading) {
    return <div className="mx-auto max-w-3xl px-4 py-8 text-center text-sm text-gray-400">Memuat...</div>;
  }

  if (!member) {
    return <div className="mx-auto max-w-3xl px-4 py-8 text-center text-sm text-gray-500">Anggota tidak ditemukan</div>;
  }

  let saldo = 0;
  let totalDebit = 0;
  let totalKredit = 0;

  const rows = entries.map((e) => {
    if (e.type === "bayar") totalKredit += e.amount;
    else totalDebit += e.amount;
    const running = totalDebit - totalKredit;
    return { ...e, debit: e.type !== "bayar" ? e.amount : 0, kredit: e.type === "bayar" ? e.amount : 0, saldo: running };
  });

  if (rows.length > 0) saldo = rows[rows.length - 1].saldo;

  const unpaidEntries = entries.filter((e) => e.type === "htm");

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex items-center gap-3">
        <Link href="/hutang" className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <div className="flex items-center gap-2">
            {member.gender === "L" ? (
              <Mars className="h-5 w-5 text-blue-500" />
            ) : member.gender === "P" ? (
              <Venus className="h-5 w-5 text-pink-500" />
            ) : null}
            <h1 className="text-xl font-bold text-gray-900">{member.name}</h1>
          </div>
          <p className="text-xs text-gray-500">Kelas {member.class}</p>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/80 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
              <th className="px-5 py-3">Tanggal</th>
              <th className="px-5 py-3">Keterangan</th>
              <th className="px-5 py-3 text-right">Debit</th>
              <th className="px-5 py-3 text-right">Kredit</th>
              <th className="px-5 py-3 text-right">Saldo</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-5 py-10 text-center text-sm text-gray-400">Belum ada transaksi</td>
              </tr>
            ) : (
              rows.map((r, i) => (
                <tr key={i} className={`transition-colors ${r.type === "bayar" ? "bg-green-50/40" : ""}`}>
                  <td className="px-5 py-3 text-xs text-gray-500">
                    {r.type === "saldo_awal" ? "—" : new Date(r.tanggal).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
                  </td>
                  <td className="px-5 py-3">
                    <span className={`font-medium ${r.type === "bayar" ? "text-green-700" : "text-gray-900"}`}>
                      {r.type === "bayar" ? "Pembayaran: " : r.type === "saldo_awal" ? "" : "HTM: "}
                      {r.title}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right font-medium text-red-600">
                    {r.debit > 0 ? `Rp ${r.debit.toLocaleString("id-ID")}` : ""}
                  </td>
                  <td className="px-5 py-3 text-right font-medium text-green-600">
                    {r.kredit > 0 ? `Rp ${r.kredit.toLocaleString("id-ID")}` : ""}
                  </td>
                  <td className="px-5 py-3 text-right font-semibold text-gray-900">
                    Rp {r.saldo.toLocaleString("id-ID")}
                  </td>
                </tr>
              ))
            )}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-gray-200 bg-gray-50 font-bold">
              <td colSpan={2} className="px-5 py-3 text-sm text-gray-700">TOTAL</td>
              <td className="px-5 py-3 text-right text-red-600">Rp {totalDebit.toLocaleString("id-ID")}</td>
              <td className="px-5 py-3 text-right text-green-600">Rp {totalKredit.toLocaleString("id-ID")}</td>
              <td className="px-5 py-3 text-right text-gray-900">Rp {saldo.toLocaleString("id-ID")}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {unpaidEntries.length > 0 && (
        <div className="mt-6 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-100 px-5 py-4">
            <h2 className="text-sm font-bold text-gray-900">HTM Belum Dibayar ({unpaidEntries.length})</h2>
          </div>
          <div className="space-y-1 px-3 py-3">
            {unpaidEntries.map((e) => (
              <label
                key={e.scheduleId}
                onClick={() => e.scheduleId && toggleSelect(e.scheduleId)}
                className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-gray-50"
              >
                <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-all ${selected.has(e.scheduleId!) ? "border-[#0d9488] bg-[#0d9488]" : "border-gray-300"}`}>
                  {selected.has(e.scheduleId!) && <Check className="h-3.5 w-3.5 text-white" />}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">{e.title}</p>
                  <p className="text-xs text-gray-400">{new Date(e.tanggal).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}</p>
                </div>
                <span className="text-sm font-bold text-red-600">Rp {e.amount.toLocaleString("id-ID")}</span>
              </label>
            ))}
          </div>
          <div className="flex items-center justify-between border-t border-gray-100 px-5 py-4">
            <p className="text-sm text-gray-500">{selected.size} dipilih</p>
            <button
              onClick={bayarSelected}
              disabled={selected.size === 0 || saving}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#0d9488] px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#0f766e] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save className="h-3.5 w-3.5" /> {saving ? "Menyimpan..." : "Bayar"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}