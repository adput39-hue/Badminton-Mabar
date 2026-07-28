import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const pbId = request.headers.get("x-pb-id");
  const tournament = await prisma.tournament.findFirst({
    where: { id, ...(pbId ? { pbId } : {}) },
    include: { teams: { include: { players: true } }, schedules: { include: { matches: true, team1: true, team2: true }, orderBy: { date: "asc" } } },
  });
  if (!tournament) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(tournament);
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const pbId = request.headers.get("x-pb-id");
    const tournament = await prisma.tournament.findFirst({ where: { id, ...(pbId ? { pbId } : {}) } });
    if (!tournament) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const data: Record<string, unknown> = {};
    if (body.name !== undefined) data.name = body.name;
    if (body.status !== undefined) data.status = body.status;
    if (body.totalMatchGoal !== undefined) data.totalMatchGoal = body.totalMatchGoal;
    if (body.maxMatchPerTeam !== undefined) data.maxMatchPerTeam = body.maxMatchPerTeam;
    if (body.gameFormat !== undefined) data.gameFormat = body.gameFormat;
    if (body.courts !== undefined) data.courts = body.courts;
    const updated = await prisma.tournament.update({ where: { id }, data });
    return NextResponse.json(updated);
  } catch (error) {
    console.error("PUT /api/tournaments/[id] error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const pbId = request.headers.get("x-pb-id");
    const tournament = await prisma.tournament.findFirst({ where: { id, ...(pbId ? { pbId } : {}) } });
    if (!tournament) return NextResponse.json({ error: "Not found" }, { status: 404 });
    await prisma.tournament.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/tournaments/[id] error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
