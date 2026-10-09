import { INSTANSI_BAWAAN, type PegawaiDto, type PegawaiPayload, type StatusKode } from "@spjan/shared";

import type { Db } from "../db.js";

interface Row {
  id: number;
  nama: string;
  nip: string;
  jabatan: string;
  instansi: string;
  pangkat_golongan: string;
  status_kode: StatusKode | null;
  aktif: boolean;
}

const map = (r: Row): PegawaiDto => ({ id: r.id, nama: r.nama, nip: r.nip, jabatan: r.jabatan, instansi: r.instansi, pangkatGolongan: r.pangkat_golongan, status: r.status_kode, aktif: r.aktif });

export async function listPegawai(db: Db, soloAktif: boolean): Promise<PegawaiDto[]> {
  const { rows } = await db.query<Row & { punya_akun: boolean }>(
    `select p.id, p.nama, p.nip, p.jabatan, p.instansi, p.pangkat_golongan, p.status_kode, p.aktif,
            exists (select 1 from users u where u.pegawai_id = p.id) as punya_akun
       from pegawai p ${soloAktif ? "where p.aktif" : ""} order by p.nama`,
  );
  return rows.map((r) => ({ ...map(r), punyaAkun: r.punya_akun }));
}

export async function getPegawai(db: Db, id: number): Promise<PegawaiDto | null> {
  const { rows } = await db.query<Row>("select id, nama, nip, jabatan, instansi, pangkat_golongan, status_kode, aktif from pegawai where id = $1", [id]);
  return rows[0] ? map(rows[0]) : null;
}

export async function createPegawai(db: Db, p: PegawaiPayload): Promise<PegawaiDto> {
  const { rows } = await db.query<Row>(
    `insert into pegawai (nama, nip, jabatan, instansi, pangkat_golongan, status_kode) values ($1, $2, $3, $4, $5, $6)
     returning id, nama, nip, jabatan, instansi, pangkat_golongan, status_kode, aktif`,
    [p.nama, p.nip, p.jabatan, p.instansi?.trim() || INSTANSI_BAWAAN, p.pangkatGolongan?.trim() ?? "", p.status],
  );
  return map(rows[0] as Row);
}

export async function updatePegawai(db: Db, id: number, p: Partial<PegawaiPayload>): Promise<PegawaiDto | null> {
  const sekarang = await getPegawai(db, id);
  if (!sekarang) return null;
  const baru = { ...sekarang, ...p };
  const { rows } = await db.query<Row>(
    `update pegawai set nama = $2, nip = $3, jabatan = $4, instansi = $6, pangkat_golongan = $7, status_kode = $5, aktif = true, updated_at = now()
      where id = $1 returning id, nama, nip, jabatan, instansi, pangkat_golongan, status_kode, aktif`,
    [id, baru.nama, baru.nip, baru.jabatan, baru.status, baru.instansi?.trim() || INSTANSI_BAWAAN, baru.pangkatGolongan?.trim() ?? ""],
  );
  if (rows[0]) await db.query("update users set nama = $2 where pegawai_id = $1", [id, rows[0].nama]);
  return rows[0] ? map(rows[0]) : null;
}

/** Nonaktifkan (tidak dihapus agar riwayat surat tugas tetap utuh). */
export async function nonaktifkanPegawai(db: Db, id: number): Promise<boolean> {
  const { rowCount } = await db.query("update pegawai set aktif = false, updated_at = now() where id = $1", [id]);
  return (rowCount ?? 0) > 0;
}
