PANDUAN MEMASANG BOT WA DI TERMUX (ANDROID)
===========================================

File yang diperlukan:
  1. wa-bot.js
  2. package.json
  3. package-lock.json
  4. .env
  5. firebase-service-account.json   <- KUNCI akun Firebase, rahasiakan!

APA YANG BERUBAH (versi Firestore):
  - Bot TIDAK polling server Vercel tiap 5-10 detik lagi.
  - Bot terhubung LANGSUNG ke Firebase (Firestore) pakai kunci service account.
  - Dashboard baca status bot + QR realtime dari Firestore.
  - Kuota Vercel/Supabase tidak terbebani polling bot.

CARA INSTALL DI TERMUX (sekali saja):
  1. Update & install nodejs:
       pkg update && pkg upgrade -y
       pkg install nodejs-lts -y
  2. Letakkan isi folder wa-bot di ~/wa-bot (bisa via termux-setup-storage lalu salin).
  3. Install dependensi (lebih lama, kini ada firebase-admin):
       cd ~/wa-bot
       npm install
  4. Jalankan:
       node wa-bot.js

  5. Buka https://badminton-mabar.vercel.app di browser HP -> login ->
     Pengaturan -> WhatsApp -> Status Bot WhatsApp -> scan QR dari WhatsApp
     nomor khusus (Setelan > Perangkat tertaut > Tautkan perangkat).

CATATAN:
  - Biarkan sesi termux tetap terbuka agar bot terus jalan.
  - Untuk auto-start saat HP nyala, gunakan aplikasi Termux:Boot + script .termux/boot.
  - firebase-service-account.json adalah kunci akun - jangan pernah dibagikan.