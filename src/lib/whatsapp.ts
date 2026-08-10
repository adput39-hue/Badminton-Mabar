export interface WhatsAppTemplate {
  name: string;
  text: string;
  variables: string[];
}

export interface WhatsAppConfig {
  mode: "self" | "meta";
  botToken: string;
  token: string;
  phoneNumberId: string;
  templates: {
    jadwal: WhatsAppTemplate;
    reminder: WhatsAppTemplate;
    bayar: WhatsAppTemplate;
  };
}

export type WABroadcastType = "jadwal" | "reminder" | "bayar" | "test";

export interface WaJobItem {
  memberId: string;
  memberName: string;
  phone: string;
  text: string;
  ok?: boolean;
  reason?: string;
}

export interface WaJob {
  id: string;
  type: WABroadcastType;
  scheduleId: string | null;
  title: string;
  status: "pending" | "sending" | "done";
  at: string;
  totals: { total: number; sent: number; failed: number; noPhone: number };
  items: WaJobItem[];
}

export const WHATSAPP_CONFIG_KEY = "whatsapp_config";
export const WHATSAPP_LOG_KEY = "whatsapp_logs";
export const WHATSAPP_QUEUE_KEY = "whatsapp_queue";

export const WA_VARIABLES = [
  { key: "{nama}", desc: "Nama anggota" },
  { key: "{kelas}", desc: "Kelas anggota" },
  { key: "{namaPB}", desc: "Nama PB" },
  { key: "{judul}", desc: "Judul jadwal / Sparing vs ..." },
  { key: "{tanggal}", desc: "Tanggal acara" },
  { key: "{jam}", desc: "Jam mulai" },
  { key: "{lokasi}", desc: "Lokasi" },
  { key: "{htm}", desc: "HTM (member)" },
  { key: "{htmInsidentil}", desc: "HTM insidentil" },
];

export function defaultWhatsAppConfig(): WhatsAppConfig {
  return {
    mode: "self",
    botToken: "",
    token: "",
    phoneNumberId: "",
    templates: {
      jadwal: {
        name: "",
        text: "Halo {nama}, jadwal main kita:\n\n{judul}\n{tanggal} • {jam} WIB\nLokasi: {lokasi}\n\nKlik link bawah untuk konfirmasi hadir ya!\nJangan lupa bayar HTM Rp{htm}.",
        variables: ["nama", "judul", "tanggal"],
      },
      reminder: {
        name: "",
        text: "Halo {nama}, jangan lupa yaa kita main {tanggal} jam {jam} di {lokasi}. Sampai ketemu 👋",
        variables: ["nama", "tanggal"],
      },
      bayar: {
        name: "",
        text: "Halo {nama}, untuk acara {judul} tanggal {tanggal}, HTM Rp{htm} belum terbayar. Mohon konfirmasi pembayaran ya. Terima kasih 🙏",
        variables: ["nama", "judul", "tanggal"],
      },
    },
  };
}

export function formatPhoneNumber(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let digits = raw.replace(/[^\d]/g, "");
  if (!digits) return null;
  if (digits.startsWith("0")) digits = "62" + digits.slice(1);
  else if (digits.startsWith("8")) digits = "62" + digits;
  else if (digits.startsWith("62")) digits = digits;
  return digits;
}

export interface WaContext {
  member?: { name: string; class: string };
  pb?: { name: string };
  schedule?: {
    title: string;
    sparingOpponent?: string | null;
    date?: Date | string;
    startTime?: string | null;
    location?: string | null;
    htm?: number | null;
    htmInsidentil?: number | null;
  };
}

export function fillVariables(raw: string, ctx: WaContext): string {
  const memberName = ctx.member?.name || "";
  const memberClass = ctx.member?.class || "";
  const pbName = ctx.pb?.name || "";
  const judul = ctx.schedule?.sparingOpponent ? `Sparing vs ${ctx.schedule.sparingOpponent}` : (ctx.schedule?.title || "");
  const tgl = ctx.schedule?.date
    ? new Date(ctx.schedule.date).toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
    : "";
  const jam = (ctx.schedule?.startTime || "").slice(0, 5);
  const lokasi = ctx.schedule?.location || "";
  const htm = ctx.schedule?.htm != null ? String(ctx.schedule.htm) : "";
  const htmIns = ctx.schedule?.htmInsidentil != null ? String(ctx.schedule.htmInsidentil) : "";

  return raw
    .replace(/\{nama\}/g, memberName)
    .replace(/\{kelas\}/g, memberClass)
    .replace(/\{namaPB\}/g, pbName)
    .replace(/\{judul\}/g, judul)
    .replace(/\{tanggal\}/g, tgl)
    .replace(/\{jam\}/g, jam)
    .replace(/\{lokasi\}/g, lokasi)
    .replace(/\{htm\}/g, htm)
    .replace(/\{htmInsidentil\}/g, htmIns);
}

export interface WaSendResult {
  phone: string;
  ok: boolean;
  reason?: string;
}

export interface WaSendOptions {
  to: string;
  mode: "template" | "text";
  template?: WhatsAppTemplate;
  text?: string;
  ctx: WaContext;
  token: string;
  phoneNumberId: string;
}

export async function sendWhatsAppTo(options: WaSendOptions): Promise<WaSendResult> {
  const phone = formatPhoneNumber(options.to);
  if (!phone) return { phone: options.to || "", ok: false, reason: "no_phone" };

  const template = options.mode === "template" ? options.template : undefined;
  const text = options.mode === "text" ? options.text : undefined;

  const body: Record<string, unknown> = {
    messaging_product: "whatsapp",
    to: phone,
    type: template ? "template" : "text",
  };

  if (template) {
    const parameters = template.variables.map((v) => {
      const ctxValue: string = fillVariables(`{${v}}`, options.ctx);
      return { type: "text", text: ctxValue };
    });
    body.template = {
      name: template.name,
      language: { code: "id" },
      components: parameters.length > 0 ? [{ type: "body", parameters }] : [],
    };
  } else {
    body.text = { body: text || "" };
  }

  try {
    const res = await fetch(`https://graph.facebook.com/v22.0/${options.phoneNumberId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${options.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    if (res.ok && json?.messages?.[0]?.id) return { phone, ok: true };
    const err = json?.error?.message || `http_${res.status}`;
    return { phone, ok: false, reason: err };
  } catch (e) {
    return { phone, ok: false, reason: e instanceof Error ? e.message : String(e) };
  }
}