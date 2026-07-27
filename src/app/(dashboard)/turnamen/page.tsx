"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useApi } from "@/lib/api-store";
import type { ApiTournament } from "@/lib/api-types";
import { Trophy, Plus, X } from "lucide-react";
import { useToast } from "@/components/toast";
import { LoadingSpinner } from "@/components/loading-spinner";

export default function TurnamenPage() {
  const { items: tournaments, add: addTournament, loaded } = useApi<ApiTournament>("tournaments");
  const [showCreate, setShowCreate] = useState(false);
  const [formName, setFormName] = useState("");
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  async function handleCreate() {
    if (!formName.trim()) return;
    setSaving(true);
    try {
      await addTournament({ name: formName.trim() });
      setShowCreate(false);
      setFormName("");
      toast("success", "Turnamen berhasil dibuat");
    } catch (err) {
      toast("error", "Gagal: " + (err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  if (!loaded) return <div className="flex items-center justify-center py-20"><LoadingSpinner /></div>;

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Turnamen</h1>
          <p className="mt-0.5 text-sm text-gray-500">{tournaments.length} turnamen</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="inline-flex items-center gap-2 rounded-xl bg-[var(--color-primary)] px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[var(--color-primary-hover)]"><Plus className="h-4 w-4" /> Turnamen Baru</button>
      </div>

      {tournaments.length === 0 ? (
        <div className="rounded-2xl border border-gray-200 bg-white px-6 py-16 text-center shadow-sm">
          <Trophy className="mx-auto h-10 w-10 text-gray-300" />
          <p className="mt-3 text-sm text-gray-500">Belum ada turnamen</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {tournaments.map((t) => (
            <Link key={t.id} href={`/turnamen/${t.id}`}
              className="rounded-2xl border bg-white p-5 shadow-sm transition-all hover:shadow-md">
              <div className="flex items-center gap-2 text-sm font-bold text-gray-900">
                <Trophy className="h-4 w-4 text-yellow-500" /> {t.name}
              </div>
              <div className="mt-2 flex items-center gap-3 text-xs text-gray-500">
                <span className={`rounded-full px-2 py-0.5 font-medium ${t.status === "active" ? "bg-green-100 text-green-700" : t.status === "completed" ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-600"}`}>{t.status}</span>
                <span>{t.teams?.length || 0} tim</span>
              </div>
            </Link>
          ))}
        </div>
      )}

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
              <h2 className="text-lg font-bold text-gray-900">Turnamen Baru</h2>
              <button onClick={() => setShowCreate(false)} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100"><X className="h-5 w-5" /></button>
            </div>
            <div className="space-y-4 p-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Nama Turnamen</label>
                <input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="Contoh: Liga Internal 2026"
                  className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm shadow-sm focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/10" />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button onClick={() => setShowCreate(false)} className="rounded-xl border border-gray-200 px-5 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50">Batal</button>
                <button onClick={handleCreate} disabled={!formName.trim() || saving} className="rounded-xl bg-[var(--color-primary)] px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[var(--color-primary-hover)] disabled:opacity-50">{saving ? "Menyimpan..." : "Simpan"}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
