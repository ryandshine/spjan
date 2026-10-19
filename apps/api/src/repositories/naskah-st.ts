import type { FastifyRequest } from "fastify";
import type { NaskahStDto, NaskahStPayload, NaskahStRingkasDto } from "@spjan/shared";

import type { Db } from "../db.js";
import { withTransaction } from "../db.js";
import { HttpError, notFound } from "../errors.js";
import { penggunaAktif } from "../izin.js";

export const kondisiTerlihatNaskah = (alias: string, param: string): string =>
  `(${alias}.dibuat_oleh = ${param} or exists (
     select 1 from users uu join pegawai pg on pg.id = uu.pegawai_id join naskah_st_pelaksana pl on pl.naskah_st_id = ${alias}.id
      where uu.id = ${param} and (pl.pegawai_id = pg.id or regexp_replace(pl.nip, '\\s', '', 'g') = pg.nip)))`;

export async function wajibBolehLihatNaskahSt(db: Db, req: FastifyRequest, id: number): Promise<void> {
  const user = penggunaAktif(req);
  if (user.peran === "admin") return;
  const { rows } = await db.query<{ terlihat: boolean }>(
    `select ${kondisiTerlihatNaskah("n", "$2")} as terlihat from naskah_st n where n.id = $1`,
    [id, user.id],
  );
  if (rows[0] && !rows[0].terlihat) throw notFound("Naskah surat tugas");
}

export async function wajibPemilikNaskahStAtauAdmin(db: Db, req: FastifyRequest, id: number): Promise<void> {
  const user = penggunaAktif(req);
  if (user.peran === "admin") return;
  await wajibBolehLihatNaskahSt(db, req, id);
  const { rows } = await db.query<{ dibuat_oleh: number | null; nama: string | null }>(
    `select n.dibuat_oleh, u.nama from naskah_st n left join users u on u.id = n.dibuat_oleh where n.id = $1`,
    [id],
  );
  const row = rows[0];
  if (row && row.dibuat_oleh !== user.id) {
    throw new HttpError(
      403,
      "BUKAN_PEMILIK",
      `Naskah surat tugas ini dibuat oleh ${row.nama ?? "pengguna lain"}; hanya pembuat atau admin yang boleh mengubahnya.`,
    );
  }
}

export async function listNaskahSt(db: Db, pengguna: { id: number; peran: string }): Promise<NaskahStRingkasDto[]> {
  const { rows } = await db.query<{
    id: number;
    nomor: string;
    mode_nomor: "srikandi" | "manual";
    tanggal: string | null;
    maksud_tugas: string;
    lokasi_tugas: string;
    tanggal_mulai: string;
    tanggal_selesai: string;
    lama_hari: number;
    spj_id: number | null;
    dibuat_oleh: number | null;
    dibuat_oleh_nama: string | null;
    jumlah_pelaksana: number;
    created_at: Date;
    updated_at: Date;
  }>(
    `select n.id, n.nomor, n.mode_nomor, n.tanggal, n.maksud_tugas, n.lokasi_tugas,
            n.tanggal_mulai, n.tanggal_selesai, n.lama_hari, n.spj_id, n.dibuat_oleh,
            u.nama as dibuat_oleh_nama,
            (select count(*)::int from naskah_st_pelaksana p where p.naskah_st_id = n.id) as jumlah_pelaksana,
            n.created_at, n.updated_at
       from naskah_st n
       left join users u on u.id = n.dibuat_oleh
      where 1=1 ${pengguna.peran === "admin" ? "" : `and ${kondisiTerlihatNaskah("n", "$1")}`}
      order by n.created_at desc, n.id desc`,
    pengguna.peran === "admin" ? [] : [pengguna.id],
  );

  return rows.map((r) => ({
    id: r.id,
    nomor: r.nomor,
    modeNomor: r.mode_nomor,
    tanggal: r.tanggal,
    maksudTugas: r.maksud_tugas,
    lokasiTugas: r.lokasi_tugas,
    tanggalMulai: r.tanggal_mulai,
    tanggalSelesai: r.tanggal_selesai,
    lamaHari: r.lama_hari,
    jumlahPelaksana: r.jumlah_pelaksana,
    spjId: r.spj_id,
    dibuatOleh: r.dibuat_oleh,
    dibuatOlehNama: r.dibuat_oleh_nama,
    createdAt: r.created_at.toISOString(),
    updatedAt: r.updated_at.toISOString(),
  }));
}

