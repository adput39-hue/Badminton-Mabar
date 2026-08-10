// WhatsApp bot sender (self-hosted, Baileys) untuk aplikasi Mabar PB.
// Menjalankan: node wa-bot.js
// Dependensi termux: pkg install nodejs-lts git
// npm i baileys qrcode-terminal

const makeWASocket = require("baileys").default;
const {
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  DisconnectReason,
  makeCacheableSignalKeyStore,
} = require("baileys");
const pino = require("pino");
const qrcode = require("qrcode-terminal");

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

let sock = null;
let connected = false;

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState("./session");
  const { version } = await fetchLatestBaileysVersion();

  sock = makeWASocket({
    version,
    auth: state,
    logger: pino({ level: process.env.LOG_LEVEL || "silent" }),
    browser: ["Termux Bot", "Chrome", "1.0"],
    printQRInTerminal: true,
    markOnlineOnConnect: false,
    syncFullHistory: false,
  });

  if (sock.ev) {
    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", (update) => {
      const { connection, lastDisconnect, qr } = update || {};
      if (qr) {
        console.log("\n[WA-BOT] ===== SCAN QR INI dengan WhatsApp nomor bot =====");
        qrcode.generate(qr, { small: true });
        return;
      }
      if (connection === "open") {
        connected = true;
        console.log("[WA-BOT] Terhubung! Menunggu antrean pesan...");
      } else if (connection === "close") {
        connected = false;
        const reason = lastDisconnect?.error?.output?.statusCode;
        console.log("[WA-BOT] Koneksi tertutup status:", reason, "- mencoba ulang dalam 5s...");
        setTimeout(startBot, 5000);
      }
    });
  }

  setInterval(pollQueue, POLL_MS);
  pollQueue();
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

startBot();