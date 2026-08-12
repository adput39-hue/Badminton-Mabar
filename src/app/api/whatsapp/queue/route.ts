import { NextResponse } from "next/server";
import { getConfig, claimPendingJob, completeJob } from "@/lib/wa-store";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const auth = request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "") || request.headers.get("x-bot-token");
    const config = await getConfig();
    if (!config.botToken || auth !== config.botToken) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    const job = await claimPendingJob();
    return NextResponse.json({ job });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const auth = request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "") || request.headers.get("x-bot-token");
    const config = await getConfig();
    if (!config.botToken || auth !== config.botToken) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    const body = await request.json();
    const jobId = body.jobId;
    const results = Array.isArray(body.results) ? body.results : [];
    if (!jobId) return NextResponse.json({ error: "jobId required" }, { status: 400 });
    await completeJob(jobId, results);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}