export async function getNaskahSt(db: Db, id: number): Promise<NaskahStDto | null> {
  const { rows } = await db.query<{
    id: number;
    nomor: string;
    mode_nomor: "srikandi" | "manual";
    tanggal: string | null;
    tempat_naskah: string;
    maksud_tugas: string;
    lokasi_tugas: string;
    tanggal_mulai: string;
    tanggal_selesai: string;
    lama_hari: number;
    dasar_hukum: string[];
    dasar_spesifik: string;
    pelaporan_hari: number;
    pembebanan_anggaran: string;
    penandatangan_jabatan: string;
    penandatangan_nama: string;
    penandatangan_nip: string;
    tembusan: string[];
    spj_id: number | null;
    dibuat_oleh: number | null;
    dibuat_oleh_nama: string | null;
    created_at: Date;
    updated_at: Date;
  }>(
    `select n.id, n.nomor, n.mode_nomor, n.tanggal, n.tempat_naskah, n.maksud_tugas, n.lokasi_tugas,
            n.tanggal_mulai, n.tanggal_selesai, n.lama_hari, n.dasar_hukum, n.dasar_spesifik,
            n.pelaporan_hari, n.pembebanan_anggaran, n.penandatangan_jabatan, n.penandatangan_nama,
            n.penandatangan_nip, n.tembusan, n.spj_id, n.dibuat_oleh, u.nama as dibuat_oleh_nama,
            n.created_at, n.updated_at
       from naskah_st n
       left join users u on u.id = n.dibuat_oleh
      where n.id = $1`,
    [id],
  );

  const st = rows[0];
  if (!st) return null;

  const { rows: pelaksanaRows } = await db.query<{
    id: number;
    urutan: number;
    pegawai_id: number | null;
    nama: string;
    nip: string;
    jabatan: string;
  }>(
    `select id, urutan, pegawai_id, nama, nip, jabatan
       from naskah_st_pelaksana
      where naskah_st_id = $1
      order by urutan asc`,
    [id],
  );

  return {
    id: st.id,
    nomor: st.nomor,
    modeNomor: st.mode_nomor,
    tanggal: st.tanggal,
    tempatNaskah: st.tempat_naskah,
    maksudTugas: st.maksud_tugas,
    lokasiTugas: st.lokasi_tugas,
    tanggalMulai: st.tanggal_mulai,
    tanggalSelesai: st.tanggal_selesai,
    lamaHari: st.lama_hari,
    dasarHukum: st.dasar_hukum || [],
    dasarSpesifik: st.dasar_spesifik || "",
    pelaporanHari: st.pelaporan_hari,
    pembebananAnggaran: st.pembebanan_anggaran,
    penandatanganJabatan: st.penandatangan_jabatan,
    penandatanganNama: st.penandatangan_nama,
    penandatanganNip: st.penandatangan_nip,
    tembusan: st.tembusan || [],
    spjId: st.spj_id,
    dibuatOleh: st.dibuat_oleh,
    dibuatOlehNama: st.dibuat_oleh_nama,
    pelaksana: pelaksanaRows.map((p) => ({
      id: p.id,
      pegawaiId: p.pegawai_id,
      nama: p.nama,
      nip: p.nip,
      jabatan: p.jabatan,
    })),
    createdAt: st.created_at.toISOString(),
    updatedAt: st.updated_at.toISOString(),
  };
}

