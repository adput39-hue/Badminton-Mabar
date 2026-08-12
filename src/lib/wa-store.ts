import "server-only";
import path from "path";
import { existsSync, readFileSync } from "fs";
import { initializeApp, cert, getApps, getApp, type ServiceAccount } from "firebase-admin/app";
import {
  getFirestore,
  type Firestore,
  type Transaction,
  type DocumentReference,
} from "firebase-admin/firestore";
import { defaultWhatsAppConfig, type WhatsAppConfig, type WaJob } from "@/lib/whatsapp";

export interface BotState {
  state: "offline" | "qr" | "connected";
  qr?: string;
  at?: string;
}

let db: Firestore | null = null;

function loadServiceAccount(): ServiceAccount | null {
  const envRaw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (envRaw) {
    try {
      const parsed = JSON.parse(envRaw);
      return { projectId: parsed.project_id, clientEmail: parsed.client_email, privateKey: parsed.private_key };
    } catch {
      console.error("[WA-STORE] FIREBASE_SERVICE_ACCOUNT bukan JSON valid.");
      return null;
    }
  }
  const envFile = process.env.FIREBASE_SERVICE_ACCOUNT_FILE;
  const candidate = envFile || path.join(process.cwd(), "firebase-service-account.json");
  if (existsSync(candidate)) {
    try {
      const parsed = JSON.parse(readFileSync(candidate, "utf8"));
      return { projectId: parsed.project_id, clientEmail: parsed.client_email, privateKey: parsed.private_key };
    } catch {
      console.error("[WA-STORE] Gagal membaca firebase-service-account.json");
      return null;
    }
  }
  return null;
}

function getDb(): Firestore | null {
  if (db) return db;
  const sa = loadServiceAccount();
  if (!sa?.projectId) return null;
  try {
    const app = getApps().length ? getApp() : initializeApp({ credential: cert(sa), projectId: sa.projectId });
    db = getFirestore(app);
    return db;
  } catch (e) {
    console.error("[WA-STORE] Init Firestore error:", e instanceof Error ? e.message : e);
    return null;
  }
}

export function isFirebaseReady(): boolean {
  return !!getDb();
}

const ref = (f: Firestore, id: string): DocumentReference => f.collection("wa").doc(id);

const W_CONFIG = "config";
const W_STATE = "state";
const W_CMD = "cmd";
const W_QUEUE = "queue";
const W_LOGS = "logs";

async function getJson(f: Firestore, id: string): Promise<any | null> {
  const snap = await ref(f, id).get();
  return snap.exists ? snap.data() : null;
}

async function setJson(f: Firestore, id: string, data: Record<string, unknown>) {
  await ref(f, id).set({ ...data, updatedAt: new Date().toISOString() });
}

async function getJsonTx(t: Transaction, f: Firestore, id: string): Promise<any | null> {
  const snap = await t.get(ref(f, id));
  return snap.exists ? snap.data() : null;
}

// ---------- Config ----------
const W_CONFIG_KEY = "whatsapp_config";

async function migrateFromLegacy(): Promise<WhatsAppConfig | null> {
  try {
    const { prisma } = await import("@/lib/prisma");
    const row = await prisma.siteConfig.findUnique({ where: { key: W_CONFIG_KEY } });
    if (!row?.value) return null;
    const parsed = { ...defaultWhatsAppConfig(), ...JSON.parse(row.value) } as WhatsAppConfig;
    await saveConfig(parsed);
    console.log("[WA-STORE] Config lama berhasil dimigrasikan dari Supabase ke Firestore.");
    return parsed;
  } catch (e) {
    console.error("[WA-STORE] Migrasi config lama gagal:", e instanceof Error ? e.message : e);
    return null;
  }
}

export async function getConfig(): Promise<WhatsAppConfig> {
  const f = getDb();
  let config = defaultWhatsAppConfig();
  if (!f) return config;
  try {
    const data = await getJson(f, W_CONFIG);
    if (typeof data?.raw === "string" && data.raw) {
      try { config = { ...defaultWhatsAppConfig(), ...JSON.parse(data.raw) }; } catch {}
    } else {
      const migrated = await migrateFromLegacy();
      if (migrated) config = migrated;
    }
  } catch (e) {
    console.error("[WA-STORE] getConfig error:", e instanceof Error ? e.message : e);
  }
  return config;
}

export async function saveConfig(config: WhatsAppConfig): Promise<void> {
  const f = getDb();
  if (!f) return;
  try {
    await setJson(f, W_CONFIG, { raw: JSON.stringify(config) });
  } catch (e) {
    console.error("[WA-STORE] saveConfig error:", e instanceof Error ? e.message : e);
  }
}

export async function hasConfig(): Promise<boolean> {
  const f = getDb();
  if (!f) return false;
  const data = await getJson(f, W_CONFIG);
  return typeof data?.raw === "string";
}

// ---------- Bot state ----------
export async function getBotState(): Promise<BotState> {
  const f = getDb();
  if (!f) return { state: "offline" };
  try {
    const data = await getJson(f, W_STATE);
    if (typeof data?.raw === "string") {
      const parsed = JSON.parse(data.raw);
      if (parsed && typeof parsed.state === "string") return parsed as BotState;
    }
  } catch {}
  return { state: "offline" };
}

