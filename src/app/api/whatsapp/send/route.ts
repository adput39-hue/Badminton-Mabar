import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  defaultWhatsAppConfig,
  sendWhatsAppTo,
  formatPhoneNumber,
  fillVariables,
  WHATSAPP_CONFIG_KEY,
  WHATSAPP_LOG_KEY,
  type WhatsAppConfig,
} from "@/lib/whatsapp";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

function getPaidMembers(s: { notes: string | null }): string[] {
  if (!s.notes) return [];
  try {
    const p = JSON.parse(s.notes);
    if (Array.isArray(p.paidMembers)) return p.paidMembers;
  } catch {}
  return [];
}

function isInsidentil(member: { memberType?: string } | null | undefined): boolean {
  return member?.memberType === "insidentil";
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const pbId = request.headers.get("x-pb-id") || body.pbId;
    const type = body.type as "jadwal" | "reminder" | "bayar" | "test";
    if (!["jadwal", "reminder", "bayar", "test"].includes(type)) {
      return NextResponse.json({ error: "type must be jadwal|reminder|bayar|test" }, { status: 400 });
    }

    const configRow = await prisma.siteConfig.findUnique({ where: { key: WHATSAPP_CONFIG_KEY } });
    let config: WhatsAppConfig = defaultWhatsAppConfig();
    if (configRow?.value) {
      try { config = { ...defaultWhatsAppConfig(), ...JSON.parse(configRow.value) }; } catch {}
    }
    if (!config.token || !config.phoneNumberId) {
      return NextResponse.json({ error: "WhatsApp belum dikonfigurasi di Pengaturan" }, { status: 400 });
    }

    const schedule = body.scheduleId
      ? await prisma.schedule.findUnique({ where: { id: body.scheduleId } })
      : null;
    if (body.scheduleId && !schedule) {
      return NextResponse.json({ error: "Jadwal tidak ditemukan" }, { status: 404 });
    }

    const pb = await prisma.pb.findFirst({ where: { id: pbId || schedule?.pbId } });
    const where = pbId ? { pbId } : {};

    let targets: { member: { id: string; name: string; phone: string | null; class: string; memberType: string }; htmRate: number }[] = [];

    if (type === "test") {
      const member = pbId ? await prisma.member.findFirst({ where: { pbId, phone: { not: null } } }) : null;
      const testMember = {
        id: "test",
        name: "Test",
        phone: pb?.phone || member?.phone || null,
        class: "",
        memberType: "member",
      };
      targets = [{ member: testMember as any, htmRate: 0 }];
    } else if (type === "jadwal") {
      const members = await prisma.member.findMany({ where: { ...where, isActive: true } as any });
      targets = members.map((m) => ({ member: m, htmRate: 0 }));
    } else {
      if (!schedule) return NextResponse.json({ error: "scheduleId wajib untuk tipe ini" }, { status: 400 });

      const attendances = await prisma.attendance.findMany({
        where: { scheduleId: schedule.id, status: { in: ["hadir", "undangan"] } },
        include: { member: true },
      });

      if (type === "reminder") {
        targets = attendances.map((a) => ({
          member: a.member,
          htmRate: isInsidentil(a.member) ? (schedule.htmInsidentil ?? schedule.htm ?? 0) : (schedule.htm ?? 0),
        }));
      } else {
        const paidIds = getPaidMembers(schedule);
        targets = attendances
          .filter((a) => !paidIds.includes(a.memberId))
          .map((a) => ({
            member: a.member,
            htmRate: isInsidentil(a.member) ? (schedule.htmInsidentil ?? schedule.htm ?? 0) : (schedule.htm ?? 0),
          }));
      }
    }
    void 0;

    const template = config.templates[type === "test" ? "jadwal" : type];
    const ctxBase = {
      pb: pb ? { name: pb.name } : undefined,
      schedule: schedule
        ? {
            title: schedule.title,
            sparingOpponent: schedule.sparingOpponent,
            date: schedule.date,
            startTime: schedule.startTime,
            location: schedule.location,
            htm: schedule.htm,
            htmInsidentil: schedule.htmInsidentil,
          }
        : type === "test"
          ? {
              title: "Main Bareng Mingguan",
              date: new Date(Date.now() + 86400000),
              startTime: "19:00",
              location: "GOR Badminton",
              htm: 25000,
              htmInsidentil: 30000,
            }
          : undefined,
    };

    const noPhone: string[] = [];
    const withPhone = targets.filter((t) => {
      if (!formatPhoneNumber(t.member.phone)) {
        noPhone.push(t.member.name);
        return false;
      }
      return true;
    });

    const maxConcurrent = 5;
    const sendOne = async (t: { member: { id: string; phone: string | null; name: string; class: string } }, i: number) => {
      const text = fillVariables(template.text, {
        member: { name: t.member.name, class: t.member.class },
        pb: ctxBase.pb,
        schedule: ctxBase.schedule,
      });
      const res = await sendWhatsAppTo({
        to: t.member.phone!,
        mode: "text",
        text,
        ctx: ctxBase,
        token: config.token,
        phoneNumberId: config.phoneNumberId,
      });
      return { ...res, memberId: t.member.id, memberName: t.member.name, index: i };
    };

    const results: { memberId: string; memberName: string; phone: string; ok: boolean; reason?: string }[] = [];
    for (let i = 0; i < withPhone.length; i += maxConcurrent) {
      const chunk = withPhone.slice(i, i + maxConcurrent);
      const chunkResults = await Promise.all(chunk.map((t, j) => sendOne(t, i + j)));
      results.push(...chunkResults);
    }

    const okCount = results.filter((r) => r.ok).length;
    const failed = results.filter((r) => !r.ok);

    const logRow = await prisma.siteConfig.findUnique({ where: { key: WHATSAPP_LOG_KEY } });
    let logs: unknown[] = [];
    if (logRow?.value) { try { logs = JSON.parse(logRow.value); } catch {} }
    if (!Array.isArray(logs)) logs = [];
    logs.push({
      type,
      scheduleId: schedule?.id || null,
      title: schedule ? (schedule.sparingOpponent ? `Sparing vs ${schedule.sparingOpponent}` : schedule.title) : "Semua anggota",
      at: new Date().toISOString(),
      total: targets.length,
      noPhone: noPhone.length,
      ok: okCount,
      failed: failed.length,
    });
    logs = logs.slice(-100);
    await prisma.siteConfig.upsert({
      where: { key: WHATSAPP_LOG_KEY },
      update: { value: JSON.stringify(logs) },
      create: { key: WHATSAPP_LOG_KEY, value: JSON.stringify(logs) },
    });

    return NextResponse.json({
      ok: true,
      total: targets.length,
      sent: okCount,
      noPhone: noPhone.length,
      failed: failed.length,
      failedDetails: failed.slice(0, 20).map((f) => ({ name: f.memberName, reason: f.reason })),
    });
  } catch (error) {
    console.error("POST /api/whatsapp/send error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}