PANDUAN MEMASANG BOT WA DI LAPTOP KEDUA (WINDOWS)
=================================================

File yang disalin dari folder wa-bot (zip ini sudah lengkap, tanpa node_modules):
  1. wa-bot.js
  2. package.json
  3. package-lock.json
  4. .env
  5. start-bot.bat
  6. firebase-service-account.json   <- PENTING: kunci koneksi ke Firestore, jangan dibagikan ke orang lain

APA YANG BERUBAH (versi Firestore):
  - Bot TIDAK lagi polling server Vercel tiap 5-10 detik.
  - Bot terhubung langsung ke Firebase (Firestore) pakai kunci service account.
  - Dashboard baca status bot + QR secara realtime dari Firestore.
  - Bisa dipakai dari laptop mana pun (tidak tergantung IP) dan tidak
    membebani kuota Vercel/Supabase.

LANGKAH:
  1. Install Node.js di laptop tujuan (wajib, sekali saja):
     - Buka https://nodejs.org -> klik LTS -> install (next-next-finish).
     - Setelah selesai, buka Command Prompt / PowerShell:
         node -v
       Harus muncul angka versi (mis. v22.x). Kalau muncul "not recognized",
       tutup-buka lagi Command Prompt, atau restart laptop.

  2. Letakkan folder wa-bot (dari zip) di mana saja (mis. C:\wa-bot atau Documents).

  3. Buka Command Prompt di folder wa-bot:
        cd C:\wa-bot
        npm install
     Tunggu sampai muncul "found 0 vulnerabilities" (sekitar 2-4 menit,
     karena kini ikut mengunduh firebase-admin).

  4. Setelah install selesai, jalankan ulang file start-bot.bat SEKALI SEBELUM
     dipakai untuk memastikan daftar perintah sudah yang baru. Lalu tutup lagi.

  5. Jalankan bot dengan double-click start-bot.bat (atau dari cmd: node wa-bot.js).
     Muncul teks: "[WA-BOT] QR baru tersedia -> buka dashboard ... untuk scan."

  6. Buka https://badminton-mabar.vercel.app di browser LAPTOP itu
     (atau HP) -> login -> Pengaturan -> WhatsApp -> bagian "Status Bot WhatsApp"
     -> QR tampil otomatis -> scan pakai WhatsApp nomor khusus:
        WhatsApp > Setelan > Perangkat tertaut > Tautkan perangkat
     Setelah terhubung, dashboard berubah hijau "Bot terhubung".

  7. Selesai. Bot jalan terus di background selama laptop nyala.
     Jangan tutup jendela start-bot.bat. Saat laptop restart, jalankan lagi.
     (Opsional: bisa dibuat auto-start via Task Scheduler - tanya pengembang.)

CATATAN PENTING:
  - firebase-service-account.json ADALAH KUNCI AKUN. Jangan pernah menyebar
    atau mengunggahnya ke tempat publik. Kalau terlanjur bocor, buat kunci baru
    di console dan ganti di kedua laptop.
  - Folder "session" akan dibuat otomatis setelah scan QR pertama kali.
  - Kalau mau pindah laptop, salin juga folder session/ (berisi kredensial WA
    nomor bot) maka tidak perlu scan ulang.
  - JANGAN copy node_modules dari zip - cukup npm install seperti langkah 3.