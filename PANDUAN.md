# Panduan Pemakaian Harian — Surya Baru Service Console

Panduan ini untuk pemakaian sehari-hari di meja kasir/bengkel: dari pelanggan datang sampai
struk tercetak, janji temu, papan bay, kendaraan, dan pengingat servis.

Tidak dibahas di sini (topik untuk pemilik/admin): pengaturan awal toko, **Settings**
(termasuk Teknisi), **Laporan** (termasuk Pengeluaran), tab **Pemasok**, sinkronisasi
multi-perangkat, backup/restore, dan update aplikasi.

Setiap label ditulis persis seperti yang tampil di layar. Pada penyebutan pertama di tiap
bagian, label bahasa Indonesia diikuti label bahasa Inggris dalam kurung — misalnya
**Pesanan Servis** (Service Orders) — supaya panduan ini tetap berguna berapa pun bahasa yang
dipilih di **Settings → Language**.

> ⚠️ = jebakan yang sering bikin bingung. 💡 = jalan pintas.

---

## Daftar isi

1. [Sebelum mulai](#1-sebelum-mulai)
2. [Skenario inti — pelanggan datang sampai struk tercetak](#2-skenario-inti--pelanggan-datang-sampai-struk-tercetak)
3. [Pelanggan atau kendaraan baru di tengah order](#3-pelanggan-atau-kendaraan-baru-di-tengah-order)
4. [Pelanggan perusahaan / armada](#4-pelanggan-perusahaan--armada)
5. [Bayar nanti, lalu ditagih](#5-bayar-nanti-lalu-ditagih)
6. [Barang habis di tengah transaksi](#6-barang-habis-di-tengah-transaksi)
7. [Salah input — batalkan, hapus, batalkan pesanan selesai](#7-salah-input--batalkan-hapus-batalkan-pesanan-selesai)
8. [Janji temu dan antrean walk-in](#8-janji-temu-dan-antrean-walk-in)
9. [Papan Status Bay](#9-papan-status-bay)
10. [Pengingat servis dan menghubungi pelanggan](#10-pengingat-servis-dan-menghubungi-pelanggan)
11. [Riwayat servis dan cetak ulang struk](#11-riwayat-servis-dan-cetak-ulang-struk)
12. [Jadwal servis kendaraan](#12-jadwal-servis-kendaraan)
13. [Melihat stok di mode Worker](#13-melihat-stok-di-mode-worker)
14. [Hal yang sering bikin bingung](#14-hal-yang-sering-bikin-bingung)
15. [Rujukan cepat](#15-rujukan-cepat)

---

## 1. Sebelum mulai

Aplikasi ini berjalan **100% offline** — semua data tersimpan di perangkat ini, tidak ada
koneksi internet yang dibutuhkan untuk kerja sehari-hari.

**Layar login** menawarkan dua jalan:
- **Lanjutkan sebagai pekerja** (Continue as worker) — satu ketuk, tanpa kata sandi. Masuk
  langsung ke mode **Pekerja** (Worker).
- Masuk dengan username + password — masuk ke mode **Pekerja** atau **Admin** tergantung akun
  yang dipakai.

Mode **Pekerja** tidak bisa membuka **Laporan** (Reports, termasuk tab Pengeluaran) atau
**Settings** (termasuk tab Teknisi) — menu itu bahkan tidak muncul di sidebar — dan tidak
melihat tab **Pemasok** (Suppliers) di Inventaris. Pekerja juga tidak melihat harga
modal/keuntungan.
> ⚠️ Harga jual dan total pesanan **tetap terlihat** di mode Pekerja — yang disembunyikan
> hanya harga modal, margin, dan angka pendapatan.

**Bagian layar:** sidebar kiri berisi menu; bagian atas (topbar) menampilkan judul halaman,
kolom pencarian, dan tombol **Pesanan baru** (New order) di kanan atas — tombol ini yang
dipakai untuk membuat pesanan servis baru, bukan tombol di halaman **Pesanan Servis** itu
sendiri (lihat Bagian 2).

**Menu di sidebar** (7 untuk admin, 6 untuk pekerja). Beberapa menu berisi beberapa bagian,
dipilih lewat tombol tab di bagian atas halaman:

| Menu | Isi |
|---|---|
| **Dasbor** (Dashboard) | Hari ini: pendapatan (admin), pesanan terbuka, janji temu hari ini, papan bay, stok menipis, kendaraan yang jatuh tempo servis |
| **Pesanan Servis** (Service orders) | Dibuka di tab **Terbuka** (Open) — mobil yang sedang dikerjakan. Tab lain: **Belum dibayar** (Unpaid), **Selesai**, **Dibatalkan** (Voided, kalau ada), **Semua**. Klik atau ketuk satu kali pada pesanan untuk membukanya |
| **Jadwal** (Schedule) | Tab **Janji Temu** (Appointments) · **Pengingat** (Reminders) |
| **Kendaraan** (Vehicles) | Daftar kendaraan; tombol **Pesanan baru** (New order) di tiap baris, riwayat servis di menu "…" |
| **Pelanggan** (Customers) | Tab **Pelanggan** (Customers) · **Perusahaan** (Companies) |
| **Inventaris** (Inventory) | Tab **Produk** (Products) · **Servis** (Services) · **Pemasok** (Suppliers, khusus admin) |
| **Laporan** (Reports) | Khusus admin — tab **Ringkasan** (Overview), Penjualan, Laba rugi, **Pengeluaran** (Expenses), dll. |

**Teknisi** (Technicians) sekarang ada di **Settings → Teknisi**.

**Pencarian** (`Ctrl+K`, atau kolom cari di topbar): ketik plat, nama, telepon, atau nomor
pesanan. Memilih hasil langsung **membuka** datanya — pesanan terbuka, riwayat kendaraan
tampil, data pelanggan terbuka untuk diubah.

---

## 2. Skenario inti — pelanggan datang sampai struk tercetak

Ini alur yang paling sering dipakai, dari awal sampai akhir.

1. Buka pesanan baru: tekan **Pesanan baru** (New order) di topbar, atau tekan `Ctrl+N`.
   > ⚠️ Tidak ada tombol tambah pesanan di halaman **Pesanan Servis** — lewat topbar,
   > `Ctrl+N`, atau tombol **Pesanan baru** di baris kendaraan (halaman **Kendaraan**), yang
   > langsung mengisi pemilik dan kendaraannya.
2. Dialog **Pesanan Servis Baru** (New Service Order) terbuka. Ketik di **Cari Cepat (plat,
   VIN, atau nama)** (Quick Find) — minimal 2 huruf. Memilih hasil (panah atas/bawah lalu
   Enter, atau klik) langsung mengisi pemilik dan kendaraan sekaligus.
   > 💡 Boleh ketik beberapa kata dengan urutan bebas: nama pemilik + angka plat (`budi 1234`),
   > nama depan + belakang (`santoso budi`), nama + mobil (`sari brio`), atau nomor HP pemilik
   > dengan atau tanpa tanda strip. Nama yang salah ketik sedikit (`santosa`) tetap ketemu,
   > tampil di bawah hasil yang tepat. Pencarian `Ctrl+K` dan halaman Pelanggan/Kendaraan
   > memakai aturan yang sama.
   > 💡 Kalau plat tidak ditemukan, tekan Enter (atau tautan **Pelanggan & kendaraan baru**)
   > untuk langsung mendaftarkan pelanggan dan kendaraan baru dengan plat itu — lihat Bagian 3.
3. Kalau tidak lewat Quick Find: pilih **Tipe Pemilik** (Owner Type) → **Pelanggan
   Perorangan** (Individual Customer) atau **Perusahaan / Armada** (Company / Fleet), lalu
   pilih pemiliknya, lalu pilih **Kendaraan** (Vehicle) — field ini **wajib diisi**.
4. Isi **Odometer Saat Datang (km)** (Odometer at Arrival) — terisi otomatis dari data
   terakhir kendaraan.
   > ⚠️ Angka ini terisi otomatis tiap kali kendaraan diganti — pastikan cocok dengan odometer
   > yang sebenarnya, jangan dibiarkan begitu saja.
5. Pilih **Teknisi yang ditugaskan** (Assigned technician), isi **Keluhan** (Complaint) kalau ada.
6. Tekan **Buat pesanan servis** (Create service order), atau tekan Enter. Kalau kendaraan
   belum dipilih, muncul pesan yang memintanya.
7. Di layar pesanan, pilih bay dari kotak pilihan di bagian atas untuk menandai kendaraan
   masuk bay.
   > ⚠️ Estimasi waktu selalu 60 menit dan tidak bisa diubah dari layar mana pun.
8. Tambahkan item: ketuk kartu servis atau baris produk di panel kiri. Deretan tombol kategori di
   bawah kolom pencarian (Semua · Servis · tiap kategori produk) menyaring daftar dengan satu
   ketuk, dan bisa digeser ke samping. Di tampilan **Semua**, hanya 6 servis pertama yang
   tampil — tekan **Tampilkan semua N servis** untuk melihat sisanya. Produk yang paling sering
   terjual muncul di atas daftar, di bawah judul **Sering terjual**. Mengetik di kolom
   pencarian lalu tekan Enter akan langsung menambahkan item kalau hasil pencarian tinggal
   satu. Mengetuk item yang sama dua kali menambah jumlahnya, bukan membuat baris baru.
   > 💡 Cari barang dengan nama + ukuran/grade, urutan bebas: `castrol 10/40`, `gtx 10w40 1l`,
   > `magnatec 5/30 4 liter`. Grade boleh ditulis 10/40, 10W-40, 10w40 atau 10-40 — semuanya
   > dianggap sama. Merek salah ketik (`kastrol`) tetap muncul, tapi Enter **tidak** menambahkan
   > hasil yang salah ketik — ketuk barisnya sendiri.
   > 💡 Ubah harga atau jumlah: ketuk nama item atau baris `2 × Rp …` di bawahnya, atau ikon
   > pensil — dialog **Ubah item** (Edit line) terbuka. Isi **Harga per unit**; total baris
   > dihitung sendiri (`2 × Rp 110.000 = Rp 220.000`).
   > 💡 Untuk item oli/cairan, centang **Tandai sebagai item servis** di dialog itu: pilih item
   > servis, jumlah liter, **Diganti** atau **Ditambah saja** (hanya Diganti yang mengatur ulang
   > jadwal servis berikutnya), asal oli, dan — hanya kalau pelanggan minta — interval km sendiri.
   > 💡 Salah ketuk? Tekan ikon tempat sampah di baris itu — muncul notifikasi dengan tombol
   > **Urungkan** (Undo) untuk mengembalikannya.
   > 💡 Kalau kendaraan punya beberapa servis yang sudah jatuh tempo, tombol **Tambah semua**
   > (Add all) di samping judul **Perlu sekarang** (Due now) menambahkan semuanya sekaligus.
9. Periksa tiket di panel kanan: **Odometer at Service**, **Diskon (Rp)** (Discount),
   **Pajak %** (Tax %), lalu total di bagian bawah.
   > ⚠️ Kolom **Diskon** terkunci sampai ada minimal satu item di tiket.
10. Tekan **Tagih {jumlah}** (Charge {amount}). Dialog **Konfirmasi pembayaran** (Confirm
    payment) terbuka dengan **Tunai** (Cash) sudah terpilih. Ganti ke QRIS / Card / Check /
    **Belum bayar — tagih nanti** (Unpaid — invoice later) kalau perlu.
11. Untuk Tunai: kalau uangnya pas, **biarkan Jumlah diterima kosong**. Kalau pelanggan
    memberi lebih, isi **Jumlah diterima** (Amount received) — **Kembalian** (Change due)
    tampil otomatis. Kalau jumlahnya kurang, tampil **Kurang** (Short by) dengan selisihnya,
    dan **Konfirmasi** (Confirm) nonaktif.
12. Tekan Enter atau **Konfirmasi** — struk otomatis tercetak dan pesanan selesai.
    > 💡 Pelanggan yang bayar tunai pas: **Tagih** lalu Enter, selesai.
    > ⚠️ Di PC bengkel, menyelesaikan pesanan **selalu** membuka jendela cetak (di tablet
    > tidak — cetak dari PC bengkel). Kalau pop-up diblokir
    > browser/OS, akan muncul notifikasi merah — izinkan pop-up lalu cetak ulang dari menu
    > "…" pesanan tersebut.

### Kalau pelanggan hanya beli barang (tanpa kendaraan)

Untuk pembeli yang hanya mau oli botolan atau filter — tidak ada servis yang dicatat — pilih
**Beli barang saja** (Parts only) di bagian atas dialog **Pesanan baru**, bukan **Servis kendaraan**.

- Tidak perlu kendaraan, kilometer, ataupun sopir. Kolom **Pelanggan (opsional)** boleh dikosongkan:
  pesanan tercatat sebagai **Umum** dan **harus dibayar lunas** saat itu juga.
- Mau dibuatkan invoice (belum bayar)? **Pilih pelanggan atau perusahaannya dulu.** Pilihan
  **Belum bayar — tagih nanti** hanya muncul kalau pesanan punya nama pelanggan — tanpa nama
  tidak ada yang bisa ditagih. Lupa mengisi? Buka **Ubah detail** dan pilih pelanggannya.
- Pesanan ini **tidak menggeser jadwal servis** kendaraan mana pun, walaupun yang dijual oli.
- Struk tidak mencetak plat dan kilometer; nama pelanggan dicetak kalau ada.
- Ternyata ada mobilnya? Di **Ubah detail** tekan **Tambah kendaraan** — pesanan berubah jadi
  pesanan servis biasa.
- Di laporan, omzetnya tetap dihitung. Pembeli **Umum** tidak masuk daftar pelanggan teratas.

---

## 3. Pelanggan atau kendaraan baru di tengah order

**Cara tercepat untuk mobil baru:** ketik platnya di **Cari Cepat**. Kalau tidak ditemukan,
tekan Enter → isi **Nama** pelanggan → Enter → form kendaraan terbuka dengan plat sudah terisi
→ isi **Merek** dan **Model** → Enter → kembali ke pesanan dengan kendaraan terpilih.

Opsi "+ Tambah..." juga ada di dropdown pemilihan yang bersangkutan — selalu baris kedua, tepat
di bawah "Pilih …", jadi tidak perlu menggulir daftar pelanggan sampai bawah. Perilakunya beda:

- **+ Tambah pelanggan baru…** (+ Add new customer…) — dialog kecil di dalam dialog yang sama,
  hanya **Nama** wajib. Setelah disimpan, langsung lompat ke form kendaraan (pelanggan baru
  belum punya kendaraan).
- **+ Tambah kendaraan baru…** (+ Add new vehicle…) — membuka form kendaraan, pemilik sudah
  terisi otomatis (dan tidak ditanyakan lagi).
- **+ Tambah perusahaan baru…** / **+ Tambah sopir baru…** — dua pilihan ini **pindah
  halaman** ke **Pelanggan → Perusahaan** (Customers → Companies), lalu kembali otomatis ke
  pesanan setelah disimpan.

Form kendaraan menampilkan dulu yang dibutuhkan di meja kasir: **Plat nomor**, **Kilometer saat
ini**, **Merek**, **Model**, **Jenis oli yang dibutuhkan**, dan **Kapasitas oli**. Sisanya (tahun, warna, VIN,
jadwal servis, mesin, transmisi, gardan, catatan) ada di bawah **Detail lain** (More details)
— klik untuk membukanya.

**Field kendaraan yang wajib** hanya **Merek \*** (Make) dan **Model \***. Yang lain opsional:
- **Plat nomor** — otomatis huruf besar, maksimal 11 karakter.
- **VIN** — otomatis huruf besar, huruf I/O/Q otomatis dibuang, maksimal 17 karakter. Setelah
  genap 17 karakter, sistem mencoba membaca info kendaraan dan menawarkan tautan **Apply to
  Make/Year** yang hanya mengisi field yang masih kosong.

---

## 4. Pelanggan perusahaan / armada

Pilih **Tipe Pemilik** → **Perusahaan / Armada**, lalu pilih perusahaannya. Kalau ada sopir
yang bawa kendaraan, pilih di **Sopir (Opsional)** (Driver (Optional)) — field ini muncul
hanya untuk pemilik perusahaan.

Sopir dikelola dari **Pelanggan → Perusahaan** (Customers → Companies): buka kartu
perusahaan (klik untuk membuka), lalu tekan **+ Add Driver**.

---

## 5. Bayar nanti, lalu ditagih

Di langkah pembayaran, pilih **Belum bayar — tagih nanti** (Unpaid — invoice later). Isi
**Tanggal jatuh tempo** (Payment due date) — terisi otomatis sesuai jangka waktu default toko.

Struk yang tercetak untuk pesanan ini berjudul **INVOICE**, lengkap dengan jatuh tempo dan dua
kolom tanda tangan di bawah total: **Penerima** (pelanggan — namanya tercetak di bawah garis kalau
sudah terdaftar) dan **Hormat kami** (nama toko). **Minta pelanggan menandatangani kolom Penerima**
sebelum barang dibawa pulang. Struk pesanan yang sudah lunas tidak berubah.

Pesanan ini bisa ditemukan lagi lewat tiga jalan:
- Tab **Belum dibayar** (Unpaid) di halaman **Pesanan Servis**.
- Tombol **Catat pembayaran** (Record payment) di tiket pesanan tersebut.
- Bagian **Tagihan Belum Lunas** (Payments Due) di **Jadwal → Pengingat** (Schedule →
  Reminders).

**Perlu waktu lebih lama?** Hanya **admin** yang bisa memperpanjang jatuh tempo: di
**Pengingat → Tagihan Belum Lunas**, tekan **⋯ → Perpanjang jatuh tempo** (atau tombol
**Perpanjang jatuh tempo** di tiket pesanannya). Pilih **+7 / +14 / +30 hari** — dihitung dari
jatuh tempo sekarang, atau dari hari ini kalau sudah lewat — atau pilih tanggal sendiri. Tanggal
hanya bisa **diundur** (lebih lambat dari jatuh tempo sekarang) dan tidak bisa ke tanggal yang
sudah lewat. Mode Worker tidak melihat tombol ini.

> ⚠️ "Belum dibayar" (Unpaid) **bukan status tersimpan** — artinya pesanan sudah *Selesai* tapi
> *belum dibayar*. Pesanan seperti ini **tidak akan muncul** di tab **Selesai** (Completed).

Status urgensi yang dipakai: **Jatuh Tempo** (Overdue) kalau sudah lewat tanggal, **Akan
Jatuh Tempo** (Due Soon) kalau kurang dari 3 hari lagi.

---

## 6. Barang habis di tengah transaksi

Baris produk yang stoknya habis tetap bisa diketuk:
- Satu ketuk → notifikasi **Stok habis** (Out of stock), item tidak ditambahkan.
- Klik dua kali pada baris (atau tombol kecil di ujung kanannya) → membuka dialog **Receive Stock**
  untuk mencatat kedatangan stok baru, langsung dari layar pesanan tanpa keluar.

> ⚠️ Barang yang baru dicatat **tidak otomatis masuk ke tiket** — setelah stok tercatat, ketuk
> lagi barisnya untuk menambahkannya.

Pekerja (mode Worker) boleh mencatat jumlah kedatangan stok ini, tapi tidak mengisi harga beli
dan tidak membuat catatan pengeluaran — itu tetap tugas admin.

Admin yang mencentang **Catat sebagai pengeluaran** mengisi **Biaya per item (Rp)** — harga
**satu** barang, bukan total. Totalnya dihitung sendiri dan tampil di bawahnya
(`5 × Rp 10.000 = total Rp 50.000`); total itulah yang tercatat sebagai pengeluaran.

---

## 7. Salah input — batalkan, hapus, batalkan pesanan selesai

| Situasi | Yang dilakukan |
|---|---|
| Pesanan masih **Terbuka** (Open), salah dibuat | Buka menu "…" pada baris pesanan → **Hapus pesanan** (Delete) |
| Salah pilih kendaraan, pesanan masih Open | Tautan **Ubah detail** (Edit details) di header pesanan → **Ganti kendaraan** (Change vehicle) → cari plat yang benar. Odometer kedatangan ikut diganti ke data kendaraan baru |
| Pesanan sudah **Selesai** (Completed), perlu dibatalkan | Menu "…" atau tombol di tiket → **Batalkan pesanan** (Void order) — khusus admin, wajib isi **Alasan** (Reason) |
| Detail (teknisi/keluhan/odometer kedatangan) salah, pesanan masih Open | Tautan **Ubah detail** (Edit details) di header pesanan |

Saat **Batalkan pesanan**: stok yang terpakai dikembalikan ke inventaris dan jadwal servis
kendaraan dibatalkan mundur.
> ⚠️ Odometer yang tercatat saat servis **tidak pernah dikembalikan otomatis** oleh
> pembatalan atau penghapusan — kalau perlu diperbaiki, ubah langsung di data kendaraan.

---

## 8. Janji temu dan antrean walk-in

Di **Jadwal → Janji Temu** (Schedule → Appointments), dua cara membuat entri:
- **Janji Temu Baru** (New Appointment) — isi tanggal dan waktu (default jam 09:00, durasi
  30 menit).
- **+ Tambah Walk-in** (+ Add Walk-in) — tanpa tanggal/waktu, langsung masuk **Antrean
  Walk-in** (Walk-in Queue).

Field wajib pada keduanya hanya **Kendaraan** (Vehicle).

> ⚠️ Janji temu **hanya bisa dibuat** — tidak ada tombol untuk mengubah, membatalkan, atau
> mengubahnya jadi pesanan servis. Saat pelanggan datang, buat pesanan servis baru seperti
> biasa lewat Bagian 2, terpisah dari janji temunya.
> ⚠️ **Antrean Walk-in** selalu menampilkan siapa yang sedang menunggu — tidak berubah
> walau tanggal di kalender diganti.

---

## 9. Papan Status Bay

Papan **Status bay** (Bay status) ada di **Dasbor**: satu kartu per bay, berisi kendaraan dan
teknisinya, dengan warna status: **Tersedia** (Available, hijau), **Sedang Dikerjakan** (In
service, kuning/amber), **Inspeksi** (Inspection, biru), **Menunggu Suku Cadang** (Awaiting
parts, merah). Klik kartu bay yang terisi untuk membuka pesanan di bay itu.

> ⚠️ Hanya **Tersedia** dan **Sedang Dikerjakan** yang benar-benar dipakai sistem. Bay tidak
> bisa ditambah atau diganti nama — jumlah dan namanya tetap.

Bay hanya terisi/kosong secara otomatis lewat kotak pilihan bay di layar pesanan servis
(Bagian 2), atau otomatis kosong lagi saat pesanan selesai, dibatalkan, atau dihapus.

---

## 10. Pengingat servis dan menghubungi pelanggan

**Jadwal → Pengingat** (Schedule → Reminders) mengelompokkan kendaraan yang perlu dihubungi:
- **Tagihan Belum Lunas** (Payments Due) — lihat Bagian 5.
- **Jatuh Tempo** (Overdue) dan **Akan Jatuh Tempo** (Due Soon) — dihitung dari jarak km
  sejak servis terakhir, atau jangka waktu bulan, mana yang lebih dulu tercapai.
- **Ditunda** (Snoozed) — kendaraan yang sengaja disembunyikan sementara.

Tombol per baris:
- **Salin pesan** (Copy message) — menyalin draf pesan siap kirim.
- **Telepon** (Call) / **WhatsApp** — nonaktif kalau nomor telepon kosong.
- **Buat Order Servis** (Start Work Order) — langsung membuka pesanan baru untuk kendaraan itu.
  > 💡 Dari bagian **Jatuh Tempo**, tombol ini otomatis mengisi tiket dengan semua servis
  > yang sudah telat.
- Menu "…": **Tandai sudah dihubungi** (Mark contacted) hanya mencatat tanggal, barisnya
  **tetap tampil**. **Tunda 1 minggu / 2 minggu / 1 bulan** (Snooze) menyembunyikan baris ke
  bagian **Ditunda**, dengan tombol **Batalkan penundaan** (Remove snooze) untuk membatalkan.

Halaman **Pesan** (Messages) masih "Coming Soon" — kontak pelanggan yang sebenarnya jalan
lewat tombol-tombol di Pengingat ini.

---

## 11. Riwayat servis dan cetak ulang struk

Riwayat servis satu kendaraan bisa dibuka dari:
- Menu "…" pada baris kendaraan di halaman **Kendaraan** (Vehicles) → **Service History**.
  Cari kendaraannya dulu lewat kolom pencarian di halaman itu (plat atau VIN).
- Klik dua kali pada baris di **Jadwal → Pengingat**, atau klik kendaraan di kartu pengingat
  servis di **Dasbor**.

Isinya: jumlah kunjungan, kapan tiap jenis servis terakhir dikerjakan (oli mesin, filter, dll.)
beserta odometernya, dan daftar kunjungan. Admin juga melihat total belanja dan grafiknya.

Cetak ulang struk lewat tombol **Cetak struk** (Print receipt) di tiket, atau **Print** di
menu "…" pada baris pesanan yang sudah selesai.

**Membaca bagian "Servis berikutnya" di struk:** satu baris per servis — nama servis di kiri, lalu
**km** dan **tanggal** kapan servis itu jatuh tempo di kolom kanan (mana yang lebih dulu tercapai).
Servis yang sudah lewat tandanya **tebal dengan tanda "!"** di depannya, dan ada keterangan
"! = terlambat" di bawahnya. Kalau suatu servis hanya punya batas km atau hanya tanggal, kolom satunya
kosong.

> ⚠️ Di tablet/HP, tombol cetak **dinonaktifkan** dengan keterangan "Cetak dari PC bengkel"
> (Print from the shop PC) — cetak hanya dari komputer bengkel.

---

## 12. Jadwal servis kendaraan

Saat menambah kendaraan baru, buka **Detail lain** (More details) di form kendaraan untuk
memilih cara mengisi jadwal servisnya. Kalau tidak dibuka, yang dipakai **Workshop Default**:
- **Workshop Default** — pakai interval standar bengkel per jenis servis.
- **Customer Interval** — pelanggan minta interval tertentu (misalnya setiap 5.000 km).
- **Custom (set up later)** — tidak diisi sekarang, atur belakangan.

Jadwal otomatis maju setiap kali baris servis yang ditandai "Diganti" (Changed) selesai
dikerjakan.

Di editor jadwal (form **Ubah kendaraan**), tiap servis menampilkan **jatuh tempo berikutnya**
(km dan/atau tanggal) dan tanda **Terlambat** / **Segera jatuh tempo** kalau sudah waktunya.
Saat mengisi atau mengubah jadwal, **Servis berikutnya** muncul langsung di bawah isian sebelum
disimpan. Interval harus bilangan bulat di atas 0 dan tanggal harus tanggal yang benar —
kalau tidak, muncul pesan merah dan tombol Simpan tidak aktif. Interval bulanan yang jatuh di
tanggal 29–31 menyesuaikan ke akhir bulan (31 Jan + 1 bulan = 28 Feb).

> ⚠️ Menjual produk oli lewat baris pesanan bisa **memajukan jadwal servis kendaraan tanpa
> ada yang mencentang apa pun** — sistem mengenali dari kategori produknya.
> ⚠️ Perubahan di editor jadwal (Manage Schedule) **langsung tersimpan**, terpisah dari
> tombol Simpan/Batal di form kendaraan itu sendiri.

---

## 13. Melihat stok di mode Worker

Di **Inventaris** (Inventory), mode Pekerja bisa melihat nama (dengan SKU di bawahnya),
kategori, harga jual, dan stok — termasuk peringatan stok menipis dan filter (termasuk filter
pemasok). Yang tidak terlihat: kolom harga modal (Cost), kode pemasok, tab **Pemasok**, dan
tombol tambah/ubah/hapus. Menambah atau mengubah produk adalah tugas admin.

---

## 14. Hal yang sering bikin bingung

- Tombol tambah pesanan ada di topbar (**Pesanan baru**), `Ctrl+N`, dan di tiap baris
  kendaraan — tidak ada di halaman Pesanan Servis itu sendiri.
- Halaman **Pesanan Servis** dibuka di tab **Terbuka**. Mencari pesanan lama? Pilih tab
  **Semua**, atau tekan **Cari di semua pesanan** saat pencarian tidak menemukan apa-apa.
- Janji Temu dan Pengingat ada di menu **Jadwal**; Perusahaan ada di menu **Pelanggan**;
  Pemasok ada di **Inventaris**; Pengeluaran ada di **Laporan**; Teknisi ada di **Settings**.
- **Belum dibayar** (Unpaid) = selesai tapi belum dibayar. Tidak muncul di tab **Selesai**.
- Menjual produk oli bisa memajukan jadwal servis kendaraan otomatis.
- Kendaraan pesanan yang masih Open **bisa diganti** lewat **Ubah detail → Ganti
  kendaraan**. Sopir tidak bisa dipilih ulang dari sana — kalau sopirnya salah, hapus dan buat
  ulang pesanannya.
- Estimasi waktu bay selalu 60 menit, tidak bisa diubah.
- Di PC bengkel, menyelesaikan pesanan selalu membuka jendela cetak struk.
- Pembatalan/penghapusan mengembalikan stok dan jadwal, tapi **tidak** mengembalikan
  odometer.
- Cetak struk dimatikan di tablet/HP — cetak dari PC bengkel.
- Janji temu hanya bisa dibuat, tidak bisa diubah/dibatalkan/diubah jadi pesanan servis.
- Diskon terkunci sampai tiket berisi minimal satu item.
- Barang yang baru dicatat stoknya tidak otomatis masuk tiket — ketuk lagi barisnya.

---

## 15. Rujukan cepat

### Pintasan keyboard (Keyboard shortcuts)

| Tombol | Fungsi |
|---|---|
| `Ctrl + N` | Pesanan servis baru (New service order) — berfungsi walau sedang mengetik di kolom lain |
| `Ctrl + K` | Pencarian (Search) |
| `Ctrl + D` | Ke Dasbor (Dashboard) |
| `Ctrl + 1` | Ke Pelanggan (Customers) |
| `Ctrl + 2` | Ke Kendaraan (Vehicles) |
| `Ctrl + 3` | Ke Pesanan Servis (Service orders) |
| `Ctrl + 4` | Ke Inventaris (Inventory) |
| `Ctrl + 5` | Ke Laporan (Reports) — khusus admin |
| `Esc` | Tutup dialog atau menu |
| `?` | Tampilkan bantuan pintasan ini |

> 💡 `Ctrl+N` dan `Ctrl+angka` hanya berfungsi di aplikasi PC bengkel — browser tablet memakai
> tombol itu untuk jendela dan tab-nya sendiri. Saat dialog terbuka, pintasan pindah halaman
> diabaikan agar isian tidak hilang (kecuali `Ctrl+N`).

### Arti status pesanan

- **Terbuka** (Open) — sedang dikerjakan.
- **Belum dibayar** (Unpaid) — selesai, belum dibayar (lihat Bagian 5).
- **Selesai** (Completed) — selesai dan sudah dibayar.
- **Dibatalkan** (Cancelled) — dibatalkan lewat Void order.

### Arti status jadwal/tagihan

- **Jatuh Tempo** (Overdue) — sudah lewat waktunya.
- **Akan Jatuh Tempo** (Due Soon) — kurang dari 500 km atau 14 hari (servis), atau kurang
  dari 3 hari (tagihan).
- **On track** — masih aman, belum perlu tindakan.

### Yang tidak bisa dibuka mode Pekerja

Menu **Laporan** (Reports, termasuk Pengeluaran), **Settings** (termasuk Teknisi), dan tab
**Pemasok** (Suppliers) di Inventaris.
