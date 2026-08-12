// WhatsApp bot sender (self-hosted, Baileys) untuk aplikasi Mabar PB.
// Menjalankan: node wa-bot.js
// Dependensi: nodejs, npm i baileys qrcode dotenv firebase-admin
// Sinkronisasi via Firebase Realtime (Firestore) - tanpa polling ke server.

const makeWASocket = require("baileys").default;
const {
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  DisconnectReason,
} = require("baileys");
const pino = require("pino");
const QRCode = require("qrcode");
const fs = require("fs");
const path = require("path");

const admin = require("firebase-admin");

try {
  require("dotenv").config();
} catch {}

let db = null;
try {
  const saEnv = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (saEnv) {
    admin.initializeApp({
      credential: admin.credential.cert(JSON.parse(saEnv)),
    });
  } else {
    const saFile = process.env.FIREBASE_SERVICE_ACCOUNT_FILE || path.join(__dirname, "firebase-service-account.json");
    if (fs.existsSync(saFile)) {
      admin.initializeApp({
        credential: admin.credential.cert(JSON.parse(fs.readFileSync(saFile, "utf8"))),
      });
    }
  }
  if (admin.apps.length) db = admin.firestore();
} catch (e) {
  console.error("[WA-BOT] Gagal init Firebase:", e?.message || e);
}

if (!db) {
  console.error("[WA-BOT] Firebase belum dikonfigurasi. Letakkan firebase-service-account.json di folder ini (atau export FIREBASE_SERVICE_ACCOUNT).");
  process.exit(1);
}

const SESSION_DIR = path.join(__dirname, "session");

const stateDoc = () => db.collection("wa").doc("state");
const queueDoc = () => db.collection("wa").doc("queue");
const cmdDoc = () => db.collection("wa").doc("cmd");

let sock = null;
let connected = false;

async function setState(state, extra = {}) {
  try {
    await stateDoc().set({ raw: JSON.stringify({ state, at: new Date().toISOString(), ...extra }) });
  } catch (e) {
    console.error("[WA-BOT] Gagal set state:", e?.message || e);
  }
}

let cmdUnwatch = null;
let queueUnwatch = null;

function watchComm() {
  if (cmdUnwatch) cmdUnwatch();
  if (queueUnwatch) queueUnwatch();

  cmdUnwatch = cmdDoc().onSnapshot(async (snap) => {
    const data = snap.exists ? snap.data() : null;
    let cmd = null;
    if (typeof data?.raw === "string") {
      try { cmd = JSON.parse(data.raw).cmd || null; } catch {}
    } else if (data?.cmd?.cmd) {
      cmd = data.cmd.cmd;
    }
    if (cmd === "logout") {
      await cmdDoc().set({ raw: "" });
      await handleLogout();
    } else if (cmd === "refresh") {
      await cmdDoc().set({ raw: "" });
      console.log("[WA-BOT] Perintah refresh diterima. Membuat QR baru...");
      try { await setState("offline"); } catch {}
      try { if (sock) sock.end(); } catch {}
      connected = false;
      sock = null;
      setTimeout(startBot, 1500);
    }
  });

  queueUnwatch = queueDoc().onSnapshot(() => {
    processQueue();
  });
}

async function handleLogout() {
  console.log("[WA-BOT] Perintah ganti nomor diterima. Memutus perangkat WA...");
  try { await setState("offline"); } catch {}
  try { if (sock) sock.end(); } catch {}
  await new Promise((r) => setTimeout(r, 1500));
  try { fs.rmSync(SESSION_DIR, { recursive: true, force: true }); } catch {}
  console.log("[WA-BOT] Sesi lama dihapus. Memuat ulang untuk QR baru.");
  connected = false;
  sock = null;
  setTimeout(startBot, 1500);
}

let queuing = false;

