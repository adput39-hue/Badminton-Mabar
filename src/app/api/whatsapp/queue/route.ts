import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  defaultWhatsAppConfig,
  WHATSAPP_CONFIG_KEY,
  WHATSAPP_QUEUE_KEY,
  type WhatsAppConfig,
} from "@/lib/whatsapp";

export const dynamic = "force-dynamic";

async function loadConfig(): Promise<WhatsAppConfig> {
  const row = await prisma.siteConfig.findUnique({ where: { key: WHATSAPP_CONFIG_KEY } });
  let config = defaultWhatsAppConfig();
  if (row?.value) {
    try { config = { ...defaultWhatsAppConfig(), ...JSON.parse(row.value) }; } catch {}
  }
  return config;
}

export async function GET(request: Request) {
  try {
    const auth = request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "") || request.headers.get("x-bot-token");
    const config = await loadConfig();
    if (!config.botToken || auth !== config.botToken) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const row = await prisma.siteConfig.findUnique({ where: { key: WHATSAPP_QUEUE_KEY } });
    let queue: any[] = [];
    if (row?.value) { try { queue = JSON.parse(row.value); } catch {} }
    if (!Array.isArray(queue)) queue = [];

    const idx = queue.findIndex((j) => j.status === "pending");
    if (idx === -1) return NextResponse.json({ job: null });

    queue[idx] = { ...queue[idx], status: "sending" };
    await prisma.siteConfig.upsert({
      where: { key: WHATSAPP_QUEUE_KEY },
      update: { value: JSON.stringify(queue) },
      create: { key: WHATSAPP_QUEUE_KEY, value: JSON.stringify(queue) },
    });
    return NextResponse.json({ job: queue[idx] });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const auth = request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "") || request.headers.get("x-bot-token");
    const config = await loadConfig();
    if (!config.botToken || auth !== config.botToken) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const jobId = body.jobId;
    const results = Array.isArray(body.results) ? body.results : [];
    if (!jobId) return NextResponse.json({ error: "jobId required" }, { status: 400 });

    const row = await prisma.siteConfig.findUnique({ where: { key: WHATSAPP_QUEUE_KEY } });
    let queue: any[] = [];
    if (row?.value) { try { queue = JSON.parse(row.value); } catch {} }
    if (!Array.isArray(queue)) queue = [];

    const idx = queue.findIndex((j) => j.id === jobId);
    if (idx === -1) return NextResponse.json({ error: "job not found" }, { status: 404 });

    const okPhone = new Map(results.filter((r: any) => r.ok).map((r: any) => [String(r.phone), r.ok]));
    let sent = 0, failed = 0;
    queue[idx].items = (queue[idx].items || []).map((it: any) => {
      const ok = okPhone.has(String(it.phone));
      if (ok) sent++;
      else failed++;
      return { ...it, ok, reason: ok ? undefined : "tidak dikirim bot" };
    });
    queue[idx].status = "done";
    queue[idx].finishedAt = new Date().toISOString();
    queue[idx].totals = { ...(queue[idx].totals || {}), sent, failed };
    await prisma.siteConfig.upsert({
      where: { key: WHATSAPP_QUEUE_KEY },
      update: { value: JSON.stringify(queue) },
      create: { key: WHATSAPP_QUEUE_KEY, value: JSON.stringify(queue) },
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}