export async function saveBotState(state: BotState): Promise<void> {
  const f = getDb();
  if (!f) return;
  try {
    await setJson(f, W_STATE, { raw: JSON.stringify(state) });
  } catch (e) {
    console.error("[WA-STORE] saveBotState error:", e instanceof Error ? e.message : e);
  }
}

export async function setBotCmd(cmd: string): Promise<void> {
  const f = getDb();
  if (!f) return;
  try {
    await setJson(f, W_CMD, { raw: JSON.stringify({ cmd, at: new Date().toISOString() }) });
  } catch (e) {
    console.error("[WA-STORE] setBotCmd error:", e instanceof Error ? e.message : e);
  }
}

export async function consumeBotCmd(): Promise<string | null> {
  const f = getDb();
  if (!f) return null;
  try {
    const data = await getJson(f, W_CMD);
    let cmd: string | null = null;
    if (typeof data?.raw === "string") {
      try {
        const parsed = JSON.parse(data.raw);
        cmd = parsed.cmd || null;
      } catch {}
    }
    await ref(f, W_CMD).set({ raw: "" });
    return cmd;
  } catch {
    return null;
  }
}

// ---------- Queue ----------
async function getQueueArray(f: Firestore, t?: Transaction): Promise<WaJob[]> {
  const data = t ? await getJsonTx(t, f, W_QUEUE) : await getJson(f, W_QUEUE);
  let q: unknown = data?.raw;
  if (typeof q === "string") {
    try { q = JSON.parse(q); } catch { q = []; }
  }
  return Array.isArray(q) ? (q as WaJob[]) : [];
}

async function putQueueArray(f: Firestore, jobs: WaJob[], t?: Transaction) {
  const doc = ref(f, W_QUEUE);
  const payload = { raw: jobs.length ? JSON.stringify(jobs) : "", updatedAt: new Date().toISOString() };
  if (t) t.set(doc, payload);
  else await doc.set(payload);
}

export async function pushJob(job: WaJob): Promise<void> {
  const f = getDb();
  if (!f) return;
  await f.runTransaction(async (t) => {
    const jobs = await getQueueArray(f, t);
    jobs.push(job);
    putQueueArray(f, jobs.slice(-100), t);
  });
}

export async function claimPendingJob(): Promise<WaJob | null> {
  const f = getDb();
  if (!f) return null;
  let claimed: WaJob | null = null;
  await f.runTransaction(async (t) => {
    const jobs = await getQueueArray(f, t);
    const idx = jobs.findIndex((j) => j.status === "pending");
    if (idx === -1) return;
    jobs[idx] = { ...jobs[idx], status: "sending" };
    claimed = jobs[idx];
    putQueueArray(f, jobs, t);
  });
  return claimed;
}

export async function completeJob(jobId: string, results: { phone?: string; ok?: boolean }[]): Promise<void> {
  const f = getDb();
  if (!f) return;
  await f.runTransaction(async (t) => {
    const jobs = await getQueueArray(f, t);
    const idx = jobs.findIndex((j) => j.id === jobId);
    if (idx === -1) return;
    const okPhone = new Map(results.filter((r) => r?.ok).map((r) => [String(r.phone), true]));
    let sent = 0;
    let failed = 0;
    const items = (jobs[idx].items || []).map((it) => {
      const ok = okPhone.has(String(it.phone));
      if (ok) sent++;
      else failed++;
      return { ...it, ok, reason: ok ? undefined : "tidak dikirim bot" };
    });
    jobs[idx] = {
      ...jobs[idx],
      items,
      status: "done",
      finishedAt: new Date().toISOString(),
      totals: { ...(jobs[idx].totals || {}), sent, failed },
    };
    putQueueArray(f, jobs, t);
  });
}

export async function getQueueSummary(): Promise<{ pending: number; sending: number; done: number; recent: WaJob[] }> {
  const f = getDb();
  if (!f) return { pending: 0, sending: 0, done: 0, recent: [] };
  try {
    const jobs = await getQueueArray(f);
    return {
      pending: jobs.filter((j) => j.status === "pending").length,
      sending: jobs.filter((j) => j.status === "sending").length,
      done: jobs.filter((j) => j.status === "done").length,
      recent: jobs.filter((j) => j.status === "done").slice(-5),
    };
  } catch {
    return { pending: 0, sending: 0, done: 0, recent: [] };
  }
}

// ---------- Logs ----------
export async function appendLog(entry: Record<string, unknown>): Promise<void> {
  const f = getDb();
  if (!f) return;
  try {
    await f.runTransaction(async (t) => {
      const data = await getJsonTx(t, f, W_LOGS);
      let logs: Record<string, unknown>[] = [];
      if (typeof data?.raw === "string") {
        try {
          const parsed = JSON.parse(data.raw);
          if (Array.isArray(parsed)) logs = parsed as Record<string, unknown>[];
        } catch {}
      }
      logs = logs.slice(-99);
      logs.push(entry);
      t.set(ref(f, W_LOGS), { raw: JSON.stringify(logs), updatedAt: new Date().toISOString() });
    });
  } catch (e) {
    console.error("[WA-STORE] appendLog error:", e instanceof Error ? e.message : e);
  }
}