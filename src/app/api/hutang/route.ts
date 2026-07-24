import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const pbId = request.headers.get("x-pb-id");
  const where = pbId ? { pbId } : {};

  const { searchParams } = new URL(request.url);
  const memberId = searchParams.get("memberId");

  const members = await prisma.member.findMany({
    where: { ...(pbId ? { pbId } : {}), isActive: true } as any,
    orderBy: { name: "asc" },
  });

  const schedules = await prisma.schedule.findMany({
    where: { ...where, htm: { gt: 0 }, status: { not: "cancelled" } } as any,
    orderBy: { date: "desc" },
  });

  const attendanceSchedules = await prisma.schedule.findMany({
    where: where as any,
    select: { id: true },
  });
  const scheduleIds = attendanceSchedules.map((s) => s.id);
  const attendances = await prisma.attendance.findMany({
    where: { scheduleId: { in: scheduleIds }, status: { in: ["hadir", "undangan"] } },
  });

  const mutasis = await prisma.kasMutasi.findMany({
    where: { ...where, type: "masuk", memberId: { not: null } } as any,
    orderBy: { tanggal: "asc" },
  });

  function getPaidMembers(s: { notes: string | null }): string[] {
    if (!s.notes) return [];
    try { const p = JSON.parse(s.notes); if (Array.isArray(p.paidMembers)) return p.paidMembers; } catch {}
    return [];
  }

  if (memberId) {
    const member = members.find((m) => m.id === memberId);
    if (!member) return NextResponse.json({ error: "Member not found" }, { status: 404 });

    const attIds = attendances.filter((a) => a.memberId === memberId).map((a) => a.scheduleId);

    const entries: {
      type: "saldo_awal" | "htm" | "bayar";
      scheduleId?: string;
      title: string;
      tanggal: string;
      amount: number;
    }[] = [];

    if (member.saldoAwalHutang && member.saldoAwalHutang > 0) {
      entries.push({
        type: "saldo_awal",
        title: "Saldo Awal Hutang",
        tanggal: member.joinedAt.toISOString(),
        amount: member.saldoAwalHutang,
      });
    }

    for (const s of schedules) {
      if (!attIds.includes(s.id)) continue;
      const paidIds = getPaidMembers(s);
      if (!paidIds.includes(memberId)) {
        entries.push({
          type: "htm",
          scheduleId: s.id,
          title: s.sparingOpponent ? `Sparing vs ${s.sparingOpponent}` : s.title,
          tanggal: s.date.toISOString(),
          amount: s.htm!,
        });
      }
    }

    for (const m of mutasis) {
      if (m.memberId !== memberId) continue;
      entries.push({
        type: "bayar",
        scheduleId: m.reference || undefined,
        title: m.description,
        tanggal: m.tanggal.toISOString(),
        amount: m.amount,
      });
    }

    entries.sort((a, b) => new Date(a.tanggal).getTime() - new Date(b.tanggal).getTime());

    return NextResponse.json({ member, entries });
  }

  const result = members.map((m) => {
    const attIds = attendances.filter((a) => a.memberId === m.id).map((a) => a.scheduleId);
    let totalUnpaidHtm = 0;
    for (const s of schedules) {
      if (!attIds.includes(s.id)) continue;
      const paidIds = getPaidMembers(s);
      if (!paidIds.includes(m.id)) {
        totalUnpaidHtm += s.htm!;
      }
    }
    const totalDebt = (m.saldoAwalHutang || 0) + totalUnpaidHtm;
    return {
      memberId: m.id,
      memberName: m.name,
      memberClass: m.class,
      gender: m.gender,
      saldoAwal: m.saldoAwalHutang || 0,
      totalUnpaidHtm,
      totalDebt,
    };
  });

  return NextResponse.json(result);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const pbId = request.headers.get("x-pb-id") || body.pbId;
    if (!pbId) return NextResponse.json({ error: "x-pb-id required" }, { status: 400 });

    const { memberId, scheduleIds } = body;
    if (!memberId || !Array.isArray(scheduleIds) || scheduleIds.length === 0) {
      return NextResponse.json({ error: "memberId and scheduleIds[] required" }, { status: 400 });
    }

    const schedules = await prisma.schedule.findMany({
      where: { id: { in: scheduleIds }, pbId, htm: { gt: 0 } },
    });

    const created: { scheduleId: string; amount: number }[] = [];

    for (const s of schedules) {
      const paidIds: string[] = (() => {
        if (!s.notes) return [];
        try { const p = JSON.parse(s.notes); if (Array.isArray(p.paidMembers)) return p.paidMembers; } catch {}
        return [];
      })();

      if (paidIds.includes(memberId)) continue;

      paidIds.push(memberId);
      const newNotes = (() => {
        if (!s.notes) return JSON.stringify({ paidMembers: paidIds });
        try {
          const p = JSON.parse(s.notes);
          p.paidMembers = paidIds;
          return JSON.stringify(p);
        } catch {
          return JSON.stringify({ text: s.notes, paidMembers: paidIds });
        }
      })();

      await prisma.schedule.update({ where: { id: s.id }, data: { notes: newNotes } });

      const member = await prisma.member.findUnique({ where: { id: memberId } });
      const title = s.sparingOpponent ? `Sparing vs ${s.sparingOpponent}` : s.title;
      await prisma.kasMutasi.create({
        data: {
          pbId,
          type: "masuk",
          description: `Bayar HTM - ${member?.name || "?"} - ${title}`,
          amount: s.htm!,
          tanggal: new Date(),
          reference: s.id,
          memberId,
        },
      });

      created.push({ scheduleId: s.id, amount: s.htm! });
    }

    return NextResponse.json({ ok: true, created });
  } catch (error) {
    console.error("POST /api/hutang error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}