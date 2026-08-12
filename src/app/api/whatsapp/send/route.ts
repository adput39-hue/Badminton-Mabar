import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  defaultWhatsAppConfig,
  sendWhatsAppTo,
  formatPhoneNumber,
  fillVariables,
  type WhatsAppConfig,
  type WaJobItem,
  type WABroadcastType,
} from "@/lib/whatsapp";
import { getConfig, pushJob, appendLog } from "@/lib/wa-store";

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

interface Target {
  member: { id: string; name: string; phone: string | null; class: string; memberType: string };
  htmRate: number;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const pbId = request.headers.get("x-pb-id") || body.pbId;
    const type = body.type as WABroadcastType;
    if (!["jadwal", "reminder", "bayar", "test"].includes(type)) {
      return NextResponse.json({ error: "type must be jadwal|reminder|bayar|test" }, { status: 400 });
    }

    const config: WhatsAppConfig = await getConfig();
    if (config.mode === "meta" && (!config.token || !config.phoneNumberId)) {
      return NextResponse.json({ error: "WhatsApp belum dikonfigurasi di Pengaturan" }, { status: 400 });
    }
    if (config.mode === "self" && !config.botToken) {
      return NextResponse.json({ error: "Buat dulu Token Bot di Pengaturan → WhatsApp, lalu scan QR di HP bot" }, { status: 400 });
    }

    const schedule = body.scheduleId
      ? await prisma.schedule.findUnique({ where: { id: body.scheduleId } })
      : null;
    if (body.scheduleId && !schedule) {
      return NextResponse.json({ error: "Jadwal tidak ditemukan" }, { status: 404 });
    }

    const pb = await prisma.pb.findFirst({ where: { id: pbId || schedule?.pbId } });
    const effectivePbId = pbId || schedule?.pbId || "";
    const where = effectivePbId ? { pbId: effectivePbId } : {};

    const inPb = (m: { pbId?: string | null }): boolean => !effectivePbId || m.pbId === effectivePbId;

    let targets: Target[] = [];

    if (type === "test") {
      const fallbackMember = await prisma.member.findFirst({ where: { ...where, phone: { not: null }, isActive: true } as any });
      const testMember = {
        id: "test",
        name: "Pesan Uji",
        phone: pb?.phone || fallbackMember?.phone || null,
        class: "",
        memberType: "member",
      };
      targets = [{ member: testMember, htmRate: 0 }];
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
        targets = attendances
          .filter((a) => inPb(a.member))
          .map((a) => ({
            member: a.member,
            htmRate: isInsidentil(a.member) ? (schedule.htmInsidentil ?? schedule.htm ?? 0) : (schedule.htm ?? 0),
          }));
      } else {
        const paidIds = getPaidMembers(schedule);
        targets = attendances
          .filter((a) => inPb(a.member))
          .filter((a) => !paidIds.includes(a.memberId))
          .map((a) => ({
            member: a.member,
            htmRate: isInsidentil(a.member) ? (schedule.htmInsidentil ?? schedule.htm ?? 0) : (schedule.htm ?? 0),
          }));
      }
    }

    const template = config.templates[type === "test" ? "jadwal" : type];
    const ctx = {
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
    const items: WaJobItem[] = [];
    for (const t of targets) {
      const phone = formatPhoneNumber(t.member.phone);
      if (!phone) {
        noPhone.push(t.member.name);
        continue;
      }
      const text = fillVariables(template.text, {
        member: { name: t.member.name, class: t.member.class },
        pb: ctx.pb,
        schedule: ctx.schedule,
      });
      items.push({
        memberId: t.member.id,
        memberName: t.member.name,
        phone,
        text,
      });
    }

    if (config.mode === "meta") {
      const maxConcurrent = 5;
      const results: { memberName: string; phone: string; ok: boolean; reason?: string }[] = [];
      for (let i = 0; i < items.length; i += maxConcurrent) {
        const chunk = items.slice(i, i + maxConcurrent);
        const chunkResults = await Promise.all(
          chunk.map((it) =>
            sendWhatsAppTo({
              to: it.phone,
              mode: "text",
              text: it.text,
              ctx,
              token: config.token,
              phoneNumberId: config.phoneNumberId,
            }).then((r) => ({ memberName: it.memberName, ...r }))
          )
        );
        results.push(...chunkResults);
      }
      await appendLog({
        type: type === "test" ? "jadwal" : type,
        scheduleId: schedule?.id || null,
        title: schedule ? (schedule.sparingOpponent ? `Sparing vs ${schedule.sparingOpponent}` : schedule.title) : "Semua anggota",
        at: new Date().toISOString(),
        mode: "meta",
        total: targets.length,
        noPhone: noPhone.length,
        ok: results.filter((r) => r.ok).length,
        failed: results.filter((r) => !r.ok).length,
      });
      return NextResponse.json({
        ok: true,
        mode: "meta",
        total: targets.length,
        sent: results.filter((r) => r.ok).length,
        noPhone: noPhone.length,
        failed: results.filter((r) => !r.ok).length,
        failedDetails: results.filter((r) => !r.ok).slice(0, 20).map((f) => ({ name: f.memberName, reason: f.reason })),
      });
    }

    // mode "self": simpan ke queue Firestore
    const id = "job_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const job = {
      id,
      type: type === "test" ? "jadwal" : type,
      scheduleId: schedule?.id || null,
      title: schedule ? (schedule.sparingOpponent ? `Sparing vs ${schedule.sparingOpponent}` : schedule.title) : "Semua anggota",
      status: "pending" as const,
      at: new Date().toISOString(),
      totals: { total: targets.length, sent: 0, failed: 0, noPhone: noPhone.length },
      items,
    };

    await pushJob(job);

    return NextResponse.json({
      ok: true,
      mode: "self",
      queued: true,
      jobId: id,
      total: targets.length,
      noPhone: noPhone.length,
      phoneTargets: items.length,
    });
  } catch (error) {
    console.error("POST /api/whatsapp/send error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}