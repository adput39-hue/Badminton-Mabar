// WhatsApp bot sender (self-hosted, Baileys) untuk aplikasi Mabar PB.
// Menjalankan: node wa-bot.js
// Dependensi: pkg install nodejs-lts  (di PC cukup download Node.js)
// npm i baileys qrcode-terminal qrcode dotenv

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

try {
  require("dotenv").config();
} catch {}

const API_URL = process.env.API_URL || "https://badminton-mabar.vercel.app";
const BOT_TOKEN = process.env.WA_BOT_TOKEN || "";
const POLL_MS = Number(process.env.POLL_MS || 5000);

if (!BOT_TOKEN) {
  console.error("[WA-BOT] WA_BOT_TOKEN belum diisi. Edit file wa-bot/.env (atau export).");
  process.exit(1);
}

const SESSION_DIR = path.join(__dirname, "session");

let sock = null;
let connected = false;

async function postBot(payload) {
  try {
    const res = await fetch(API_URL + "/api/whatsapp/bot", {
      method: "POST",
      headers: { Authorization: "Bearer " + BOT_TOKEN, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok && res.status !== 401) {
      console.error("[WA-BOT] Gagal kirim state bot, status:", res.status);
    }
  } catch (e) {
    console.error("[WA-BOT] Kirim state bot error:", e?.message || e);
  }
}

async function getCmd() {
  try {
    const res = await fetch(API_URL + "/api/whatsapp/bot/cmd", {
      headers: { Authorization: "Bearer " + BOT_TOKEN },
    });
    if (!res.ok) {
      if (res.status === 401) console.error("[WA-BOT] Token bot ditolak server!");
      return null;
    }
    const data = await res.json();
    return data?.cmd || null;
  } catch (e) {
    console.error("[WA-BOT] Ambil perintah error:", e?.message || e);
    return null;
  }
}

async function handleLogout() {
  console.log("[WA-BOT] Perintah logout diterima. Memutus perangkat WA...");
  try { await postBot({ state: "offline" }); } catch {}
  try { if (sock) sock.end(); } catch {}
  await new Promise((r) => setTimeout(r, 1500));
  try { fs.rmSync(SESSION_DIR, { recursive: true, force: true }); } catch {}
  console.log("[WA-BOT] Sesi lama dihapus. Memuat ulang untuk QR baru.");
  connected = false;
  sock = null;
  setTimeout(startBot, 1500);
}

async function startBot() {
  let state;
  try {
    const st = await useMultiFileAuthState(SESSION_DIR);
    state = st.state;
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
  });

  sock.ev.on("creds.update", async (update) => {
    try { await state.saveCreds(); } catch {}
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
        await postBot({ state: "qr", qr: dataUrl });
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
      try { await postBot({ state: "connected" }); } catch {}
    } else if (connection === "close") {
      connected = false;
      const reason = lastDisconnect?.error?.output?.statusCode;
      console.log("[WA-BOT] Koneksi tertutup status:", reason, "- mencoba ulang dalam 5s...");
      try { await postBot({ state: "offline" }); } catch {}
      if (reason === DisconnectReason.loggedOut) {
        console.log("[WA-BOT] Logged out — menghapus sesi dan menampilkan QR baru.");
        try { fs.rmSync(SESSION_DIR, { recursive: true, force: true }); } catch {}
      }
      setTimeout(startBot, 5000);
    }
  });

  setInterval(pollQueue, POLL_MS);
  setInterval(pollCmd, POLL_MS * 2);
  pollQueue();
  pollCmd();
}

async function pollQueue() {
  if (!connected || !sock || typeof sock.sendMessage !== "function") return;
  try {
    const res = await fetch(API_URL + "/api/whatsapp/queue", {
      headers: { Authorization: "Bearer " + BOT_TOKEN },
    });
    if (!res.ok) {
      if (res.status === 401) console.error("[WA-BOT] Token bot ditolak server!");
      return;
    }
    const data = await res.json();
    const job = data.job;
    if (!job) return;

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

    await fetch(API_URL + "/api/whatsapp/queue", {
      method: "POST",
      headers: { Authorization: "Bearer " + BOT_TOKEN, "Content-Type": "application/json" },
      body: JSON.stringify({ jobId: job.id, results }),
    });
    console.log(`[WA-BOT] Job ${job.id} selesai: ${results.filter((r) => r.ok).length}/${results.length}`);
  } catch (e) {
    console.error("[WA-BOT] Poll error:", e?.message || e);
  }
}

async function pollCmd() {
  try {
    const cmd = await getCmd();
    if (cmd === "logout") {
      await handleLogout();
    }
  } catch {}
}

startBot();