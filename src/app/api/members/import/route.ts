import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const VALID_CLASSES = ["A", "B", "C", "D", "E", "F"];

function normalizeGender(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim().toLowerCase();
  if (!s) return null;
  if (s === "l" || s === "laki" || s === "laki-laki" || s === "male" || s === "pria" || s === "1") return "L";
  if (s === "p" || s === "perempuan" || s === "wanita" || s === "female" || s === "cewek" || s === "2") return "P";
  return null;
}

function normalizeClass(v: unknown): string {
  const s = String(v ?? "").trim().toUpperCase();
  return VALID_CLASSES.includes(s) ? s : "A";
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const pbId = request.headers.get("x-pb-id") || body.pbId || "default";
    const raw = Array.isArray(body.members) ? body.members : [];

    if (raw.length === 0) {
      return NextResponse.json({ error: "Tidak ada data untuk diimpor" }, { status: 400 });
    }

    const existing = await prisma.member.findMany({
      where: { pbId },
      select: { name: true },
    });
    const existingSet = new Set(existing.map((m) => m.name.trim().toLowerCase()));

    const seen = new Set<string>();
    const toCreate: { name: string; phone: string | null; address: string | null; class: string; gender: string | null; type: string }[] = [];
    const errors: string[] = [];

    for (let i = 0; i < raw.length; i++) {
      const row = raw[i];
      const name = String(row?.name ?? "").trim();
      if (!name) {
        errors.push(`Baris ${i + 2}: nama kosong, dilewati`);
        continue;
      }
      const key = name.toLowerCase();
      if (existingSet.has(key) || seen.has(key)) {
        errors.push(`Baris ${i + 2}: "${name}" sudah ada, dilewati`);
        continue;
      }
      seen.add(key);
      toCreate.push({
        name,
        phone: row?.phone ? String(row.phone).trim() || null : null,
        address: row?.address ? String(row.address).trim() || null : null,
        class: normalizeClass(row?.class),
        gender: normalizeGender(row?.gender),
        type: "1",
      });
    }

    let imported = 0;
    if (toCreate.length > 0) {
      await prisma.$transaction(async (tx) => {
        for (const m of toCreate) {
          await tx.member.create({ data: { pbId, ...m, isActive: true } });
          imported++;
        }
      });
    }

    return NextResponse.json({ imported, skipped: raw.length - imported, errors }, { status: 200 });
  } catch (error) {
    console.error("POST /api/members/import error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
