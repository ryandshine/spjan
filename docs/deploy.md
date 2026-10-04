# Deploy SPJAN ke Dokploy (spjan.ditpps.com)

Server produksi adalah mesin yang sama dengan SIPEKAPS: Docker + Dokploy + Traefik. SPJAN berupa dua kontainer
(`spjan-api` dan `spjan-web`, lihat `docker-compose.dokploy.yml`) dan memakai database `spjan` di server PostgreSQL SIPEKAPS
(kontainer `gealgeolgeo-postgis`, alias di jaringan `dokploy-network`).

## Sekali di awal

1. **Buat peran dan database** di server PostgreSQL (dari mesin server; ganti kata sandi dan pengguna admin sesuai instalasi):
   ```bash
   docker exec -e PGPASSWORD='<sandi admin postgres>' gealgeolgeo-postgis \
     psql -U gealgeolgeo -d postgres -c "create role spjan login password '<sandi-baru-yang-kuat>'" \
                                      -c "create database spjan owner spjan"
   ```
   `DATABASE_URL` yang dipakai aplikasi: `postgres://spjan:<sandi-baru-yang-kuat>@gealgeolgeo-postgis:5432/spjan`.
   Peran `spjan` hanya memiliki database `spjan`; tidak menyentuh database `sipekaps`.
2. **DNS**: pastikan `spjan.ditpps.com` mengarah ke server (rekaman A atau wildcard `*.ditpps.com` yang sudah ada).
3. **Proyek Dokploy `spjan`** (jenis Compose):
   - Sumber: GitHub `ryandshine/spjan`, branch `main`.
   - Compose path: `docker-compose.dokploy.yml`.
   - Environment: `DATABASE_URL`, `ADMIN_USERNAME`, `ADMIN_PASSWORD` (kata sandi kuat; hanya dipakai membuat akun pertama).
     Opsional: `SESSION_TTL_DAYS` (default 7).
   - **Jangan** menambah domain lewat antarmuka Dokploy; routing Traefik sudah ada pada label compose.
4. Catat URL webhook deploy compose proyek ini (dipakai pada langkah Deploy).

## Setiap deploy

Alur kerja proyek: `git push origin main`, lalu picu webhook Dokploy secara manual (masing-masing gerbang
memerlukan persetujuan pengguna):
```bash
curl -sS -X POST "<URL webhook compose spjan>" \
  -H "Content-Type: application/json" -H "X-GitHub-Event: push" \
  -d '{"ref":"refs/heads/main","repository":{"name":"spjan","full_name":"ryandshine/spjan"}}'
```
Migrasi basis data dan seed SBM berjalan otomatis saat kontainer `api` boot (idempoten, dengan advisory lock);
tidak ada langkah migrasi manual.

## Verifikasi setelah deploy

```bash
docker ps --format '{{.Names}} {{.Status}}' | grep spjan        # spjan-api (healthy) dan spjan-web Up
docker logs --since 4m <kontainer api spjan> | grep -E "migrate|startup|listening|error"
curl -s https://spjan.ditpps.com/api/health                    # {"status":"ok"}
curl -s -o /dev/null -w "%{http_code}\n" https://spjan.ditpps.com/api/pegawai   # 401 (bukan 404/500)
```
Lalu buka https://spjan.ditpps.com, masuk dengan `ADMIN_USERNAME`/`ADMIN_PASSWORD`, isi menu Pengaturan
(satker, PPK, bendahara, pejabat bertanggung jawab) dan tambah pegawai.

## Pencadangan

Cadangkan database `spjan` secara berkala, mis.:
```bash
docker exec -e PGPASSWORD='<sandi spjan>' gealgeolgeo-postgis \
  pg_dump -U spjan -d spjan -Fc > spjan-$(date +%F).dump
```
Pulihkan dengan `pg_restore` ke database `spjan` yang kosong.

## Mengganti kata sandi akun

Akun dibuat hanya bila tabel `users` kosong. Untuk mengganti kata sandi, hapus baris pengguna lalu boot ulang `api`
dengan `ADMIN_PASSWORD` baru, atau minta fitur ubah kata sandi ditambahkan ke aplikasi.