async function processQueue() {
  if (!connected || !sock || typeof sock.sendMessage !== "function") return;
  if (queuing) return;

  queuing = true;
  try {
    const snap = await queueDoc().get();
    let jobs = [];
    const data = snap.exists ? snap.data() : null;
    if (typeof data?.raw === "string") {
      try { jobs = JSON.parse(data.raw); } catch { jobs = []; }
    } else if (Array.isArray(data?.queue)) {
      jobs = data.queue;
    }
    if (!Array.isArray(jobs)) return;

    const idx = jobs.findIndex((j) => j.status === "pending");
    if (idx === -1) return;

    // claim job atomik
    const claim = await queueDoc().get();
    let all = [];
    const cdata = claim.exists ? claim.data() : null;
    if (typeof cdata?.raw === "string") {
      try { all = JSON.parse(cdata.raw); } catch { all = []; }
    } else if (Array.isArray(cdata?.queue)) {
      all = cdata.queue;
    }
    const ci = all.findIndex((j) => j.status === "pending");
    if (ci === -1) return;
    all[ci] = { ...all[ci], status: "sending" };
    const job = all[ci];
    await queueDoc().set({ raw: JSON.stringify(all) });

    console.log(`[WA-BOT] Ambil job ${job.id} (${job.type}) target ${job.items?.length || 0}`);
    const results = [];
    for (const item of job.items || []) {
      if (!item?.phone || !item?.text) {
        results.push({ phone: item?.phone, ok: false });
        continue;
      }
      try {
        await sock.sendMessage(item.phone.replace(/[^\d]/g, "") + "@s.whatsapp.net", { text: item.text });
        results.push({ phone: item.phone, ok: true });
        console.log(`[WA-BOT] OK -> ${item.memberName} (${item.phone})`);
      } catch (e) {
        results.push({ phone: item.phone, ok: false });
        console.error(`[WA-BOT] GAGAL -> ${item.memberName}: ${e?.message || e}`);
      }
      await new Promise((r) => setTimeout(r, 1200));
    }

    // tulis hasil
    const doneSnap = await queueDoc().get();
    let doneAll = [];
    const ddata = doneSnap.exists ? doneSnap.data() : null;
    if (typeof ddata?.raw === "string") {
      try { doneAll = JSON.parse(ddata.raw); } catch { doneAll = []; }
    } else if (Array.isArray(ddata?.queue)) {
      doneAll = ddata.queue;
    }
    const di = doneAll.findIndex((j) => j.id === job.id);
    if (di !== -1) {
      const okPhone = new Map(results.filter((r) => r.ok).map((r) => [String(r.phone), r.ok]));
      let sent = 0, failed = 0;
      doneAll[di].items = (doneAll[di].items || []).map((it) => {
        const ok = okPhone.has(String(it.phone));
        if (ok) sent++;
        else failed++;
        return { ...it, ok, reason: ok ? undefined : "tidak dikirim bot" };
      });
      doneAll[di].status = "done";
      doneAll[di].finishedAt = new Date().toISOString();
      doneAll[di].totals = { ...(doneAll[di].totals || {}), sent, failed };
      await queueDoc().set({ raw: JSON.stringify(doneAll) });
    }
    console.log(`[WA-BOT] Job ${job.id} selesai: ${results.filter((r) => r.ok).length}/${results.length}`);
  } catch (e) {
    console.error("[WA-BOT] Proses queue error:", e?.message || e);
  } finally {
    queuing = false;
  }
}

async function startBot() {
  let state;
  let saveCreds;
  try {
    const st = await useMultiFileAuthState(SESSION_DIR);
    state = st.state;
    saveCreds = st.saveCreds;
  } catch (e) {
    console.error("[WA-BOT] Gagal muat sesi:", e?.message || e);
    setTimeout(startBot, 5000);
    return;
  }

  const { version } = await fetchLatestBaileysVersion();

  sock = makeWASocket({
    version,
    auth: state,
    logger: pino({ level: process.env.LOG_LEVEL || "silent" }),
    browser: ["mabar-bot", "Chrome", "1.0"],
    printQRInTerminal: false,
    markOnlineOnConnect: false,
    syncFullHistory: false,
    connectTimeoutMs: 120000,
    qrTimeout: 180000,
    maxRetries: 20,
  });

  sock.ev.on("creds.update", async (update) => {
    try {
      await saveCreds();
      console.log("[WA-BOT] creds.update disimpan. keys:", Object.keys(update).join(","), "| me:", update.me?.id || "-");
    } catch (e) {
      console.error("[WA-BOT] Gagal simpan creds:", e?.message || e);
    }
  });

  let qrTick = 0;
  let lastQr = "";

  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect, qr } = update || {};
    if (qr) {
      lastQr = qr;
      qrTick++;
      try {
        const dataUrl = await QRCode.toDataURL(qr, { width: 300, margin: 1 });
        await setState("qr", { qr: dataUrl });
      } catch (e) {
        console.error("[WA-BOT] Gagal proses QR:", e?.message || e);
      }
      if (qrTick <= 2) {
        console.log("[WA-BOT] QR baru tersedia — buka dashboard > Pengaturan > WhatsApp untuk scan.");
      }
      return;
    }
    if (connection === "open") {
      connected = true;
      console.log("[WA-BOT] Terhubung! Menunggu antrean pesan...");
      try { await setState("connected"); } catch {}
    } else if (connection === "close") {
      connected = false;
      const reason = lastDisconnect?.error?.output?.statusCode;
      const detail = lastDisconnect?.error?.message || "";
      console.log("[WA-BOT] Koneksi tertutup status:", reason, "-", detail, "- mencoba ulang dalam 5s...");
      try { await setState("offline"); } catch {}
      if (reason === DisconnectReason.loggedOut) {
        console.log("[WA-BOT] Logged out — menghapus sesi dan menampilkan QR baru.");
        try { fs.rmSync(SESSION_DIR, { recursive: true, force: true }); } catch {}
      }
      setTimeout(startBot, 5000);
    }
  });

  watchComm();
}

startBot();