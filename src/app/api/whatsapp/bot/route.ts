import { NextResponse } from "next/server";
import { getConfig, getBotState, saveBotState, setBotCmd, type BotState } from "@/lib/wa-store";

export const dynamic = "force-dynamic";

async function requireBot(request: Request): Promise<boolean> {
  const config = await getConfig();
  const auth = request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "") || request.headers.get("x-bot-token");
  return !!config.botToken && auth === config.botToken;
}

export async function GET() {
  const state = await getBotState();
  return NextResponse.json(state);
}

export async function POST(request: Request) {
  if (!(await requireBot(request))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = await request.json();
  const state = body?.state;
  if (!["offline", "qr", "connected"].includes(state)) {
    return NextResponse.json({ error: "invalid state" }, { status: 400 });
  }
  const data: BotState = { state, qr: typeof body.qr === "string" ? body.qr : undefined, at: new Date().toISOString() };
  await saveBotState(data);
  return NextResponse.json({ ok: true });
}

export async function PUT(request: Request) {
  const body = await request.json();
  if (body?.cmd !== "logout" && body?.cmd !== "refresh") {
    return NextResponse.json({ error: "invalid cmd" }, { status: 400 });
  }
  await setBotCmd(body.cmd);
  return NextResponse.json({ ok: true });
}