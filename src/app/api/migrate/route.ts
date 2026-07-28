import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    await prisma.$executeRawUnsafe(`ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS total_match_goal INTEGER`);
    await prisma.$executeRawUnsafe(`ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS max_match_per_team INTEGER`);
    await prisma.$executeRawUnsafe(`ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS game_format VARCHAR(10) DEFAULT '1x30'`);
    await prisma.$executeRawUnsafe(`ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS courts TEXT`);
    await prisma.$executeRawUnsafe(`ALTER TABLE teams ADD COLUMN IF NOT EXISTS icon VARCHAR(255)`);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
