export default function SettingsPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold">Pengaturan</h1>
      <p className="mt-1 text-sm text-gray-600">
        Kelola pengaturan PB Anda
      </p>

      <div className="mt-8 space-y-6">
        <div className="rounded-xl border p-5">
          <h2 className="font-semibold">Profil PB</h2>
          <p className="mt-4 text-sm text-gray-500">
            Nama, alamat, dan kontak PB akan diatur di sini.
          </p>
        </div>

        <div className="rounded-xl border p-5">
          <h2 className="font-semibold">Manajemen Admin</h2>
          <p className="mt-4 text-sm text-gray-500">
            Tambah atau hapus admin PB di sini.
          </p>
        </div>
      </div>
    </div>
  );
}
