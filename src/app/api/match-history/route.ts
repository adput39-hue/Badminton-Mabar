import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const pbId = request.headers.get("x-pb-id");
  const where = pbId ? { pbId } : {};
  const history = await prisma.matchHistory.findMany({ where });
  return NextResponse.json(history);
}

export async function POST(request: Request) {
  const body = await request.json();
  const pbId = request.headers.get("x-pb-id") || body.pbId || "default";
  const h = await prisma.matchHistory.create({ data: { ...body, pbId } });
  return NextResponse.json(h, { status: 201 });
}
