import type { PegawaiDto, PegawaiPayload, StatusKode } from "@spjan/shared";

import type { Db } from "../db.js";

interface Row {
  id: number;
  nama: string;
  nip: string;
  jabatan: string;
  status_kode: StatusKode | null;
  aktif: boolean;
}

const map = (r: Row): PegawaiDto => ({ id: r.id, nama: r.nama, nip: r.nip, jabatan: r.jabatan, status: r.status_kode, aktif: r.aktif });

export async function listPegawai(db: Db, soloAktif: boolean): Promise<PegawaiDto[]> {
  const { rows } = await db.query<Row>(
    `select id, nama, nip, jabatan, status_kode, aktif from pegawai ${soloAktif ? "where aktif" : ""} order by nama`,
  );
  return rows.map(map);
}

export async function getPegawai(db: Db, id: number): Promise<PegawaiDto | null> {
  const { rows } = await db.query<Row>("select id, nama, nip, jabatan, status_kode, aktif from pegawai where id = $1", [id]);
  return rows[0] ? map(rows[0]) : null;
}

export async function createPegawai(db: Db, p: PegawaiPayload): Promise<PegawaiDto> {
  const { rows } = await db.query<Row>(
    `insert into pegawai (nama, nip, jabatan, status_kode) values ($1, $2, $3, $4)
     returning id, nama, nip, jabatan, status_kode, aktif`,
    [p.nama, p.nip, p.jabatan, p.status],
  );
  return map(rows[0] as Row);
}

export async function updatePegawai(db: Db, id: number, p: Partial<PegawaiPayload>): Promise<PegawaiDto | null> {
  const sekarang = await getPegawai(db, id);
  if (!sekarang) return null;
  const baru = { ...sekarang, ...p };
  const { rows } = await db.query<Row>(
    `update pegawai set nama = $2, nip = $3, jabatan = $4, status_kode = $5, aktif = true, updated_at = now()
      where id = $1 returning id, nama, nip, jabatan, status_kode, aktif`,
    [id, baru.nama, baru.nip, baru.jabatan, baru.status],
  );
  return rows[0] ? map(rows[0]) : null;
}

/** Nonaktifkan (tidak dihapus agar riwayat surat tugas tetap utuh). */
export async function nonaktifkanPegawai(db: Db, id: number): Promise<boolean> {
  const { rowCount } = await db.query("update pegawai set aktif = false, updated_at = now() where id = $1", [id]);
  return (rowCount ?? 0) > 0;
}
