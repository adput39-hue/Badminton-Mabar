import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { broadcast, subscribe } from "@/lib/sse-events";
import { toDateOnly, todayDateOnly } from "@/lib/utils";
import { getHtmRate } from "@/lib/htm-rate";
import { Prisma } from "@prisma/client";
import { networkInterfaces } from "os";
import {
  getConfig as waGetConfig,
  getBotState,
  saveBotState,
  setBotCmd,
  consumeBotCmd,
  claimPendingJob,
  completeJob,
  pushJob,
  appendLog,
  getQueueSummary,
  saveConfig,
  type BotState,
} from "@/lib/wa-store";
import {
  defaultWhatsAppConfig,
  sendWhatsAppTo,
  formatPhoneNumber,
  fillVariables,
  type WhatsAppConfig,
  type WaJobItem,
  type WABroadcastType,
} from "@/lib/whatsapp";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type P<T> = { params: Promise<T> };

/* ============================================================ */
/* members                                                       */
/* ============================================================ */
async function membersGet(request: Request) {
  const url = new URL(request.url);
  const queryPbId = url.searchParams.get("pbId");
  const pbId = queryPbId || request.headers.get("x-pb-id");
  const where = pbId ? { pbId } : {};
  const members = await prisma.member.findMany({ where, orderBy: { createdAt: "desc" } });
  const safe = members.map(({ photo, ...m }) => ({ ...m, hasPhoto: !!photo, photoVersion: photo ? m.updatedAt : null }));
  return NextResponse.json(safe);
}

async function membersPost(request: Request) {
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

async function memberPut(request: Request, { params }: P<{ id: string }>) {
  const { id } = await params;
  const body = await request.json();
  const member = await prisma.member.update({ where: { id }, data: body });
  return NextResponse.json(member);
}

async function memberDelete(_request: Request, { params }: P<{ id: string }>) {
  const { id } = await params;
  await prisma.member.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}

async function memberPhoto(_request: Request, { params }: P<{ id: string }>) {
  const { id } = await params;
  const member = await prisma.member.findUnique({ where: { id }, select: { photo: true } });
  if (!member?.photo) return new NextResponse("Not Found", { status: 404 });
  const m = member.photo.match(/^data:(image\/[a-z+]+);base64,([\s\S]+)$/);
  const buf = Buffer.from(m ? m[2] : member.photo, "base64");
  const type = m ? m[1] : "image/png";
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": type,
      "Cache-Control": "public, max-age=31536000, immutable",
      "Content-Length": String(buf.length),
    },
  });
}

const VALID_CLASSES = ["A", "B", "C", "D", "E", "F"];

function normalizeGender(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim().toLowerCase();
  if (!s) return null;
  if (s === "l" || s === "laki" || s === "laki-laki" || s === "male" || s === "pria" || s === "1") return "L";
  if (s === "p" || s === "perempuan" || s === "wanita" || s === "female" || s === "cewek" || s === "2") return "P";
  return null;
}

function normalizeClass(v: unknown): string {
  const s = String(v ?? "").trim().toUpperCase();
  return VALID_CLASSES.includes(s) ? s : "A";
}

async function membersImport(request: Request) {
  try {
    const body = await request.json();
    const pbId = request.headers.get("x-pb-id") || body.pbId || "default";
    const raw = Array.isArray(body.members) ? body.members : [];

    if (raw.length === 0) {
      return NextResponse.json({ error: "Tidak ada data untuk diimpor" }, { status: 400 });
    }

    const existing = await prisma.member.findMany({
      where: { pbId },
      select: { name: true },
    });
    const existingSet = new Set(existing.map((m) => m.name.trim().toLowerCase()));

    const seen = new Set<string>();
    const toCreate: { name: string; phone: string | null; address: string | null; class: string; gender: string | null; type: string }[] = [];
    const errors: string[] = [];

    for (let i = 0; i < raw.length; i++) {
      const row = raw[i];
      const name = String(row?.name ?? "").trim();
      if (!name) {
        errors.push(`Baris ${i + 2}: nama kosong, dilewati`);
        continue;
      }
      const key = name.toLowerCase();
      if (existingSet.has(key) || seen.has(key)) {
        errors.push(`Baris ${i + 2}: "${name}" sudah ada, dilewati`);
        continue;
      }
      seen.add(key);
      toCreate.push({
        name,
        phone: row?.phone ? String(row.phone).trim() || null : null,
        address: row?.address ? String(row.address).trim() || null : null,
        class: normalizeClass(row?.class),
        gender: normalizeGender(row?.gender),
        type: "1",
      });
    }

    let imported = 0;
    if (toCreate.length > 0) {
      await prisma.$transaction(async (tx) => {
        for (const m of toCreate) {
          await tx.member.create({ data: { pbId, ...m, isActive: true } });
          imported++;
        }
      });
    }

    return NextResponse.json({ imported, skipped: raw.length - imported, errors }, { status: 200 });
  } catch (error) {
    console.error("POST /api/members/import error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

/* ============================================================ */
/* users / user-levels / auth                                    */
/* ============================================================ */
async function usersGet(request: Request) {
  try {
    const url = new URL(request.url);
    const queryPbId = url.searchParams.get("pbId");
    const headerPbId = request.headers.get("x-pb-id");
    const pbId = queryPbId || headerPbId;
    const where = pbId ? { pbId } : {};
    const users = await prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: { level: true },
    });
    return NextResponse.json(users);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

async function usersPost(request: Request) {
  try {
    const body = await request.json();
    const { fullName, email, phone, password, role, levelId, avatarUrl } = body;

    if (!fullName || !email || !password) {
      return NextResponse.json({ error: "Nama, email, dan password harus diisi" }, { status: 400 });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: "Email sudah digunakan" }, { status: 409 });
    }

    const pbId = body.pbId || request.headers.get("x-pb-id") || "default";
    let resolvedLevelId = levelId;
    if (!resolvedLevelId && (role || "admin_pb") === "admin_pb") {
      const adminLevel = await prisma.userLevel.findUnique({ where: { slug: "admin" } });
      if (adminLevel) resolvedLevelId = adminLevel.id;
    }
    const hashed = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        fullName,
        email,
        phone: phone || null,
        password: hashed,
        role: role || "admin_pb",
        levelId: resolvedLevelId || null,
        avatarUrl: avatarUrl || null,
        pbId,
      },
      include: { level: true },
    });
    return NextResponse.json(user, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

async function userPut(request: Request, { params }: P<{ id: string }>) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { fullName, email, phone, password, role, levelId, avatarUrl } = body;

    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "User tidak ditemukan" }, { status: 404 });
    }

    if (email && email !== existing.email) {
      const dup = await prisma.user.findUnique({ where: { email } });
      if (dup) return NextResponse.json({ error: "Email sudah digunakan" }, { status: 409 });
    }

    const data: Record<string, unknown> = {};
    if (fullName !== undefined) data.fullName = fullName;
    if (email !== undefined) data.email = email;
    if (phone !== undefined) data.phone = phone || null;
    if (role !== undefined) data.role = role;
    if (levelId !== undefined) data.levelId = levelId || null;
    if (avatarUrl !== undefined) data.avatarUrl = avatarUrl || null;
    if (password) data.password = await bcrypt.hash(password, 10);

    const user = await prisma.user.update({
      where: { id },
      data,
      include: { level: true },
    });
    return NextResponse.json(user);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

