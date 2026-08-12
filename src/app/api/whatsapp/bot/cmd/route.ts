import { NextResponse } from "next/server";
import { getConfig, consumeBotCmd } from "@/lib/wa-store";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const config = await getConfig();
  const auth = request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "") || request.headers.get("x-bot-token");
  if (!config.botToken || auth !== config.botToken) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const cmd = await consumeBotCmd();
  return NextResponse.json({ cmd });
}