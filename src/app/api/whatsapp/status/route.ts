import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { defaultWhatsAppConfig, WHATSAPP_CONFIG_KEY, WHATSAPP_QUEUE_KEY, type WhatsAppConfig } from "@/lib/whatsapp";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const auth = request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "") || request.headers.get("x-bot-token");
    const row = await prisma.siteConfig.findUnique({ where: { key: WHATSAPP_CONFIG_KEY } });
    let config = defaultWhatsAppConfig();
    if (row?.value) { try { config = { ...defaultWhatsAppConfig(), ...JSON.parse(row.value) }; } catch {} }
    if (!config.botToken || auth !== config.botToken) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    const queueRow = await prisma.siteConfig.findUnique({ where: { key: WHATSAPP_QUEUE_KEY } });
    let queue: any[] = [];
    if (queueRow?.value) { try { queue = JSON.parse(queueRow.value); } catch {} }
    if (!Array.isArray(queue)) queue = [];
    const pending = queue.filter((j) => j.status === "pending").length;
    const sending = queue.filter((j) => j.status === "sending").length;
    const doneCount = queue.filter((j) => j.status === "done").length;
    const recent = queue.filter((j) => j.status === "done").slice(-5);
    return NextResponse.json({ pending, sending, done: doneCount, recent });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}