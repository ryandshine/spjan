import type { BuatPenggunaPayload, PenggunaDto, Peran } from "@spjan/shared";

import { hashPassword } from "../crypto.js";
import type { Db } from "../db.js";
import { HttpError } from "../errors.js";

interface Row {
  id: number;
  username: string;
  nama: string;
  pegawai_id: number | null;
  nip: string | null;
  peran: Peran;
  aktif: boolean;
  created_at: Date;
}

const map = (r: Row): PenggunaDto => ({ id: r.id, username: r.username, nama: r.nama, pegawaiId: r.pegawai_id, nip: r.nip, peran: r.peran, aktif: r.aktif, createdAt: r.created_at.toISOString() });

const SELECT = `select u.id, u.username, u.nama, u.pegawai_id, p.nip, u.peran, u.aktif, u.created_at
  from users u left join pegawai p on p.id = u.pegawai_id`

export async function daftarPengguna(db: Db): Promise<PenggunaDto[]> {
  const { rows } = await db.query<Row>(`${SELECT} order by u.id`);
  return rows.map(map);
}

export async function getPengguna(db: Db, id: number): Promise<PenggunaDto | null> {
  const { rows } = await db.query<Row>(`${SELECT} where u.id = $1`, [id]);
  return rows[0] ? map(rows[0]) : null;
}

export async function buatPengguna(db: Db, v: BuatPenggunaPayload): Promise<PenggunaDto> {
  let username: string
  let nama: string
  let pegawaiId: number | null = null
  if ("pegawaiId" in v) {
    const { rows } = await db.query<{ nama: string; nip: string; aktif: boolean }>("select nama, nip, aktif from pegawai where id = $1", [v.pegawaiId])
    const p = rows[0]
    if (!p) throw new HttpError(404, "TIDAK_DITEMUKAN", "Pegawai tidak ditemukan.")
    if (!p.aktif) throw new HttpError(409, "PEGAWAI_NONAKTIF", "Pegawai nonaktif tidak bisa diberi akun.")
    username = p.nip
    nama = p.nama
    pegawaiId = v.pegawaiId
  } else {
    username = v.username
    nama = v.nama
  }
  const { salt, hash } = hashPassword(v.password)
  try {
    const { rows } = await db.query<{ id: number }>(
      `insert into users (username, nama, peran, pegawai_id, password_salt, password_hash) values ($1, $2, $3, $4, $5, $6) returning id`,
      [username, nama, v.peran, pegawaiId, salt, hash],
    )
    return (await getPengguna(db, (rows[0] as { id: number }).id)) as PenggunaDto
  } catch (error) {
    if ((error as { code?: string }).code === "23505") {
      throw new HttpError(409, pegawaiId !== null ? "PEGAWAI_SUDAH_PUNYA_AKUN" : "USERNAME_SUDAH_ADA", pegawaiId !== null ? "Pegawai ini sudah punya akun." : `Username "${username}" sudah dipakai.`)
    }
    throw error
  }
}

/** Ubah nama/peran/aktif. Admin aktif terakhir tidak boleh diturunkan atau dinonaktifkan. */
export async function ubahPengguna(db: Db, id: number, v: { nama?: string; peran?: Peran; aktif?: boolean }): Promise<PenggunaDto | null> {
  const lama = await getPengguna(db, id);
  if (!lama) return null;
  const peranBaru = v.peran ?? lama.peran;
  const aktifBaru = v.aktif ?? lama.aktif;
  const kehilanganAdmin = lama.peran === "admin" && lama.aktif && (peranBaru !== "admin" || !aktifBaru);
  if (kehilanganAdmin) {
    const { rows } = await db.query<{ n: number }>("select count(*)::int as n from users where peran = 'admin' and aktif and id <> $1", [id]);
    if ((rows[0]?.n ?? 0) === 0) throw new HttpError(409, "ADMIN_TERAKHIR", "Harus ada minimal satu admin aktif.");
  }
  // Akun yang terhubung ke pegawai memakai nama pegawai; nama hanya bisa diubah untuk akun sistem.
  const namaBaru = lama.pegawaiId !== null ? lama.nama : (v.nama ?? lama.nama);
  await db.query("update users set nama = $2, peran = $3, aktif = $4 where id = $1", [id, namaBaru, peranBaru, aktifBaru]);
  return getPengguna(db, id);
}