async function userDelete(_request: Request, { params }: P<{ id: string }>) {
  try {
    const { id } = await params;
    await prisma.user.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

async function userLevelsGet() {
  try {
    const levels = await prisma.userLevel.findMany({
      orderBy: { createdAt: "asc" },
      include: { _count: { select: { users: true } } },
    });
    return NextResponse.json(levels);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

async function userLevelsPost(request: Request) {
  try {
    const body = await request.json();
    const { name, slug, description, color, menus } = body;

    if (!name || !slug) {
      return NextResponse.json({ error: "Nama dan slug harus diisi" }, { status: 400 });
    }

    const dup = await prisma.userLevel.findFirst({
      where: { OR: [{ name }, { slug }] },
    });
    if (dup) {
      return NextResponse.json({ error: "Nama atau slug sudah digunakan" }, { status: 409 });
    }

    const level = await prisma.userLevel.create({
      data: { name, slug, description: description || null, color: color || "var(--color-primary)", menus: menus || [] },
      include: { _count: { select: { users: true } } },
    });
    return NextResponse.json(level, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

async function userLevelPut(request: Request, { params }: P<{ id: string }>) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, slug, description, color, menus } = body;

    const existing = await prisma.userLevel.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Level tidak ditemukan" }, { status: 404 });
    }

    if (name && name !== existing.name) {
      const dup = await prisma.userLevel.findUnique({ where: { name } });
      if (dup) return NextResponse.json({ error: "Nama sudah digunakan" }, { status: 409 });
    }
    if (slug && slug !== existing.slug) {
      const dup = await prisma.userLevel.findUnique({ where: { slug } });
      if (dup) return NextResponse.json({ error: "Slug sudah digunakan" }, { status: 409 });
    }

    const data: Record<string, unknown> = {};
    if (name !== undefined) data.name = name;
    if (slug !== undefined) data.slug = slug;
    if (description !== undefined) data.description = description || null;
    if (color !== undefined) data.color = color || "var(--color-primary)";
    if (menus !== undefined) data.menus = menus;

    const level = await prisma.userLevel.update({
      where: { id },
      data,
      include: { _count: { select: { users: true } } },
    });
    return NextResponse.json(level);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

async function userLevelDelete(_request: Request, { params }: P<{ id: string }>) {
  try {
    const { id } = await params;
    const count = await prisma.user.count({ where: { levelId: id } });
    if (count > 0) {
      return NextResponse.json({ error: "Level masih digunakan oleh " + count + " user. Hapus atau pindahkan user terlebih dahulu." }, { status: 400 });
    }
    await prisma.userLevel.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

async function authLoginPost(request: Request) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ error: "Email dan password harus diisi" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        level: { select: { id: true, name: true, slug: true, menus: true } },
        pb: { select: { id: true, name: true, logoUrl: true, primaryColor: true } },
      },
    });

    if (!user) {
      return NextResponse.json({ error: "Email tidak ditemukan" }, { status: 401 });
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return NextResponse.json({ error: "Password salah" }, { status: 401 });
    }

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        pbId: user.pbId,
        levelId: user.levelId,
        level: user.level,
        pb: user.pb,
        primaryColor: user.pb?.primaryColor || null,
      },
    });
  } catch (error) {
    console.error("POST /api/auth/login error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

async function authPromotePost() {
  try {
    const firstUser = await prisma.user.findFirst({ orderBy: { createdAt: "asc" } });
    if (!firstUser) {
      return NextResponse.json({ error: "Tidak ada user ditemukan. Jalankan setup dulu." }, { status: 400 });
    }
    if (firstUser.role === "superadmin") {
      return NextResponse.json({ message: "User sudah menjadi Super Admin" });
    }
    const user = await prisma.user.update({
      where: { id: firstUser.id },
      data: { role: "superadmin" },
    });
    return NextResponse.json({
      message: "User berhasil dipromosikan menjadi Super Admin",
      email: user.email,
      role: user.role,
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

/* ============================================================ */
/* pbs / teams / schedules / tournaments                         */
/* ============================================================ */
async function pbsGet() {
  try {
    const pbs = await prisma.pb.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { users: true, members: true, schedules: true } },
      },
    });
    return NextResponse.json(pbs);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

async function pbsPost(request: Request) {
  try {
    const body = await request.json();
    const { name, slug, address, phone, adminEmail, adminFullName, adminPassword } = body;

    if (!name || !slug || !adminEmail || !adminPassword) {
      return NextResponse.json({ error: "Nama, slug, email admin, dan password admin harus diisi" }, { status: 400 });
    }

    const existing = await prisma.pb.findUnique({ where: { slug } });
    if (existing) {
      return NextResponse.json({ error: "Slug sudah digunakan" }, { status: 409 });
    }

    const emailExists = await prisma.user.findUnique({ where: { email: adminEmail } });
    if (emailExists) {
      return NextResponse.json({ error: "Email admin sudah digunakan" }, { status: 409 });
    }

    const adminLevel = await prisma.userLevel.findUnique({ where: { slug: "admin" } });

    const pb = await prisma.pb.create({
      data: {
        name,
        slug,
        address: address || null,
        phone: phone || null,
        users: {
          create: {
            email: adminEmail,
            fullName: adminFullName || "Admin " + name,
            password: await bcrypt.hash(adminPassword, 10),
            role: "admin_pb",
            levelId: adminLevel?.id || null,
          },
        },
      },
      include: { _count: { select: { users: true, members: true, schedules: true } } },
    });

    return NextResponse.json(pb, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

async function pbGet(_request: Request, { params }: P<{ id: string }>) {
  try {
    const { id } = await params;
    const pb = await prisma.pb.findUnique({ where: { id } });
    if (!pb) return NextResponse.json({ error: "PB tidak ditemukan" }, { status: 404 });
    return NextResponse.json(pb);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

async function pbPut(request: Request, { params }: P<{ id: string }>) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, slug, address, phone } = body;

    const existing = await prisma.pb.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "PB tidak ditemukan" }, { status: 404 });
    }

    if (slug && slug !== existing.slug) {
      const dup = await prisma.pb.findUnique({ where: { slug } });
      if (dup) return NextResponse.json({ error: "Slug sudah digunakan" }, { status: 409 });
    }

    const data: Record<string, unknown> = {};
    if (name !== undefined) data.name = name;
    if (slug !== undefined) data.slug = slug;
    if (address !== undefined) data.address = address || null;
    if (phone !== undefined) data.phone = phone || null;
    if (body.logoUrl !== undefined) data.logoUrl = body.logoUrl || null;
    if (body.favicon !== undefined) data.favicon = body.favicon || null;
    if (body.primaryColor !== undefined) data.primaryColor = body.primaryColor || null;
    if (body.captionColor !== undefined) data.captionColor = body.captionColor || null;
    if (body.bgColor !== undefined) data.bgColor = body.bgColor || null;
    if (body.cockPrice !== undefined) data.cockPrice = Number(body.cockPrice) || 0;

    const pb = await prisma.pb.update({
      where: { id },
      data,
      include: { _count: { select: { users: true, members: true, schedules: true } } },
    });
    return NextResponse.json(pb);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

async function pbDelete(_request: Request, { params }: P<{ id: string }>) {
  try {
    const { id } = await params;
    const pb = await prisma.pb.findUnique({ where: { id } });
    if (!pb) {
      return NextResponse.json({ error: "PB tidak ditemukan" }, { status: 404 });
    }
    await prisma.pb.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

async function teamsGet(request: Request) {
  const pbId = request.headers.get("x-pb-id");
  if (!pbId) return NextResponse.json({ error: "x-pb-id required" }, { status: 400 });
  const teams = await prisma.team.findMany({
    where: { tournament: { pbId } },
    include: { players: true },
    orderBy: { name: "asc" },
  });
  return NextResponse.json(teams);
}

async function teamsPost(request: Request) {
  try {
    const body = await request.json();

    if (body.memberIds?.length) {
      const existing = await prisma.teamPlayer.findMany({
        where: { memberId: { in: body.memberIds }, team: { tournamentId: body.tournamentId } },
        include: { team: { select: { name: true } } },
      });
      if (existing.length) {
        const names = existing.map((e) => `${e.memberId} (sudah di tim ${e.team.name})`);
        return NextResponse.json({ error: `Pemain sudah terdaftar di tim lain: ${names.join(", ")}` }, { status: 409 });
      }
    }

    const team = await prisma.team.create({
      data: { tournamentId: body.tournamentId, name: body.name, color: body.color || "#0d9488", icon: body.icon || null },
      include: { players: true },
    });
    if (body.memberIds?.length) {
      await prisma.teamPlayer.createMany({
        data: body.memberIds.map((memberId: string) => ({ teamId: team.id, memberId })),
      });
    }
    const result = await prisma.team.findUnique({ where: { id: team.id }, include: { players: true } });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error("POST /api/teams error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

async function teamPut(request: Request, { params }: P<{ id: string }>) {
  try {
    const { id } = await params;
    const body = await request.json();
    const team = await prisma.team.update({ where: { id }, data: { name: body.name, color: body.color, icon: body.icon ?? undefined }, include: { players: true } });
    if (body.memberIds) {
      await prisma.teamPlayer.deleteMany({ where: { teamId: id } });
      if (body.memberIds.length) {
        await prisma.teamPlayer.createMany({
          data: body.memberIds.map((memberId: string) => ({ teamId: id, memberId })),
        });
      }
    }
    const result = await prisma.team.findUnique({ where: { id }, include: { players: true } });
    return NextResponse.json(result);
  } catch (error) {
    console.error("PUT /api/teams/[id] error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

async function teamDelete(_request: Request, { params }: P<{ id: string }>) {
  try {
    const { id } = await params;
    await prisma.teamPlayer.deleteMany({ where: { teamId: id } });
    await prisma.team.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/teams/[id] error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

async function schedulesGet(request: Request) {
  const url = new URL(request.url);
  const queryPbId = url.searchParams.get("pbId");
  const pbId = queryPbId || request.headers.get("x-pb-id");
  const where = pbId ? { pbId } : {};
  const schedules = await prisma.schedule.findMany({ where, orderBy: { date: "desc" } });
  return NextResponse.json(schedules);
}

async function schedulesPost(request: Request) {
  try {
    const body = await request.json();
    const pbId = request.headers.get("x-pb-id") || body.pbId || "default";
    const schedule = await prisma.schedule.create({
      data: {
        pbId,
        title: body.title,
        date: new Date(body.date),
        startTime: body.startTime || null,
        endTime: body.endTime || null,
        location: body.location || null,
        maxParticipants: body.maxParticipants ?? 20,
        courts: body.courts || null,
        htm: body.htm ?? null,
        htmInsidentil: body.htmInsidentil ?? null,
        cockPrice: body.cockPrice ?? 0,
        notes: body.notes || null,
        sparingOpponent: body.sparingOpponent || null,
        logoUrl: body.logoUrl || null,
        status: body.status || "planned",
        createdBy: body.createdBy || null,
      },
    });
    return NextResponse.json(schedule, { status: 201 });
  } catch (error) {
    console.error("POST /api/schedules error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

async function schedulePut(request: Request, { params }: P<{ id: string }>) {
  try {
    const { id } = await params;
    const body = await request.json();
    const data: Record<string, unknown> = {};
    if (body.title !== undefined) data.title = body.title;
    if (body.date !== undefined) data.date = new Date(body.date);
    if (body.startTime !== undefined) data.startTime = body.startTime || null;
    if (body.endTime !== undefined) data.endTime = body.endTime || null;
    if (body.location !== undefined) data.location = body.location || null;
    if (body.maxParticipants !== undefined) data.maxParticipants = body.maxParticipants ?? 20;
    if (body.courts !== undefined) data.courts = body.courts || null;
    if (body.htm !== undefined) data.htm = body.htm ?? null;
    if (body.htmInsidentil !== undefined) data.htmInsidentil = body.htmInsidentil ?? null;
    if (body.cockPrice !== undefined) data.cockPrice = Number(body.cockPrice) || 0;
    if (body.notes !== undefined) data.notes = body.notes || null;
    if (body.sparingOpponent !== undefined) data.sparingOpponent = body.sparingOpponent || null;
    if (body.logoUrl !== undefined) data.logoUrl = body.logoUrl || null;
    if (body.status !== undefined) data.status = body.status || "planned";
    const schedule = await prisma.schedule.update({ where: { id }, data });
    return NextResponse.json(schedule);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const stack = e instanceof Error ? e.stack : "";
    console.error("PUT /api/schedules/[id] error:", msg, stack);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

async function scheduleDelete(_request: Request, { params }: P<{ id: string }>) {
  const { id } = await params;
  await prisma.schedule.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}

async function tournamentsGet(request: Request) {
  const pbId = request.headers.get("x-pb-id");
  const where = pbId ? { pbId } : {};
  const tournaments = await prisma.tournament.findMany({
    where,
    include: { teams: { include: { players: true } }, _count: { select: { schedules: true } } },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(tournaments);
}

async function tournamentsPost(request: Request) {
  try {
    const body = await request.json();
    const pbId = request.headers.get("x-pb-id") || body.pbId || "default";
    const tournament = await prisma.tournament.create({
      data: { pbId, name: body.name, status: body.status || "planned", totalMatchGoal: body.totalMatchGoal ?? null, maxMatchPerTeam: body.maxMatchPerTeam ?? null, gameFormat: body.gameFormat ?? "1x30", courts: body.courts ?? null },
    });
    return NextResponse.json(tournament, { status: 201 });
  } catch (error) {
    console.error("POST /api/tournaments error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

async function tournamentGet(request: Request, { params }: P<{ id: string }>) {
  const { id } = await params;
  const pbId = request.headers.get("x-pb-id");
  const tournament = await prisma.tournament.findFirst({
    where: { id, ...(pbId ? { pbId } : {}) },
    include: { teams: { include: { players: true } }, schedules: { include: { matches: true, team1: true, team2: true }, orderBy: { date: "asc" } } },
  });
  if (!tournament) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(tournament);
}

async function tournamentPut(request: Request, { params }: P<{ id: string }>) {
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
    if (body.standingsMode !== undefined) data.standingsMode = body.standingsMode;
    if (body.winPoints !== undefined) data.winPoints = body.winPoints;
    if (body.drawPoints !== undefined) data.drawPoints = body.drawPoints;
    if (body.lossPoints !== undefined) data.lossPoints = body.lossPoints;
    const updated = await prisma.tournament.update({ where: { id }, data });
    return NextResponse.json(updated);
  } catch (error) {
    console.error("PUT /api/tournaments/[id] error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

async function tournamentDelete(request: Request, { params }: P<{ id: string }>) {
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

async function tournamentGeneratePost(request: Request, { params }: P<{ id: string }>) {
  try {
    const { id } = await params;
    const pbId = request.headers.get("x-pb-id");
    const tournament = await prisma.tournament.findFirst({
      where: { id, ...(pbId ? { pbId } : {}) },
      include: { teams: true },
    });
    if (!tournament) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (tournament.teams.length < 2) return NextResponse.json({ error: "Minimal 2 tim" }, { status: 400 });

    const teamIds = tournament.teams.map((t) => t.id);
    const pairs: { team1Id: string; team2Id: string }[] = [];
    for (let i = 0; i < teamIds.length; i++) {
      for (let j = i + 1; j < teamIds.length; j++) {
        pairs.push({ team1Id: teamIds[i], team2Id: teamIds[j] });
      }
    }

    const existing = await prisma.schedule.findMany({ where: { tournamentId: id } });
    const existingPairs = new Set(existing.map((s) => [s.team1Id, s.team2Id].sort().join(":")));

    let created = 0;
    for (const pair of pairs) {
      const key = [pair.team1Id, pair.team2Id].sort().join(":");
      if (existingPairs.has(key)) continue;
      const team1 = tournament.teams.find((t) => t.id === pair.team1Id);
      const team2 = tournament.teams.find((t) => t.id === pair.team2Id);
      await prisma.schedule.create({
        data: {
          pbId: tournament.pbId,
          title: `${tournament.name}: ${team1?.name} vs ${team2?.name}`,
          date: new Date(),
          tournamentId: id,
          team1Id: pair.team1Id,
          team2Id: pair.team2Id,
          status: "planned",
          maxParticipants: 20,
        },
      });
      created++;
    }

    return NextResponse.json({ created, total: pairs.length });
  } catch (error) {
    console.error("POST /api/tournaments/[id]/generate error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

async function tournamentMatchPost(request: Request, { params }: P<{ id: string }>) {
  try {
    const { id } = await params;
    const body = await request.json();

    const tournament = await prisma.tournament.findUnique({ where: { id }, include: { teams: { include: { players: true } } } });
    if (!tournament) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const pbId = tournament.pbId;

    const teamA = tournament.teams.find((t) => t.id === body.team1Id);
    const teamB = tournament.teams.find((t) => t.id === body.team2Id);
    if (!teamA || !teamB) return NextResponse.json({ error: "Tim tidak ditemukan" }, { status: 400 });

    const teamAPlayers = teamA.players.map((p) => p.memberId);
    const teamBPlayers = teamB.players.map((p) => p.memberId);
    if (!teamAPlayers.includes(body.team1Player1Id) || !teamAPlayers.includes(body.team1Player2Id))
      return NextResponse.json({ error: "Pemain tidak terdaftar di tim A" }, { status: 400 });
    if (!teamBPlayers.includes(body.team2Player1Id) || !teamBPlayers.includes(body.team2Player2Id))
      return NextResponse.json({ error: "Pemain tidak terdaftar di tim B" }, { status: 400 });

    if (tournament.maxMatchPerTeam) {
      const matchCountA = await prisma.match.count({
        where: { schedule: { tournamentId: id }, OR: [{ team1Player1Id: { in: teamAPlayers } }, { team1Player2Id: { in: teamAPlayers } }, { team2Player1Id: { in: teamAPlayers } }, { team2Player2Id: { in: teamAPlayers } }] },
      });
      if (matchCountA >= tournament.maxMatchPerTeam)
        return NextResponse.json({ error: `Tim ${teamA.name} sudah mencapai batas maksimal ${tournament.maxMatchPerTeam} pertandingan` }, { status: 400 });
    }

    if (tournament.totalMatchGoal) {
      const totalMatches = await prisma.match.count({ where: { schedule: { tournamentId: id } } });
      if (totalMatches >= tournament.totalMatchGoal)
        return NextResponse.json({ error: `Total pertandingan sudah mencapai ${tournament.totalMatchGoal}` }, { status: 400 });
    }

    const schedule = await prisma.schedule.create({
      data: {
        pbId,
        title: `${tournament.name}: ${teamA.name} vs ${teamB.name} (${new Date().toLocaleDateString("id-ID")})`,
        date: new Date(),
        tournamentId: id,
        team1Id: body.team1Id,
        team2Id: body.team2Id,
        status: "planned",
        maxParticipants: 20,
        courts: body.courtNumber ? JSON.stringify([{ name: `Lapangan ${body.courtNumber}`, startTime: "", endTime: "" }]) : null,
      },
    });

    const match = await prisma.match.create({
      data: {
        scheduleId: schedule.id,
        pbId,
        courtNumber: body.courtNumber || null,
        round: 1,
        team1Player1Id: body.team1Player1Id,
        team1Player2Id: body.team1Player2Id,
        team2Player1Id: body.team2Player1Id,
        team2Player2Id: body.team2Player2Id,
        status: "scheduled",
      },
    });

    return NextResponse.json({ schedule, match }, { status: 201 });
  } catch (error) {
    console.error("POST /api/tournaments/[id]/match error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

/* ============================================================ */
/* matches / attendances / match-cards / match-history           */
/* ============================================================ */
async function matchesGet(request: Request) {
  try {
    const url = new URL(request.url);
    const queryPbId = url.searchParams.get("pbId");
    const pbId = queryPbId || request.headers.get("x-pb-id");
    const ids = url.searchParams.get("ids");
    const where: Record<string, unknown> = pbId ? { pbId } : {};
    if (ids) where.id = { in: ids.split(",") };
    const matches = await prisma.match.findMany({ where, orderBy: { createdAt: "desc" } });
    return NextResponse.json(matches);
  } catch (error) {
    console.error("GET /api/matches error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

async function matchesPost(request: Request) {
  try {
    const body = await request.json();
    const pbId = request.headers.get("x-pb-id") || body.pbId || "default";
    const match = await prisma.match.create({
      data: {
        scheduleId: body.scheduleId,
        pbId,
        courtNumber: body.courtNumber ?? null,
        round: body.round ?? 1,
        team1Player1Id: body.team1Player1Id,
        team1Player2Id: body.team1Player2Id,
        team2Player1Id: body.team2Player1Id,
        team2Player2Id: body.team2Player2Id,
        scoreTeam1: body.scoreTeam1 ?? null,
        scoreTeam2: body.scoreTeam2 ?? null,
        scoreTeam1Game2: body.scoreTeam1Game2 ?? null,
        scoreTeam2Game2: body.scoreTeam2Game2 ?? null,
        scoreTeam1Game3: body.scoreTeam1Game3 ?? null,
        scoreTeam2Game3: body.scoreTeam2Game3 ?? null,
        totalGames: body.totalGames ?? 1,
        winnerTeam: body.winnerTeam ?? null,
        status: body.status || "scheduled",
        notes: body.notes || null,
      },
    });
    broadcast(JSON.stringify({ type: "match-created", match }));
    return NextResponse.json(match, { status: 201 });
  } catch (error) {
    console.error("POST /api/matches error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

async function matchPut(request: Request, { params }: P<{ id: string }>) {
  try {
    const { id } = await params;
    const body = await request.json();
    const data: Record<string, unknown> = {};
    const fields = ["scheduleId","pbId","courtNumber","round","team1Player1Id","team1Player2Id","team2Player1Id","team2Player2Id","scoreTeam1","scoreTeam2","scoreTeam1Game2","scoreTeam2Game2","scoreTeam1Game3","scoreTeam2Game3","totalGames","winnerTeam","cockCount","status","notes"];
    for (const f of fields) {
      if (body[f] !== undefined) data[f] = body[f];
    }
    const match = await prisma.match.update({ where: { id }, data });
    broadcast(JSON.stringify({ type: "match-updated", match }));
    return NextResponse.json(match);
  } catch (error) {
    console.error("PUT /api/matches/[id] error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

async function matchDelete(_request: Request, { params }: P<{ id: string }>) {
  try {
    const { id } = await params;
    await prisma.match.delete({ where: { id } });
    broadcast(JSON.stringify({ type: "match-deleted", matchId: id }));
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/matches/[id] error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

async function matchesBatchPost(request: Request) {
  const body = await request.json();
  const pbId = request.headers.get("x-pb-id") || body.pbId || "default";
  const matchesData = body.matches as Record<string, unknown>[];
  if (!Array.isArray(matchesData) || matchesData.length === 0) {
    return NextResponse.json({ error: "matches array required" }, { status: 400 });
  }
  const created = await prisma.$transaction(
    matchesData.map((m) =>
      prisma.match.create({
        data: {
          scheduleId: m.scheduleId as string,
          pbId,
          courtNumber: (m.courtNumber as number) ?? null,
          round: (m.round as number) ?? 1,
          team1Player1Id: m.team1Player1Id as string,
          team1Player2Id: m.team1Player2Id as string,
          team2Player1Id: m.team2Player1Id as string,
          team2Player2Id: m.team2Player2Id as string,
          scoreTeam1: (m.scoreTeam1 as number) ?? null,
          scoreTeam2: (m.scoreTeam2 as number) ?? null,
          scoreTeam1Game2: (m.scoreTeam1Game2 as number) ?? null,
          scoreTeam2Game2: (m.scoreTeam2Game2 as number) ?? null,
          scoreTeam1Game3: (m.scoreTeam1Game3 as number) ?? null,
          scoreTeam2Game3: (m.scoreTeam2Game3 as number) ?? null,
          totalGames: (m.totalGames as number) ?? 1,
          winnerTeam: (m.winnerTeam as number) ?? null,
          status: (m.status as string) || "scheduled",
          notes: (m.notes as string) || null,
        },
      })
    )
  );
  for (const match of created) {
    broadcast(JSON.stringify({ type: "match-created", match }));
  }
  return NextResponse.json(created, { status: 201 });
}

async function matchesStreamGet() {
  const encoder = new TextEncoder();

  let cleanup: (() => void) | null = null;

  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode("data: connected\n\n"));

      const unsub = subscribe((data) => {
        try {
          controller.enqueue(encoder.encode(`data: ${data}\n\n`));
        } catch {
          // client disconnected
        }
      });

      const keepAlive = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": keepalive\n\n"));
        } catch {
          // ignore
        }
      }, 30000);

      cleanup = () => {
        clearInterval(keepAlive);
        unsub();
      };
    },
    cancel() {
      cleanup?.();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

async function attendancesGet(request: Request) {
  try {
    const url = new URL(request.url);
    const pbId = url.searchParams.get("pbId");
    const scheduleId = url.searchParams.get("scheduleId");
    const where = scheduleId
      ? { scheduleId }
      : pbId
        ? { schedule: { pbId } }
        : {};
    const attendances = await prisma.attendance.findMany({ where });
    return NextResponse.json(attendances);
  } catch (error) {
    console.error("GET /api/attendances error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

async function attendancesPost(request: Request) {
  const body = await request.json();
  try {
    if (!body.scheduleId || !body.memberId) {
      return NextResponse.json({ error: "scheduleId dan memberId wajib diisi" }, { status: 400 });
    }
    const existing = await prisma.attendance.findUnique({
      where: { scheduleId_memberId: { scheduleId: body.scheduleId, memberId: body.memberId } },
    });
    if (existing) {
      const attendance = await prisma.attendance.update({
        where: { id: existing.id },
        data: {
          status: body.status || "hadir",
          confirmedAt: body.confirmedAt ? new Date(body.confirmedAt) : new Date(),
        },
      });
      return NextResponse.json(attendance, { status: 200 });
    }
    const attendance = await prisma.attendance.create({
      data: {
        scheduleId: body.scheduleId,
        memberId: body.memberId,
        status: body.status || "hadir",
        confirmedAt: body.confirmedAt ? new Date(body.confirmedAt) : new Date(),
      },
    });
    return NextResponse.json(attendance, { status: 201 });
  } catch (error) {
    console.error("POST /api/attendances error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

async function attendancePut(request: Request, { params }: P<{ id: string }>) {
  const { id } = await params;
  const body = await request.json();
  const attendance = await prisma.attendance.update({ where: { id }, data: body });
  return NextResponse.json(attendance);
}

async function attendanceDelete(_request: Request, { params }: P<{ id: string }>) {
  const { id } = await params;
  await prisma.attendance.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}

async function attendancesBatchPost(request: Request) {
  const body = await request.json();
  const { scheduleId, attendances } = body as { scheduleId: string; attendances: { memberId: string; status: string }[] };
  if (!scheduleId || !Array.isArray(attendances)) {
    return NextResponse.json({ error: "scheduleId and attendances array required" }, { status: 400 });
  }
  const result = await prisma.$transaction(async (tx) => {
    await tx.attendance.deleteMany({ where: { scheduleId } });
    const created = await Promise.all(
      attendances.map((a) =>
        tx.attendance.create({
          data: { scheduleId, memberId: a.memberId, status: a.status, confirmedAt: new Date() },
        })
      )
    );
    return created;
  });
  return NextResponse.json(result, { status: 201 });
}

const MATCH_CARD_RETENTION_MS = 3 * 24 * 60 * 60 * 1000;

async function runMatchCardCleanup() {
  const cutoff = new Date(Date.now() - MATCH_CARD_RETENTION_MS);
  const deleted = await prisma.matchCard.deleteMany({
    where: { createdAt: { lt: cutoff } },
  });
  if (deleted.count > 0) console.log(`[match-cards] cleanup: deleted ${deleted.count} expired cards`);
  return deleted.count;
}

function getPbId(request: Request): string {
  const url = new URL(request.url);
  return url.searchParams.get("pbId") || request.headers.get("x-pb-id") || "default";
}

async function matchCardsPost(request: Request) {
  try {
    const body = await request.json();
    const matchId = body.matchId as string;
    const photo = body.photo as string | undefined;
    if (!matchId) {
      return NextResponse.json({ error: "matchId required" }, { status: 400 });
    }
    const pbId = getPbId(request);
    const existing = await prisma.matchCard.findUnique({ where: { matchId } });
    const card = existing
      ? await prisma.matchCard.update({
          where: { matchId },
          data: { photo: photo ?? existing.photo, pbId },
        })
      : await prisma.matchCard.create({
          data: { matchId, pbId, photo: photo ?? null },
        });
    return NextResponse.json({ id: card.id, matchId: card.matchId, pbId: card.pbId, hasPhoto: !!card.photo, createdAt: card.createdAt }, { status: 201 });
  } catch (error) {
    console.error("POST /api/match-cards error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

async function matchCardsGet(request: Request) {
  try {
    await runMatchCardCleanup();
    const pbId = getPbId(request);
    const where = pbId === "default" ? Prisma.sql`1=1` : Prisma.sql`pb_id = ${pbId}`;
    const rows = await prisma.$queryRaw<{ id: string; match_id: string; pb_id: string; has_photo: boolean; created_at: Date }[]>`
      SELECT id, match_id, pb_id, (photo IS NOT NULL) AS has_photo, created_at
      FROM match_cards
      WHERE ${where}
      ORDER BY created_at DESC`;
    return NextResponse.json(
      rows.map((r) => ({ id: r.id, matchId: r.match_id, pbId: r.pb_id, hasPhoto: r.has_photo, createdAt: r.created_at }))
    );
  } catch (error) {
    console.error("GET /api/match-cards error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

async function matchCardGet(_request: Request, { params }: P<{ matchId: string }>) {
  const { matchId } = await params;
  const card = await prisma.matchCard.findUnique({
    where: { matchId },
    select: { id: true, matchId: true, pbId: true, photo: true, createdAt: true },
  });
  if (!card) return NextResponse.json({ error: "Card tidak ditemukan" }, { status: 404 });
  return NextResponse.json({ id: card.id, matchId: card.matchId, pbId: card.pbId, hasPhoto: !!card.photo, createdAt: card.createdAt });
}

async function matchCardDelete(_request: Request, { params }: P<{ matchId: string }>) {
  const { matchId } = await params;
  await prisma.matchCard.deleteMany({ where: { matchId } });
  return NextResponse.json({ ok: true });
}

async function matchCardPhoto(_request: Request, { params }: P<{ matchId: string }>) {
  const { matchId } = await params;
  const card = await prisma.matchCard.findUnique({ where: { matchId }, select: { photo: true } });
  if (!card?.photo) return new NextResponse("Not Found", { status: 404 });
  const m = card.photo.match(/^data:(image\/[a-z+]+);base64,([\s\S]+)$/);
  const buf = Buffer.from(m ? m[2] : card.photo, "base64");
  const type = m ? m[1] : "image/png";
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": type,
      "Cache-Control": "public, max-age=86400",
      "Content-Length": String(buf.length),
    },
  });
}

async function matchCardsCleanupGet() {
  try {
    const count = await runMatchCardCleanup();
    return NextResponse.json({ ok: true, deleted: count });
  } catch (error) {
    console.error("GET /api/match-cards/cleanup error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

async function matchHistoryGet(request: Request) {
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

async function matchHistoryPost(request: Request) {
  const body = await request.json();
  const pbId = request.headers.get("x-pb-id") || body.pbId || "default";
  const h = await prisma.matchHistory.create({ data: { ...body, pbId } });
  return NextResponse.json(h, { status: 201 });
}

/* ============================================================ */
/* kas-mutasi / kas-biaya / laba-rugi / hutang                   */
/* ============================================================ */
async function kasMutasiGet(request: Request) {
  const pbId = request.headers.get("x-pb-id");
  const where = pbId ? { pbId } : {};
  const items = await prisma.kasMutasi.findMany({ where, orderBy: { tanggal: "desc" } });
  return NextResponse.json(items);
}

async function kasMutasiPost(request: Request) {
  try {
    const body = await request.json();
    const pbId = request.headers.get("x-pb-id") || body.pbId || "default";
    const item = await prisma.kasMutasi.create({
      data: {
        pbId,
        type: body.type,
        biayaId: body.biayaId || null,
        description: body.description,
        amount: parseInt(body.amount),
        tanggal: body.tanggal ? new Date(body.tanggal) : new Date(),
        reference: body.reference || null,
        memberId: body.memberId || null,
        scheduleId: body.scheduleId || null,
        createdBy: body.createdBy || null,
      },
    });
    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    console.error("POST /api/kas-mutasi error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

async function kasMutasiPut(request: Request, { params }: P<{ id: string }>) {
  const { id } = await params;
  const body = await request.json();
  const data: Record<string, unknown> = { ...body };
  if (body.amount !== undefined) data.amount = parseInt(body.amount);
  if (body.tanggal) data.tanggal = new Date(body.tanggal);
  const item = await prisma.kasMutasi.update({ where: { id }, data });
  return NextResponse.json(item);
}

async function kasMutasiDelete(_request: Request, { params }: P<{ id: string }>) {
  const { id } = await params;
  await prisma.kasMutasi.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}

async function kasBiayaGet(request: Request) {
  const pbId = request.headers.get("x-pb-id");
  const where = pbId ? { pbId } : {};
  const items = await prisma.kasBiaya.findMany({ where, orderBy: { createdAt: "desc" } });
  return NextResponse.json(items);
}

async function kasBiayaPost(request: Request) {
  try {
    const body = await request.json();
    const pbId = request.headers.get("x-pb-id") || body.pbId || "default";
    const item = await prisma.kasBiaya.create({
      data: {
        pbId,
        name: body.name,
        type: body.type,
        amount: body.amount ? parseInt(body.amount) : null,
        description: body.description || null,
        isActive: body.isActive ?? true,
      },
    });
    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    console.error("POST /api/kas-biaya error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

async function kasBiayaPut(request: Request, { params }: P<{ id: string }>) {
  const { id } = await params;
  const body = await request.json();
  const data: Record<string, unknown> = { ...body };
  if (body.amount !== undefined) data.amount = body.amount ? parseInt(body.amount) : null;
  const item = await prisma.kasBiaya.update({ where: { id }, data });
  return NextResponse.json(item);
}

async function kasBiayaDelete(_request: Request, { params }: P<{ id: string }>) {
  const { id } = await params;
  await prisma.kasBiaya.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}

async function labaRugiGet(request: Request) {
  try {
    const pbId = request.headers.get("x-pb-id");
    if (!pbId) return NextResponse.json({ error: "x-pb-id required" }, { status: 400 });

    const items = await prisma.labaRugi.findMany({
      where: { pbId },
      include: {
        schedule: true,
        cockBiaya: true,
        courtBiaya: true,
      },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(items);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

async function labaRugiPost(request: Request) {
  try {
    const pbId = request.headers.get("x-pb-id");
    if (!pbId) return NextResponse.json({ error: "x-pb-id required" }, { status: 400 });

    const body = await request.json();
    const { scheduleId } = body;
    if (!scheduleId) return NextResponse.json({ error: "scheduleId required" }, { status: 400 });

    const schedule = await prisma.schedule.findUnique({ where: { id: scheduleId } });
    if (!schedule) return NextResponse.json({ error: "Schedule not found" }, { status: 404 });

    const htm = schedule.htm || 0;
    let paidMembers: string[] = [];
    try {
      if (schedule.notes) {
        const parsed = JSON.parse(schedule.notes);
        if (Array.isArray(parsed.paidMembers)) paidMembers = parsed.paidMembers;
      }
    } catch {}

    const mutations = await prisma.kasMutasi.findMany({
      where: { OR: [{ scheduleId }, { reference: scheduleId }], void: 0 },
      include: { biaya: true },
    });

    const bayarIncome = mutations
      .filter((m) => m.type === "masuk" && m.description?.startsWith("Bayar HTM"))
      .reduce((sum, m) => sum + (m.amount || 0), 0);

    const totalIncome = bayarIncome > 0 ? bayarIncome : htm * paidMembers.length;

    let autoCockCost = 0;
    let autoCourtCost = 0;
    let autoCockBiayaId: string | null = null;
    let autoCourtBiayaId: string | null = null;

    for (const m of mutations) {
      if (m.biaya?.type === "cock") {
        autoCockCost += m.amount;
        autoCockBiayaId = m.biayaId;
      } else if (m.biaya?.type === "court") {
        autoCourtCost += m.amount;
        autoCourtBiayaId = m.biayaId;
      }
    }

    const existing = await prisma.labaRugi.findUnique({ where: { scheduleId } });

    const cockCost = autoCockCost > 0 ? autoCockCost : (existing?.cockCost || 0);
    const courtCost = autoCourtCost > 0 ? autoCourtCost : (existing?.courtCost || 0);
    const cockBiayaId = autoCockBiayaId || existing?.cockBiayaId || null;
    const courtBiayaId = autoCourtBiayaId || existing?.courtBiayaId || null;
    const profitLoss = totalIncome - cockCost - courtCost;

    const data = {
      scheduleId,
      pbId,
      totalIncome,
      cockCost,
      courtCost,
      cockBiayaId,
      courtBiayaId,
      profitLoss,
    };

    const item = existing
      ? await prisma.labaRugi.update({ where: { id: existing.id }, data, include: { schedule: true, cockBiaya: true, courtBiaya: true } })
      : await prisma.labaRugi.create({ data, include: { schedule: true, cockBiaya: true, courtBiaya: true } });

    return NextResponse.json(item);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

async function labaRugiPut(request: Request, { params }: P<{ id: string }>) {
  try {
    const { id } = await params;
    const body = await request.json();

    const existing = await prisma.labaRugi.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Data tidak ditemukan" }, { status: 404 });
    }

    const data: Record<string, unknown> = {};
    if (body.cockCost !== undefined) data.cockCost = body.cockCost;
    if (body.courtCost !== undefined) data.courtCost = body.courtCost;
    if (body.cockBiayaId !== undefined) data.cockBiayaId = body.cockBiayaId || null;
    if (body.courtBiayaId !== undefined) data.courtBiayaId = body.courtBiayaId || null;
    if (body.notes !== undefined) data.notes = body.notes;
    if (body.totalIncome !== undefined) data.totalIncome = body.totalIncome;
    if (body.profitLoss !== undefined) data.profitLoss = body.profitLoss;

    const item = await prisma.labaRugi.update({
      where: { id },
      data,
      include: { schedule: true, cockBiaya: true, courtBiaya: true },
    });
    return NextResponse.json(item);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

async function hutangGet(request: Request) {
  const pbId = request.headers.get("x-pb-id");
  const where = pbId ? { pbId } : {};

  const { searchParams } = new URL(request.url);
  const memberId = searchParams.get("memberId");

  const members = await prisma.member.findMany({
    where: { ...(pbId ? { pbId } : {}), isActive: true } as any,
    orderBy: { name: "asc" },
  });

  const schedules = await prisma.schedule.findMany({
    where: { ...where, OR: [{ htm: { gt: 0 } }, { htmInsidentil: { gt: 0 } }], status: { not: "cancelled" } } as any,
    orderBy: { date: "desc" },
  });

  const attendanceSchedules = await prisma.schedule.findMany({
    where: where as any,
    select: { id: true },
  });
  const scheduleIds = attendanceSchedules.map((s) => s.id);
  const attendances = await prisma.attendance.findMany({
    where: { scheduleId: { in: scheduleIds }, status: { in: ["hadir", "undangan"] } },
  });

  const mutasis = await prisma.kasMutasi.findMany({
    where: { ...where, type: "masuk", memberId: { not: null } } as any,
    orderBy: { tanggal: "asc" },
  });

  function getPaidMembers(s: { notes: string | null }): string[] {
    if (!s.notes) return [];
    try { const p = JSON.parse(s.notes); if (Array.isArray(p.paidMembers)) return p.paidMembers; } catch {}
    return [];
  }

  if (memberId) {
    const member = members.find((m) => m.id === memberId);
    if (!member) return NextResponse.json({ error: "Member not found" }, { status: 404 });

    const attIds = attendances.filter((a) => a.memberId === memberId).map((a) => a.scheduleId);

    const entries: {
      type: "saldo_awal" | "htm" | "bayar";
      scheduleId?: string;
      title: string;
      tanggal: string;
      amount: number;
    }[] = [];

    if (member.saldoAwalHutang && member.saldoAwalHutang > 0) {
      entries.push({
        type: "saldo_awal",
        title: "Saldo Awal Hutang",
        tanggal: member.joinedAt.toISOString(),
        amount: member.saldoAwalHutang,
      });
    }

    for (const s of schedules) {
      if (!attIds.includes(s.id)) continue;
      const paidIds = getPaidMembers(s);
      if (!paidIds.includes(memberId)) {
        entries.push({
          type: "htm",
          scheduleId: s.id,
          title: s.sparingOpponent ? `Sparing vs ${s.sparingOpponent}` : s.title,
          tanggal: s.date.toISOString(),
          amount: getHtmRate(s, member),
        });
      }
    }

    for (const m of mutasis) {
      if (m.memberId !== memberId) continue;
      entries.push({
        type: "bayar",
        scheduleId: m.reference || undefined,
        title: m.description,
        tanggal: m.tanggal.toISOString(),
        amount: m.amount,
      });
    }

    entries.sort((a, b) => new Date(a.tanggal).getTime() - new Date(b.tanggal).getTime());

    return NextResponse.json({ member, entries });
  }

  const result = members.map((m) => {
    const attIds = attendances.filter((a) => a.memberId === m.id).map((a) => a.scheduleId);
    let totalUnpaidHtm = 0;
    for (const s of schedules) {
      if (!attIds.includes(s.id)) continue;
      const paidIds = getPaidMembers(s);
      if (!paidIds.includes(m.id)) {
        totalUnpaidHtm += getHtmRate(s, m);
      }
    }
    const totalDebt = (m.saldoAwalHutang || 0) + totalUnpaidHtm;
    return {
      memberId: m.id,
      memberName: m.name,
      memberClass: m.class,
      gender: m.gender,
      saldoAwal: m.saldoAwalHutang || 0,
      totalUnpaidHtm,
      totalDebt,
    };
  });

  return NextResponse.json(result);
}

async function hutangPost(request: Request) {
  try {
    const body = await request.json();
    const pbId = request.headers.get("x-pb-id") || body.pbId;
    if (!pbId) return NextResponse.json({ error: "x-pb-id required" }, { status: 400 });

    const { memberId, scheduleIds } = body;
    if (!memberId || !Array.isArray(scheduleIds) || scheduleIds.length === 0) {
      return NextResponse.json({ error: "memberId and scheduleIds[] required" }, { status: 400 });
    }

    const schedules = await prisma.schedule.findMany({
      where: { id: { in: scheduleIds }, pbId, OR: [{ htm: { gt: 0 } }, { htmInsidentil: { gt: 0 } }] },
    });

    const created: { scheduleId: string; amount: number }[] = [];

    for (const s of schedules) {
      const paidIds: string[] = (() => {
        if (!s.notes) return [];
        try { const p = JSON.parse(s.notes); if (Array.isArray(p.paidMembers)) return p.paidMembers; } catch {}
        return [];
      })();

      if (paidIds.includes(memberId)) continue;

      paidIds.push(memberId);
      const newNotes = (() => {
        if (!s.notes) return JSON.stringify({ paidMembers: paidIds });
        try {
          const p = JSON.parse(s.notes);
          p.paidMembers = paidIds;
          return JSON.stringify(p);
        } catch {
          return JSON.stringify({ text: s.notes, paidMembers: paidIds });
        }
      })();

      await prisma.schedule.update({ where: { id: s.id }, data: { notes: newNotes } });

      const member = await prisma.member.findUnique({ where: { id: memberId } });
      const title = s.sparingOpponent ? `Sparing vs ${s.sparingOpponent}` : s.title;
      await prisma.kasMutasi.create({
        data: {
          pbId,
          type: "masuk",
          description: `Bayar HTM - ${member?.name || "?"} - ${title}`,
          amount: getHtmRate(s, member),
          tanggal: new Date(),
          reference: s.id,
          scheduleId: s.id,
          memberId,
        },
      });

      created.push({ scheduleId: s.id, amount: getHtmRate(s, member) });
    }

    return NextResponse.json({ ok: true, created });
  } catch (error) {
    console.error("POST /api/hutang error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

async function hutangPut(request: Request, { params }: P<{ id: string }>) {
  const { id } = await params;
  const body = await request.json();
  const pbId = request.headers.get("x-pb-id");
  if (!pbId) return NextResponse.json({ error: "x-pb-id required" }, { status: 400 });

  if (body.saldoAwalHutang !== undefined) {
    const member = await prisma.member.findFirst({ where: { id, pbId } });
    if (!member) return NextResponse.json({ error: "Member not found" }, { status: 404 });

    const updated = await prisma.member.update({
      where: { id },
      data: { saldoAwalHutang: parseInt(body.saldoAwalHutang) || 0 },
    });
    return NextResponse.json(updated);
  }

  return NextResponse.json({ error: "No valid field to update" }, { status: 400 });
}

/* ============================================================ */
/* config / app-config / control-data / custom-frames / misc     */
/* ============================================================ */
async function configGet(request: Request) {
  const { searchParams } = new URL(request.url);
  const key = searchParams.get("key");
  if (!key) return NextResponse.json({ error: "key is required" }, { status: 400 });
  const config = await prisma.siteConfig.findUnique({ where: { key } });
  return NextResponse.json({ key, value: config?.value || null }, {
    headers: { "Cache-Control": "public, max-age=86400, s-maxage=604800, stale-while-revalidate=604800" },
  });
}

async function configPost(request: Request) {
  try {
    const { key, value } = await request.json();
    if (!key) return NextResponse.json({ error: "key is required" }, { status: 400 });
    const config = await prisma.siteConfig.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    });
    return NextResponse.json(config);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

async function appConfigGet() {
  const config = await prisma.appConfig.findUnique({ where: { id: "default" } });
  return NextResponse.json(config || { id: "default", favicon: null });
}

async function appConfigPut(request: Request) {
  try {
    const body = await request.json();
    const config = await prisma.appConfig.upsert({
      where: { id: "default" },
      create: { id: "default", favicon: body.favicon || null },
      update: { favicon: body.favicon || null },
    });
    return NextResponse.json(config);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

async function controlDataGet(request: Request) {
  const url = new URL(request.url);
  const queryPbId = url.searchParams.get("pbId");
  const pbId = queryPbId || request.headers.get("x-pb-id");
  const where = pbId ? { pbId } : {};
  try {
    const schedules = await prisma.schedule.findMany({ where, orderBy: { date: "desc" } });
    const members = await prisma.member.findMany({ where, orderBy: { name: "asc" } });
    const matches = await prisma.match.findMany({ where, orderBy: { createdAt: "desc" } });
    const tournaments = await prisma.tournament.findMany({ where, orderBy: { createdAt: "desc" }, include: { teams: { include: { players: true } }, _count: { select: { schedules: true } } } });
    const teams = await prisma.team.findMany({ where: { tournament: { ...(pbId ? { pbId } : {}) } }, include: { players: true }, orderBy: { name: "asc" } });
    const safeMembers = members.map(({ photo, ...m }) => m);
    return NextResponse.json({ schedules, members: safeMembers, matches, tournaments, teams });
  } catch (error) {
    console.error("GET /api/control-data error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

const MAX_FRAME_SLOTS = 4;

function frameGetPbId(request: Request): string {
  const url = new URL(request.url);
  return url.searchParams.get("pbId") || request.headers.get("x-pb-id") || "default";
}

async function customFramesGet(request: Request) {
  try {
    const pbId = frameGetPbId(request);
    const rows = await prisma.customFrame.findMany({
      where: { pbId },
      orderBy: { slot: "asc" },
      select: { id: true, slot: true, image: true, updatedAt: true },
    });
    return NextResponse.json(
      rows.map((r) => ({ id: r.id, slot: r.slot, hasImage: !!r.image, image: r.image, updatedAt: r.updatedAt }))
    );
  } catch (error) {
    console.error("GET /api/custom-frames error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

async function customFramesPost(request: Request) {
  try {
    const body = await request.json();
    const slot = Number(body.slot);
    const image = body.image as string | undefined;
    if (!Number.isInteger(slot) || slot < 1 || slot > MAX_FRAME_SLOTS) {
      return NextResponse.json({ error: "slot harus 1-4" }, { status: 400 });
    }
    if (image && !/^data:image\/png;base64,/i.test(image)) {
      return NextResponse.json({ error: "Gambar harus PNG (transparan)" }, { status: 400 });
    }
    const pbId = frameGetPbId(request);
    const existing = await prisma.customFrame.findUnique({ where: { pbId_slot: { pbId, slot } } });
    const row = existing
      ? await prisma.customFrame.update({ where: { id: existing.id }, data: { image: image ?? null } })
      : await prisma.customFrame.create({ data: { pbId, slot, image: image ?? null } });
    return NextResponse.json({ id: row.id, pbId: row.pbId, slot: row.slot, hasImage: !!row.image });
  } catch (error) {
    console.error("POST /api/custom-frames error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

async function networkInfoGet() {
  const ifaces = networkInterfaces();
  let lanIp = "";
  for (const name of Object.keys(ifaces)) {
    for (const net of ifaces[name] || []) {
      if (net.family === "IPv4" && !net.internal) {
        lanIp = net.address;
        break;
      }
    }
    if (lanIp) break;
  }
  return NextResponse.json({ lanIp });
}

async function setupGet() {
  try {
    const existing = await prisma.user.findFirst();
    if (existing) {
      return NextResponse.json({ message: "Sudah ada user. Setup tidak perlu diulang." });
    }

    const pb = await prisma.pb.create({
      data: { id: "default", name: "PB Badminton Saya", slug: "pb-default" },
    });

    const hashed = await bcrypt.hash("admin123", 10);

    await prisma.user.create({
      data: {
        email: "admin@badminton.com",
        fullName: "Super Admin",
        password: hashed,
        role: "superadmin",
        pbId: pb.id,
      },
    });

    return NextResponse.json({
      message: "Setup berhasil!",
      login: { email: "admin@badminton.com", password: "admin123", role: "superadmin" },
    });
  } catch (error) {
    console.error("Setup error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

async function dashboardGet(request: Request) {
  try {
    const pbId = request.headers.get("x-pb-id");
    const where = pbId ? { pbId } : {};
    const members = await prisma.member.findMany({ where });
    const schedules = await prisma.schedule.findMany({ where });
    const matches = await prisma.match.findMany({ where });
    const attendances = await prisma.attendance.findMany();
    const mutasis = await prisma.kasMutasi.findMany({
      where: { ...where, type: "masuk", void: 0 },
      orderBy: { createdAt: "desc" },
      take: 5,
    });
    const allMutasis = await prisma.kasMutasi.findMany({ where: { ...where, void: 0 } });

    const today = todayDateOnly();
    const monthStart = new Date();
    monthStart.setDate(1);
    const monthStartStr = toDateOnly(monthStart);

    const memberMap = new Map(members.map((m) => [m.id, m]));

    const recentPayments = mutasis.map((m) => ({
      id: m.id,
      memberId: m.memberId,
      memberName: m.memberId ? memberMap.get(m.memberId)?.name || "?" : "?",
      description: m.description,
      amount: m.amount,
      tanggal: m.tanggal,
    }));

    const kasMasuk = allMutasis.filter((m) => m.type === "masuk").reduce((sum, m) => sum + m.amount, 0);
    const kasKeluar = allMutasis.filter((m) => m.type === "keluar").reduce((sum, m) => sum + m.amount, 0);
    const kasSaldo = kasMasuk - kasKeluar;

    return NextResponse.json({
      totalMembers: members.length,
      activeMembers: members.filter((m) => m.isActive).length,
      thisMonthSchedules: schedules.filter(
        (s) => toDateOnly(s.date) >= monthStartStr && s.status !== "cancelled"
      ).length,
      completedMatches: matches.filter((m) => m.status === "completed").length,
      upcomingSchedules: schedules
        .filter((s) => toDateOnly(s.date) >= today && s.status === "planned")
        .sort((a, b) => a.date.getTime() - b.date.getTime())
        .slice(0, 5)
        .map((s) => ({ id: s.id, title: s.title, date: s.date, startTime: s.startTime })),
      topPlayers: [] as { id: string; name: string; count: number }[],
      recentPayments,
      kasSaldo,
    });
  } catch (error) {
    console.error("GET /api/dashboard error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

/* ============================================================ */
/* photobox                                                      */
/* ============================================================ */
const PHOTOBOX_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

async function runPhotoBoxCleanup() {
  const cutoff = new Date(Date.now() - PHOTOBOX_RETENTION_MS);
  const expired = await prisma.photoBox.findMany({
    where: { updatedAt: { lt: cutoff } },
    select: { id: true },
  });
  if (expired.length === 0) return 0;
  const ids = expired.map((p) => p.id);
  const deleted = await prisma.photoBox.deleteMany({ where: { id: { in: ids } } });
  if (deleted.count > 0) console.log(`[photobox] cleanup: deleted ${deleted.count} expired boxes`);
  return deleted.count;
}

async function photoboxCleanupGet() {
  try {
    const count = await runPhotoBoxCleanup();
    return NextResponse.json({ ok: true, deleted: count });
  } catch (error) {
    console.error("GET /api/photobox/cleanup error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

const ALLOWED_PHOTO_FRAMES = ["maya", "zasar", "plaid", "sticker", "custom1", "custom2", "custom3", "custom4"];

function photoGetPbId(request: Request): string {
  const url = new URL(request.url);
  return url.searchParams.get("pbId") || request.headers.get("x-pb-id") || "default";
}

async function getOrCreateBox(scheduleId: string, pbId: string) {
  const existing = await prisma.photoBox.findUnique({ where: { scheduleId } });
  if (existing) return existing;
  return prisma.photoBox.create({ data: { scheduleId, pbId } });
}

async function photoBoxGet(request: Request, { params }: P<{ scheduleId: string }>) {
  try {
    await runPhotoBoxCleanup();
    const { scheduleId } = await params;
    const pbId = photoGetPbId(request);
    const box = await prisma.photoBox.findUnique({
      where: { scheduleId },
      include: { items: { orderBy: { createdAt: "asc" } } },
    });
    if (!box) return NextResponse.json([]);
    const rows = box.items.map((it) => ({
      id: it.id,
      frameId: it.frameId,
      hasPhoto: !!it.photo,
      createdAt: it.createdAt,
      url: `/api/photobox/${scheduleId}/${it.id}/photo`,
    }));
    return NextResponse.json({ pbId, boxId: box.id, items: rows });
  } catch (error) {
    console.error("GET /api/photobox/[scheduleId] error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

async function photoBoxPost(request: Request, { params }: P<{ scheduleId: string }>) {
  try {
    const { scheduleId } = await params;
    const body = await request.json();
    const frameId = body.frameId as string;
    const photo = body.photo as string | undefined;
    if (!ALLOWED_PHOTO_FRAMES.includes(frameId)) {
      return NextResponse.json({ error: "frameId tidak valid" }, { status: 400 });
    }
    const pbId = photoGetPbId(request);
    const box = await getOrCreateBox(scheduleId, pbId);
    const existing = await prisma.photoBoxItem.findFirst({
      where: { photoBoxId: box.id, frameId },
    });
    const item = existing
      ? await prisma.photoBoxItem.update({ where: { id: existing.id }, data: { photo: photo ?? null } })
      : await prisma.photoBoxItem.create({ data: { photoBoxId: box.id, frameId, photo: photo ?? null } });
    return NextResponse.json({
      id: item.id,
      frameId: item.frameId,
      hasPhoto: !!item.photo,
      url: `/api/photobox/${scheduleId}/${item.id}/photo`,
    }, { status: 201 });
  } catch (error) {
    console.error("POST /api/photobox/[scheduleId] error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

async function photoBoxItemDelete(_request: Request, { params }: P<{ scheduleId: string; itemId: string }>) {
  try {
    const { scheduleId, itemId } = await params;
    const item = await prisma.photoBoxItem.findFirst({
      where: { id: itemId, photoBox: { scheduleId } },
    });
    if (!item) return new NextResponse("Not Found", { status: 404 });
    await prisma.photoBoxItem.delete({ where: { id: itemId } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/photobox item error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

async function photoBoxItemPhotoGet(_request: Request, { params }: P<{ scheduleId: string; itemId: string }>) {
  try {
    const { scheduleId, itemId } = await params;
    const item = await prisma.photoBoxItem.findFirst({
      where: { id: itemId, photoBox: { scheduleId } },
    });
    if (!item?.photo) return new NextResponse("Not Found", { status: 404 });
    const m = item.photo.match(/^data:(image\/[a-z+]+);base64,([\s\S]+)$/);
    const buf = Buffer.from(m ? m[2] : item.photo, "base64");
    const type = m ? m[1] : "image/png";
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": type,
        "Cache-Control": "public, max-age=86400",
        "Content-Disposition": `inline; filename="photobox-${item.id.slice(0, 8)}.png"`,
      },
    });
  } catch (error) {
    console.error("GET /api/photobox photo error:", error);
    return new NextResponse("Server Error", { status: 500 });
  }
}

/* ============================================================ */
/* whatsapp                                                      */
/* ============================================================ */
async function waRequireBot(request: Request): Promise<boolean> {
  const config = await waGetConfig();
  const auth = request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "") || request.headers.get("x-bot-token");
  return !!config.botToken && auth === config.botToken;
}

async function waBotGet() {
  const state = await getBotState();
  return NextResponse.json(state);
}

async function waBotPost(request: Request) {
  if (!(await waRequireBot(request))) {
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

async function waBotPut(request: Request) {
  const body = await request.json();
  if (body?.cmd !== "logout" && body?.cmd !== "refresh") {
    return NextResponse.json({ error: "invalid cmd" }, { status: 400 });
  }
  await setBotCmd(body.cmd);
  return NextResponse.json({ ok: true });
}

async function waBotCmdGet(request: Request) {
  const config = await waGetConfig();
  const auth = request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "") || request.headers.get("x-bot-token");
  if (!config.botToken || auth !== config.botToken) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const cmd = await consumeBotCmd();
  return NextResponse.json({ cmd });
}

async function waConfigGet() {
  const parsed = await waGetConfig();
  const token = parsed.token || "";
  const masked = token ? (token.length > 8 ? token.slice(0, 4) + "••••••••" + token.slice(-4) : "••••••••") : "";
  const botToken = parsed.botToken || "";
  const botMasked = botToken ? (botToken.length > 8 ? botToken.slice(0, 4) + "••••••••" + botToken.slice(-4) : "••••••••") : "";
  return NextResponse.json({ ...parsed, token: masked, hasToken: !!token, botToken: botMasked, hasBotToken: !!botToken });
}

async function waConfigPut(request: Request) {
  try {
    const body = await request.json();
    let parsed: WhatsAppConfig = await waGetConfig();

    if (typeof body.token === "string") parsed.token = body.token.trim();
    if (typeof body.phoneNumberId === "string") parsed.phoneNumberId = body.phoneNumberId.trim();
    if (typeof body.mode === "string") parsed.mode = body.mode === "meta" ? "meta" : "self";
    if (typeof body.botToken === "string") parsed.botToken = body.botToken.trim();
    if (body.templates && typeof body.templates === "object") {
      for (const key of ["jadwal", "reminder", "bayar"] as const) {
        const t = body.templates[key];
        if (t && typeof t === "object") {
          parsed.templates[key] = {
            name: typeof t.name === "string" ? t.name.trim() : parsed.templates[key].name,
            text: typeof t.text === "string" ? t.text : parsed.templates[key].text,
            variables: Array.isArray(t.variables) ? t.variables.filter((v: unknown) => typeof v === "string") : parsed.templates[key].variables,
          };
        }
      }
    }

    await saveConfig(parsed);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("PUT /api/whatsapp/config error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

async function waConfigDelete() {
  await saveConfig(defaultWhatsAppConfig());
  return NextResponse.json({ ok: true });
}

async function waQueueGet(request: Request) {
  try {
    const auth = request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "") || request.headers.get("x-bot-token");
    const config = await waGetConfig();
    if (!config.botToken || auth !== config.botToken) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    const job = await claimPendingJob();
    return NextResponse.json({ job });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

async function waQueuePost(request: Request) {
  try {
    const auth = request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "") || request.headers.get("x-bot-token");
    const config = await waGetConfig();
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

function waGetPaidMembers(s: { notes: string | null }): string[] {
  if (!s.notes) return [];
  try {
    const p = JSON.parse(s.notes);
    if (Array.isArray(p.paidMembers)) return p.paidMembers;
  } catch {}
  return [];
}

function waIsInsidentil(member: { memberType?: string } | null | undefined): boolean {
  return member?.memberType === "insidentil";
}

interface WaTarget {
  member: { id: string; name: string; phone: string | null; class: string; memberType: string };
  htmRate: number;
}

async function waSendPost(request: Request) {
  try {
    const body = await request.json();
    const pbId = request.headers.get("x-pb-id") || body.pbId;
    const type = body.type as WABroadcastType;
    if (!["jadwal", "reminder", "bayar", "test"].includes(type)) {
      return NextResponse.json({ error: "type must be jadwal|reminder|bayar|test" }, { status: 400 });
    }

    const config: WhatsAppConfig = await waGetConfig();
    if (config.mode === "meta" && (!config.token || !config.phoneNumberId)) {
      return NextResponse.json({ error: "WhatsApp belum dikonfigurasi di Pengaturan" }, { status: 400 });
    }
    if (config.mode === "self" && !config.botToken) {
      return NextResponse.json({ error: "Buat dulu Token Bot di Pengaturan → WhatsApp, lalu scan QR di HP bot" }, { status: 400 });
    }

    const schedule = body.scheduleId
      ? await prisma.schedule.findUnique({ where: { id: body.scheduleId } })
      : null;
    if (body.scheduleId && !schedule) {
      return NextResponse.json({ error: "Jadwal tidak ditemukan" }, { status: 404 });
    }

    const pb = await prisma.pb.findFirst({ where: { id: pbId || schedule?.pbId } });
    const effectivePbId = pbId || schedule?.pbId || "";
    const where = effectivePbId ? { pbId: effectivePbId } : {};

    const inPb = (m: { pbId?: string | null }): boolean => !effectivePbId || m.pbId === effectivePbId;

    let targets: WaTarget[] = [];

    if (type === "test") {
      const fallbackMember = await prisma.member.findFirst({ where: { ...where, phone: { not: null }, isActive: true } as any });
      const testMember = {
        id: "test",
        name: "Pesan Uji",
        phone: pb?.phone || fallbackMember?.phone || null,
        class: "",
        memberType: "member",
      };
      targets = [{ member: testMember, htmRate: 0 }];
    } else if (type === "jadwal") {
      const members = await prisma.member.findMany({ where: { ...where, isActive: true } as any });
      targets = members.map((m) => ({ member: m, htmRate: 0 }));
    } else {
      if (!schedule) return NextResponse.json({ error: "scheduleId wajib untuk tipe ini" }, { status: 400 });

      const attendances = await prisma.attendance.findMany({
        where: { scheduleId: schedule.id, status: { in: ["hadir", "undangan"] } },
        include: { member: true },
      });

      if (type === "reminder") {
        targets = attendances
          .filter((a) => inPb(a.member))
          .map((a) => ({
            member: a.member,
            htmRate: waIsInsidentil(a.member) ? (schedule.htmInsidentil ?? schedule.htm ?? 0) : (schedule.htm ?? 0),
          }));
      } else {
        const paidIds = waGetPaidMembers(schedule);
        targets = attendances
          .filter((a) => inPb(a.member))
          .filter((a) => !paidIds.includes(a.memberId))
          .map((a) => ({
            member: a.member,
            htmRate: waIsInsidentil(a.member) ? (schedule.htmInsidentil ?? schedule.htm ?? 0) : (schedule.htm ?? 0),
          }));
      }
    }

    const template = config.templates[type === "test" ? "jadwal" : type];
    const ctx = {
      pb: pb ? { name: pb.name } : undefined,
      schedule: schedule
        ? {
            title: schedule.title,
            sparingOpponent: schedule.sparingOpponent,
            date: schedule.date,
            startTime: schedule.startTime,
            location: schedule.location,
            htm: schedule.htm,
            htmInsidentil: schedule.htmInsidentil,
          }
        : type === "test"
          ? {
              title: "Main Bareng Mingguan",
              date: new Date(Date.now() + 86400000),
              startTime: "19:00",
              location: "GOR Badminton",
              htm: 25000,
              htmInsidentil: 30000,
            }
          : undefined,
    };

    const noPhone: string[] = [];
    const items: WaJobItem[] = [];
    for (const t of targets) {
      const phone = formatPhoneNumber(t.member.phone);
      if (!phone) {
        noPhone.push(t.member.name);
        continue;
      }
      const text = fillVariables(template.text, {
        member: { name: t.member.name, class: t.member.class },
        pb: ctx.pb,
        schedule: ctx.schedule,
      });
      items.push({
        memberId: t.member.id,
        memberName: t.member.name,
        phone,
        text,
      });
    }

    if (config.mode === "meta") {
      const maxConcurrent = 5;
      const results: { memberName: string; phone: string; ok: boolean; reason?: string }[] = [];
      for (let i = 0; i < items.length; i += maxConcurrent) {
        const chunk = items.slice(i, i + maxConcurrent);
        const chunkResults = await Promise.all(
          chunk.map((it) =>
            sendWhatsAppTo({
              to: it.phone,
              mode: "text",
              text: it.text,
              ctx,
              token: config.token,
              phoneNumberId: config.phoneNumberId,
            }).then((r) => ({ memberName: it.memberName, ...r }))
          )
        );
        results.push(...chunkResults);
      }
      await appendLog({
        type: type === "test" ? "jadwal" : type,
        scheduleId: schedule?.id || null,
        title: schedule ? (schedule.sparingOpponent ? `Sparing vs ${schedule.sparingOpponent}` : schedule.title) : "Semua anggota",
        at: new Date().toISOString(),
        mode: "meta",
        total: targets.length,
        noPhone: noPhone.length,
        ok: results.filter((r) => r.ok).length,
        failed: results.filter((r) => !r.ok).length,
      });
      return NextResponse.json({
        ok: true,
        mode: "meta",
        total: targets.length,
        sent: results.filter((r) => r.ok).length,
        noPhone: noPhone.length,
        failed: results.filter((r) => !r.ok).length,
        failedDetails: results.filter((r) => !r.ok).slice(0, 20).map((f) => ({ name: f.memberName, reason: f.reason })),
      });
    }

    const id = "job_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const job = {
      id,
      type: type === "test" ? "jadwal" : type,
      scheduleId: schedule?.id || null,
      title: schedule ? (schedule.sparingOpponent ? `Sparing vs ${schedule.sparingOpponent}` : schedule.title) : "Semua anggota",
      status: "pending" as const,
      at: new Date().toISOString(),
      totals: { total: targets.length, sent: 0, failed: 0, noPhone: noPhone.length },
      items,
    };

    await pushJob(job);

    return NextResponse.json({
      ok: true,
      mode: "self",
      queued: true,
      jobId: id,
      total: targets.length,
      noPhone: noPhone.length,
      phoneTargets: items.length,
    });
  } catch (error) {
    console.error("POST /api/whatsapp/send error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

async function waStatusGet(request: Request) {
  try {
    const auth = request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "") || request.headers.get("x-bot-token");
    const config = await waGetConfig();
    if (!config.botToken || auth !== config.botToken) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    const summary = await getQueueSummary();
    return NextResponse.json(summary);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

/* ============================================================ */
/* dispatcher                                                    */
/* ============================================================ */
async function dispatch(request: Request, path: string[], method: string): Promise<Response> {
  const p = path.map((s) => decodeURIComponent(s));
  const a = p[0];
  const b = p[1];
  const c = p[2];
  const d = p[3];

  if (a === "members") {
    if (!b) {
      if (method === "GET") return membersGet(request);
      if (method === "POST") return membersPost(request);
    } else if (b === "import") {
      if (method === "POST") return membersImport(request);
    } else if (!c) {
      if (method === "PUT") return memberPut(request, { params: Promise.resolve({ id: b }) });
      if (method === "DELETE") return memberDelete(request, { params: Promise.resolve({ id: b }) });
    } else if (c === "photo") {
      if (method === "GET") return memberPhoto(request, { params: Promise.resolve({ id: b }) });
    }
  } else if (a === "users") {
    if (!b) {
      if (method === "GET") return usersGet(request);
      if (method === "POST") return usersPost(request);
    } else if (!c) {
      if (method === "PUT") return userPut(request, { params: Promise.resolve({ id: b }) });
      if (method === "DELETE") return userDelete(request, { params: Promise.resolve({ id: b }) });
    }
  } else if (a === "user-levels") {
    if (!b) {
      if (method === "GET") return userLevelsGet();
      if (method === "POST") return userLevelsPost(request);
    } else if (!c) {
      if (method === "PUT") return userLevelPut(request, { params: Promise.resolve({ id: b }) });
      if (method === "DELETE") return userLevelDelete(request, { params: Promise.resolve({ id: b }) });
    }
  } else if (a === "auth") {
    if (b === "login") {
      if (method === "POST") return authLoginPost(request);
    } else if (b === "promote") {
      if (method === "POST") return authPromotePost();
    }
  } else if (a === "pbs") {
    if (!b) {
      if (method === "GET") return pbsGet();
      if (method === "POST") return pbsPost(request);
    } else if (!c) {
      if (method === "GET") return pbGet(request, { params: Promise.resolve({ id: b }) });
      if (method === "PUT") return pbPut(request, { params: Promise.resolve({ id: b }) });
      if (method === "DELETE") return pbDelete(request, { params: Promise.resolve({ id: b }) });
    }
  } else if (a === "teams") {
    if (!b) {
      if (method === "GET") return teamsGet(request);
      if (method === "POST") return teamsPost(request);
    } else if (!c) {
      if (method === "PUT") return teamPut(request, { params: Promise.resolve({ id: b }) });
      if (method === "DELETE") return teamDelete(request, { params: Promise.resolve({ id: b }) });
    }
  } else if (a === "schedules") {
    if (!b) {
      if (method === "GET") return schedulesGet(request);
      if (method === "POST") return schedulesPost(request);
    } else if (!c) {
      if (method === "PUT") return schedulePut(request, { params: Promise.resolve({ id: b }) });
      if (method === "DELETE") return scheduleDelete(request, { params: Promise.resolve({ id: b }) });
    }
  } else if (a === "tournaments") {
    if (!b) {
      if (method === "GET") return tournamentsGet(request);
      if (method === "POST") return tournamentsPost(request);
    } else if (c === "generate") {
      if (method === "POST") return tournamentGeneratePost(request, { params: Promise.resolve({ id: b }) });
    } else if (c === "match") {
      if (method === "POST") return tournamentMatchPost(request, { params: Promise.resolve({ id: b }) });
    } else if (!c) {
      if (method === "GET") return tournamentGet(request, { params: Promise.resolve({ id: b }) });
      if (method === "PUT") return tournamentPut(request, { params: Promise.resolve({ id: b }) });
      if (method === "DELETE") return tournamentDelete(request, { params: Promise.resolve({ id: b }) });
    }
  } else if (a === "matches") {
    if (!b) {
      if (method === "GET") return matchesGet(request);
      if (method === "POST") return matchesPost(request);
    } else if (b === "batch") {
      if (method === "POST") return matchesBatchPost(request);
    } else if (b === "stream") {
      if (method === "GET") return matchesStreamGet();
    } else if (!c) {
      if (method === "PUT") return matchPut(request, { params: Promise.resolve({ id: b }) });
      if (method === "DELETE") return matchDelete(request, { params: Promise.resolve({ id: b }) });
    }
  } else if (a === "attendances") {
    if (!b) {
      if (method === "GET") return attendancesGet(request);
      if (method === "POST") return attendancesPost(request);
    } else if (b === "batch") {
      if (method === "POST") return attendancesBatchPost(request);
    } else if (!c) {
      if (method === "PUT") return attendancePut(request, { params: Promise.resolve({ id: b }) });
      if (method === "DELETE") return attendanceDelete(request, { params: Promise.resolve({ id: b }) });
    }
  } else if (a === "match-cards") {
    if (!b) {
      if (method === "GET") return matchCardsGet(request);
      if (method === "POST") return matchCardsPost(request);
    } else if (b === "cleanup") {
      if (method === "GET") return matchCardsCleanupGet();
    } else if (!c) {
      if (method === "GET") return matchCardGet(request, { params: Promise.resolve({ matchId: b }) });
      if (method === "DELETE") return matchCardDelete(request, { params: Promise.resolve({ matchId: b }) });
    } else if (c === "photo") {
      if (method === "GET") return matchCardPhoto(request, { params: Promise.resolve({ matchId: b }) });
    }
  } else if (a === "match-history") {
    if (!b) {
      if (method === "GET") return matchHistoryGet(request);
      if (method === "POST") return matchHistoryPost(request);
    }
  } else if (a === "kas-mutasi") {
    if (!b) {
      if (method === "GET") return kasMutasiGet(request);
      if (method === "POST") return kasMutasiPost(request);
    } else if (!c) {
      if (method === "PUT") return kasMutasiPut(request, { params: Promise.resolve({ id: b }) });
      if (method === "DELETE") return kasMutasiDelete(request, { params: Promise.resolve({ id: b }) });
    }
  } else if (a === "kas-biaya") {
    if (!b) {
      if (method === "GET") return kasBiayaGet(request);
      if (method === "POST") return kasBiayaPost(request);
    } else if (!c) {
      if (method === "PUT") return kasBiayaPut(request, { params: Promise.resolve({ id: b }) });
      if (method === "DELETE") return kasBiayaDelete(request, { params: Promise.resolve({ id: b }) });
    }
  } else if (a === "laba-rugi") {
    if (!b) {
      if (method === "GET") return labaRugiGet(request);
      if (method === "POST") return labaRugiPost(request);
    } else if (!c) {
      if (method === "PUT") return labaRugiPut(request, { params: Promise.resolve({ id: b }) });
    }
  } else if (a === "hutang") {
    if (!b) {
      if (method === "GET") return hutangGet(request);
      if (method === "POST") return hutangPost(request);
    } else if (!c) {
      if (method === "PUT") return hutangPut(request, { params: Promise.resolve({ id: b }) });
    }
  } else if (a === "config") {
    if (method === "GET") return configGet(request);
    if (method === "POST") return configPost(request);
  } else if (a === "app-config") {
    if (method === "GET") return appConfigGet();
    if (method === "PUT") return appConfigPut(request);
  } else if (a === "control-data") {
    if (method === "GET") return controlDataGet(request);
  } else if (a === "custom-frames") {
    if (method === "GET") return customFramesGet(request);
    if (method === "POST") return customFramesPost(request);
  } else if (a === "network-info") {
    if (method === "GET") return networkInfoGet();
  } else if (a === "setup") {
    if (method === "GET") return setupGet();
  } else if (a === "dashboard") {
    if (method === "GET") return dashboardGet(request);
  } else if (a === "photobox") {
    if (b === "cleanup") {
      if (method === "GET") return photoboxCleanupGet();
    } else if (b) {
      if (!c) {
        if (method === "GET") return photoBoxGet(request, { params: Promise.resolve({ scheduleId: b }) });
        if (method === "POST") return photoBoxPost(request, { params: Promise.resolve({ scheduleId: b }) });
      } else if (!d) {
        if (method === "DELETE") return photoBoxItemDelete(request, { params: Promise.resolve({ scheduleId: b, itemId: c }) });
      } else if (d === "photo") {
        if (method === "GET") return photoBoxItemPhotoGet(request, { params: Promise.resolve({ scheduleId: b, itemId: c }) });
      }
    }
  } else if (a === "whatsapp") {
    if (b === "bot") {
      if (!c) {
        if (method === "GET") return waBotGet();
        if (method === "POST") return waBotPost(request);
        if (method === "PUT") return waBotPut(request);
      } else if (c === "cmd") {
        if (method === "GET") return waBotCmdGet(request);
      }
    } else if (b === "config") {
      if (method === "GET") return waConfigGet();
      if (method === "PUT") return waConfigPut(request);
      if (method === "DELETE") return waConfigDelete();
    } else if (b === "queue") {
      if (method === "GET") return waQueueGet(request);
      if (method === "POST") return waQueuePost(request);
    } else if (b === "send") {
      if (method === "POST") return waSendPost(request);
    } else if (b === "status") {
      if (method === "GET") return waStatusGet(request);
    }
  }

  return NextResponse.json({ error: "Not found" }, { status: 404 });
}

type RouteCtx = { path?: string[] };

export async function GET(request: Request, { params }: { params: Promise<RouteCtx> }) {
  const { path = [] } = await params;
  return dispatch(request, path, "GET");
}

export async function POST(request: Request, { params }: { params: Promise<RouteCtx> }) {
  const { path = [] } = await params;
  return dispatch(request, path, "POST");
}

export async function PUT(request: Request, { params }: { params: Promise<RouteCtx> }) {
  const { path = [] } = await params;
  return dispatch(request, path, "PUT");
}

export async function DELETE(request: Request, { params }: { params: Promise<RouteCtx> }) {
  const { path = [] } = await params;
  return dispatch(request, path, "DELETE");
}