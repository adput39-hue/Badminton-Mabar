import { NextResponse } from "next/server";
import { runMatchCardCleanup } from "../route";

export async function GET() {
  try {
    const count = await runMatchCardCleanup();
    return NextResponse.json({ ok: true, deleted: count });
  } catch (error) {
    console.error("GET /api/match-cards/cleanup error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
