import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const queryPbId = url.searchParams.get("pbId");
  const pbId = queryPbId || request.headers.get("x-pb-id");
  const where = pbId ? { pbId } : {};
  const members = await prisma.member.findMany({ where, orderBy: { createdAt: "desc" } });
  const safe = members.map(({ photo, ...m }) => ({ ...m, hasPhoto: !!photo, photoVersion: photo ? m.updatedAt : null }));
  return NextResponse.json(safe);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const pbId = request.headers.get("x-pb-id") || body.pbId || "default";
    const member = await prisma.member.create({
      data: {
        pbId,
        name: body.name,
        phone: body.phone || null,
        photo: body.photo || null,
        address: body.address || null,
        class: body.class,
        type: body.type || "1",
        memberType: body.memberType || "member",
        isActive: body.isActive ?? true,
        joinedAt: body.joinedAt ? new Date(body.joinedAt) : new Date(),
      },
    });
    return NextResponse.json(member, { status: 201 });
  } catch (error) {
    console.error("POST /api/members error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
