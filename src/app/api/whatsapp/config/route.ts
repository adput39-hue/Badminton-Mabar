import { NextResponse } from "next/server";
import { defaultWhatsAppConfig, type WhatsAppConfig } from "@/lib/whatsapp";
import { getConfig, saveConfig } from "@/lib/wa-store";

export const dynamic = "force-dynamic";

export async function GET() {
  const parsed = await getConfig();
  const token = parsed.token || "";
  const masked = token ? (token.length > 8 ? token.slice(0, 4) + "••••••••" + token.slice(-4) : "••••••••") : "";
  const botToken = parsed.botToken || "";
  const botMasked = botToken ? (botToken.length > 8 ? botToken.slice(0, 4) + "••••••••" + botToken.slice(-4) : "••••••••") : "";
  return NextResponse.json({ ...parsed, token: masked, hasToken: !!token, botToken: botMasked, hasBotToken: !!botToken });
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    let parsed: WhatsAppConfig = await getConfig();

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

export async function DELETE() {
  // Reset ke default (opsional)
  await saveConfig(defaultWhatsAppConfig());
  return NextResponse.json({ ok: true });
}