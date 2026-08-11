import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  defaultWhatsAppConfig,
  type WhatsAppConfig,
  WHATSAPP_BOT_STATE_KEY,
  WHATSAPP_BOT_CMD_KEY,
  WHATSAPP_CONFIG_KEY,
} from "@/lib/whatsapp";

export const dynamic = "force-dynamic";

export interface BotState {
  state: "offline" | "qr" | "connected";
  qr?: string;
  at?: string;
}

async function loadConfig(): Promise<WhatsAppConfig> {
  const row = await prisma.siteConfig.findUnique({ where: { key: WHATSAPP_CONFIG_KEY } });
  let config = defaultWhatsAppConfig();
  if (row?.value) {
    try { config = { ...defaultWhatsAppConfig(), ...JSON.parse(row.value) }; } catch {}
  }
  return config;
}

function requireBot(request: Request, config: WhatsAppConfig): boolean {
  const auth = request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "") || request.headers.get("x-bot-token");
  return !!config.botToken && auth === config.botToken;
}

export async function GET(request: Request) {
  const row = await prisma.siteConfig.findUnique({ where: { key: WHATSAPP_BOT_STATE_KEY } });
  let state: BotState = { state: "offline" };
  if (row?.value) {
    try { state = JSON.parse(row.value); } catch {}
  }
  return NextResponse.json(state);
}

export async function POST(request: Request) {
  const config = await loadConfig();
  if (!requireBot(request, config)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = await request.json();
  const state: BotState["state"] = body?.state;
  if (!["offline", "qr", "connected"].includes(state)) {
    return NextResponse.json({ error: "invalid state" }, { status: 400 });
  }
  const data: BotState = { state, qr: typeof body.qr === "string" ? body.qr : undefined, at: new Date().toISOString() };
  await prisma.siteConfig.upsert({
    where: { key: WHATSAPP_BOT_STATE_KEY },
    update: { value: JSON.stringify(data) },
    create: { key: WHATSAPP_BOT_STATE_KEY, value: JSON.stringify(data) },
  });
  return NextResponse.json({ ok: true });
}

export async function PUT(request: Request) {
  const body = await request.json();
  if (body?.cmd !== "logout") {
    return NextResponse.json({ error: "invalid cmd" }, { status: 400 });
  }
  await prisma.siteConfig.upsert({
    where: { key: WHATSAPP_BOT_CMD_KEY },
    update: { value: JSON.stringify({ cmd: "logout", at: new Date().toISOString() }) },
    create: { key: WHATSAPP_BOT_CMD_KEY, value: JSON.stringify({ cmd: "logout", at: new Date().toISOString() }) },
  });
  return NextResponse.json({ ok: true });
}