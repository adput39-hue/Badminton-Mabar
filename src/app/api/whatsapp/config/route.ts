import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { defaultWhatsAppConfig, type WhatsAppConfig, WHATSAPP_CONFIG_KEY } from "@/lib/whatsapp";

export const dynamic = "force-dynamic";

export async function GET() {
  const config = await prisma.siteConfig.findUnique({ where: { key: WHATSAPP_CONFIG_KEY } });
  let parsed: WhatsAppConfig = defaultWhatsAppConfig();
  if (config?.value) {
    try {
      parsed = { ...defaultWhatsAppConfig(), ...JSON.parse(config.value) };
    } catch {}
  }
  const token = parsed.token || "";
  const masked = token ? (token.length > 8 ? token.slice(0, 4) + "••••••••" + token.slice(-4) : "••••••••") : "";
  return NextResponse.json({ ...parsed, token: masked, hasToken: !!token });
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const existing = await prisma.siteConfig.findUnique({ where: { key: WHATSAPP_CONFIG_KEY } });
    let parsed: WhatsAppConfig = defaultWhatsAppConfig();
    if (existing?.value) {
      try { parsed = { ...defaultWhatsAppConfig(), ...JSON.parse(existing.value) }; } catch {}
    }

    if (typeof body.token === "string") parsed.token = body.token.trim();
    if (typeof body.phoneNumberId === "string") parsed.phoneNumberId = body.phoneNumberId.trim();
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

    await prisma.siteConfig.upsert({
      where: { key: WHATSAPP_CONFIG_KEY },
      update: { value: JSON.stringify(parsed) },
      create: { key: WHATSAPP_CONFIG_KEY, value: JSON.stringify(parsed) },
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("PUT /api/whatsapp/config error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}