export async function createNaskahSt(payload: NaskahStPayload, userId: number): Promise<number> {
  return withTransaction(async (client) => {
    const { rows } = await client.query<{ id: number }>(
      `insert into naskah_st (
         nomor, mode_nomor, tanggal, tempat_naskah, maksud_tugas, lokasi_tugas,
         tanggal_mulai, tanggal_selesai, lama_hari, dasar_hukum, dasar_spesifik,
         pelaporan_hari, pembebanan_anggaran, penandatangan_jabatan, penandatangan_nama,
         penandatangan_nip, tembusan, dibuat_oleh
       ) values (
         $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18
       ) returning id`,
      [
        payload.nomor,
        payload.modeNomor,
        payload.tanggal || null,
        payload.tempatNaskah,
        payload.maksudTugas,
        payload.lokasiTugas,
        payload.tanggalMulai,
        payload.tanggalSelesai,
        payload.lamaHari || 1,
        JSON.stringify(payload.dasarHukum || []),
        payload.dasarSpesifik || "",
        payload.pelaporanHari || 5,
        payload.pembebananAnggaran,
        payload.penandatanganJabatan,
        payload.penandatanganNama,
        payload.penandatanganNip,
        JSON.stringify(payload.tembusan || []),
        userId,
      ],
    );

    const naskahId = rows[0]!.id;

    for (let i = 0; i < payload.pelaksana.length; i++) {
      const p = payload.pelaksana[i]!;
      await client.query(
        `insert into naskah_st_pelaksana (naskah_st_id, urutan, pegawai_id, nama, nip, jabatan)
         values ($1, $2, $3, $4, $5, $6)`,
        [naskahId, i + 1, p.pegawaiId || null, p.nama, p.nip || "", p.jabatan || ""],
      );
    }

    return naskahId;
  });
}

export async function updateNaskahSt(id: number, payload: NaskahStPayload): Promise<void> {
  await withTransaction(async (client) => {

    await client.query(
      `update naskah_st set
         nomor = $1, mode_nomor = $2, tanggal = $3, tempat_naskah = $4,
         maksud_tugas = $5, lokasi_tugas = $6, tanggal_mulai = $7,
         tanggal_selesai = $8, lama_hari = $9, dasar_hukum = $10,
         dasar_spesifik = $11, pelaporan_hari = $12, pembebanan_anggaran = $13,
         penandatangan_jabatan = $14, penandatangan_nama = $15,
         penandatangan_nip = $16, tembusan = $17, updated_at = now()
       where id = $18`,
      [
        payload.nomor,
        payload.modeNomor,
        payload.tanggal || null,
        payload.tempatNaskah,
        payload.maksudTugas,
        payload.lokasiTugas,
        payload.tanggalMulai,
        payload.tanggalSelesai,
        payload.lamaHari || 1,
        JSON.stringify(payload.dasarHukum || []),
        payload.dasarSpesifik || "",
        payload.pelaporanHari || 5,
        payload.pembebananAnggaran,
        payload.penandatanganJabatan,
        payload.penandatanganNama,
        payload.penandatanganNip,
        JSON.stringify(payload.tembusan || []),
        id,
      ],
    );

    // Replace pelaksana
    await client.query("delete from naskah_st_pelaksana where naskah_st_id = $1", [id]);
    for (let i = 0; i < payload.pelaksana.length; i++) {
      const p = payload.pelaksana[i]!;
      await client.query(
        `insert into naskah_st_pelaksana (naskah_st_id, urutan, pegawai_id, nama, nip, jabatan)
         values ($1, $2, $3, $4, $5, $6)`,
        [id, i + 1, p.pegawaiId || null, p.nama, p.nip || "", p.jabatan || ""],
      );
    }
  });
}

export async function deleteNaskahSt(db: Db, id: number): Promise<void> {
  await db.query("delete from naskah_st where id = $1", [id]);
}

export async function tautkanNaskahStKeSpj(db: Db, naskahId: number, spjId: number): Promise<void> {
  await db.query("update naskah_st set spj_id = $1, updated_at = now() where id = $2", [spjId, naskahId]);
}
