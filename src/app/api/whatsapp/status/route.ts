import { NextResponse } from "next/server";
import { getConfig, getQueueSummary } from "@/lib/wa-store";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const auth = request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "") || request.headers.get("x-bot-token");
    const config = await getConfig();
    if (!config.botToken || auth !== config.botToken) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    const summary = await getQueueSummary();
    return NextResponse.json(summary);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}