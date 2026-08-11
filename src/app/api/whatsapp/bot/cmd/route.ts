import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  defaultWhatsAppConfig,
  type WhatsAppConfig,
  WHATSAPP_BOT_CMD_KEY,
  WHATSAPP_CONFIG_KEY,
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
  const config = await loadConfig();
  const auth = request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "") || request.headers.get("x-bot-token");
  if (!config.botToken || auth !== config.botToken) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const row = await prisma.siteConfig.findUnique({ where: { key: WHATSAPP_BOT_CMD_KEY } });
  if (!row?.value) return NextResponse.json({ cmd: null });
  try {
    const parsed = JSON.parse(row.value);
    await prisma.siteConfig.deleteMany({ where: { key: WHATSAPP_BOT_CMD_KEY } });
    return NextResponse.json({ cmd: parsed.cmd || null });
  } catch {
    await prisma.siteConfig.deleteMany({ where: { key: WHATSAPP_BOT_CMD_KEY } });
    return NextResponse.json({ cmd: null });
  }
}