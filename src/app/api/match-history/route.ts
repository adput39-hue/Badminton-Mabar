import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    const pbId = request.headers.get("x-pb-id");
    const where = pbId ? { pbId } : {};
    const history = await prisma.matchHistory.findMany({ where });
    return NextResponse.json(history);
  } catch (error) {
    console.error("GET /api/match-history error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const body = await request.json();
  const pbId = request.headers.get("x-pb-id") || body.pbId || "default";
  const h = await prisma.matchHistory.create({ data: { ...body, pbId } });
  return NextResponse.json(h, { status: 201 });
}
