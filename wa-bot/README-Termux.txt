PANDUAN SETUP BOT WA DI HP ANDROID (TERMUX)
============================================

Persiapan
---------
1. Siapkan 1 HP Android yang selalu nyala + dipakai khusus bot.
2. Pastikan nomor WhatsApp di HP itu adalah "nomor khusus baru" yang
   memang tidak kamu pakai untuk kegiatan lain.
3. Install dari Play Store: "Termux".

Catatan penting
---------------
- JANGAN matikan HP bot kecuali mau menghentikan sementara.
- Pastikan layar/Termux tetap jalan (jangan di-kill dari task manager).
- Kalau HP direstart, buka Termux dan jalankan lagi `node wa-bot.js`.
- Cara ini pakai koneksi WA tidak resmi. Ada risiko kecil nomor diblokir.
  Gunakan nomor khusus agar tidak mengganggu nomor pribadi.

Langkah 1 - Update & install bahasa
-----------------------------------
Buka Termux, ketik satu-satu:

    yes | pkg update
    yes | pkg upgrade
    yes | pkg install git nodejs-lts nano

Langkah 2 - Salin folder wa-bot dari PC ke HP
---------------------------------------------
Cara paling mudah: kirim folder `wa-bot` (yang ada di project) ke HP,
misal via WA/GDrive, lalu simpan di kartu SD / Download.
Lalu dari Termux pindahkan ke penyimpanan Termux:

    termux-setup-storage
    cd ~
    cp -r /storage/emulated/0/Download/wa-bot ~/wa-bot
    cd ~/wa-bot

Langkah 3 - Install dependensi
------------------------------
    npm install

Langkah 4 - Set Token Bot & server tujuan
------------------------------------------
Buka file .env (sudah ada, atau buat bila belum):

    nano .env

Isi dengan (token = Token Bot yang kamu buat di Pengaturan > WhatsApp):

    WA_BOT_TOKEN=ISI_TOKEN_DISINI
    API_URL=http://IP-PC:3002

PENTING untuk uji lokal (tanpa deploy):
- Server di PC harus jalan: dari folder project jalankan `npm start` (port 3002).
- API_URL = IP komputer di jaringan WiFi yang SAMA dengan HP bot.
  Cek IP PC: buka PowerShell di PC, ketik `ipconfig` lalu cari
  IPv4 di adapter WiFi (contoh: 192.168.18.31).
  Maka isi: API_URL=http://192.168.18.31:3002
- Pastikan port 3002 terbuka di firewall Windows PC (jalankan
  open-firewall-3002.bat sebagai Administrator, atau atur manual).

Kalau nanti sudah deploy ke Vercel, ganti jadi:
    API_URL=https://badminton-mabar.vercel.app

Simpan: tekan Ctrl+X, lalu Y, lalu Enter.

Langkah 5 - Jalankan bot (pertama kali scan QR)
------------------------------------------------
    node wa-bot.js

Termux akan menampilkan QR code. Buka WhatsApp di HP bot:
   WhatsApp > Setelan > Perangkat tertaut > Tautkan perangkat
Lalu scan QR yang tampil di Termux.

Setelah terhubung, muncul: "Terhubung! Menunggu antrean pesan..."
SESI TERSIMPAN - scan QR TIDAK perlu diulang.

Langkah 6 - Jaga bot tetap nyala
--------------------------------
Agar bot tetap jalan meski layar mati, jalankan dengan screen (install dulu):

    yes | pkg install screen
    screen -S bot
    node wa-bot.js

Keluar dari screen tanpa mematikan bot: Ctrl+A lalu D
Kembali ke bot:  screen -r bot

Setelah ini, saat kamu klik "Sebar Jadwal" / "Reminder" / "Kirim WA Belum Bayar"
di dashboard, pesan akan terkirim otomatis oleh HP bot dalam beberapa detik.

Cara tes cepat dari dashboard (moda uji):
   Pengaturan > WhatsApp > "Kirim Uji" -> bot akan kirim pesan contoh
   ke nomor yang tersimpan di No. Telepon PB (atau anggota ber-nomor).
Lalu klik "Cek Antrean" untuk melihat status (menunggu / selesai).