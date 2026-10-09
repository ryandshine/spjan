import type { PoolClient } from "pg";
import { INSTANSI_BAWAAN, normalkanUraianTiket, type StatusKode, type StatusSt, type SuratTugasDto, type SuratTugasPayload, type SuratTugasRingkasDto } from "@spjan/shared";

import type { Db } from "../db.js";
import { withTransaction } from "../db.js";
import { HttpError } from "../errors.js";

export async function listSuratTugas(db: Db): Promise<Omit<SuratTugasRingkasDto, "total" | "jumlahPeringatan">[]> {
  const { rows } = await db.query<{ id: number; nomor: string; tanggal: string; status: StatusSt; n: number; updated_at: Date }>(
    `select st.id, st.nomor, st.tanggal, st.status, st.updated_at,
            (select count(*)::int from pelaksana p where p.st_id = st.id) as n
       from surat_tugas st order by st.tanggal desc, st.id desc`,
  );
  return rows.map((r) => ({ id: r.id, nomor: r.nomor, tanggal: r.tanggal, status: r.status, jumlahPelaksana: r.n, updatedAt: r.updated_at.toISOString() }));
}

interface StRow {
  id: number;
  nomor: string;
  tanggal: string;
  tanggal_spj: string | null;
  kode_akun: string;
  versi_sbm_id: number;
  status: StatusSt;
  dikunci_pada: Date | null;
  dibuka_pada: Date | null;
  jumlah_dibuka: number;
  catatan: string;
  tahun_anggaran: number | null;
  sumber_dana: "RM" | "PNBP" | null;
  pj_nama: string | null;
  pj_nip: string | null;
  pj_jabatan: string | null;
  created_at: Date;
  updated_at: Date;
}
interface PelRow {
  id: number;
  pegawai_id: number | null;
  no_spd: string | null;
  tanggal_spd: string | null;
  nama: string;
  nip: string;
  jabatan: string;
  instansi: string;
  pangkat_golongan: string;
  status_kode: StatusKode | null;
}
interface EtapeRow {
  pelaksana_id: number;
  provinsi: string;
  kota: string;
  kegiatan: string;
  berangkat: string | null;
  pulang: string | null;
  malam_override: number | null;
  hotel_nama: string | null;
  hotel_tarif: number | null;
  dinas_jabatan: boolean;
  fullboard_dates: string[] | null;
  hotel_30_persen: boolean;
  dalam_kota_8_jam: boolean;
}
interface BiayaRow {
  pelaksana_id: number;
  jenis: SuratTugasPayload["pelaksana"][number]["biaya"][number]["jenis"];
  provinsi: string | null;
  uraian: string | null;
  qty: number | null;
  satuan: string | null;
  tarif: number;
  keterangan: string | null;
  etape_urutan: number | null;
  pengeluaran_riil: boolean | null;
}

export async function getSuratTugas(db: Db, id: number): Promise<SuratTugasDto | null> {
  const st = (await db.query<StRow>("select * from surat_tugas where id = $1", [id])).rows[0];
  if (!st) return null;
  const pel = (await db.query<PelRow>("select * from pelaksana where st_id = $1 order by urutan", [id])).rows;
  const etape = (
    await db.query<EtapeRow>(
      `select e.* from etape e join pelaksana p on p.id = e.pelaksana_id where p.st_id = $1 order by e.pelaksana_id, e.urutan`,
      [id],
    )
  ).rows;
  const biaya = (
    await db.query<BiayaRow>(
      `select b.* from biaya b join pelaksana p on p.id = b.pelaksana_id where p.st_id = $1 order by b.pelaksana_id, b.urutan`,
      [id],
    )
  ).rows;
  return {
    id: st.id,
    versiSbmId: st.versi_sbm_id,
    status: st.status,
    dikunciPada: st.dikunci_pada?.toISOString() ?? null,
    dibukaPada: st.dibuka_pada?.toISOString() ?? null,
    jumlahDibuka: st.jumlah_dibuka,
    createdAt: st.created_at.toISOString(),
    updatedAt: st.updated_at.toISOString(),
    nomor: st.nomor,
    tanggal: st.tanggal,
    tanggalSpj: st.tanggal_spj,
    kodeAkun: st.kode_akun,
    catatan: st.catatan,
    tahunAnggaran: st.tahun_anggaran ?? null,
    sumberDana: (st.sumber_dana as "RM" | "PNBP") ?? "RM",
    pjNama: st.pj_nama ?? null,
    pjNip: st.pj_nip ?? null,
    pjJabatan: st.pj_jabatan ?? null,
    pelaksana: pel.map((p) => ({
      pegawaiId: p.pegawai_id,
      nama: p.nama,
      nip: p.nip,
      jabatan: p.jabatan,
      instansi: p.instansi,
      pangkatGolongan: p.pangkat_golongan,
      status: p.status_kode,
      noSpd: p.no_spd,
      tanggalSpd: p.tanggal_spd ? String(p.tanggal_spd).slice(0, 10) : null,
      etape: etape
        .filter((e) => e.pelaksana_id === p.id)
        .map((e) => ({
          provinsi: e.provinsi,
          kota: e.kota,
          kegiatan: e.kegiatan,
          berangkat: e.berangkat ?? "",
          pulang: e.pulang ?? "",
          malamOverride: e.malam_override,
          hotelNama: e.hotel_nama,
          hotelTarif: e.hotel_tarif,
          dinasJabatan: e.dinas_jabatan,
          fullboardDates: e.fullboard_dates ?? [],
          hotel30Persen: e.hotel_30_persen ?? false,
          dalamKota8Jam: e.dalam_kota_8_jam ?? false,
        })),
      biaya: biaya
        .filter((b) => b.pelaksana_id === p.id)
        .map((b) => ({
          jenis: b.jenis,
          provinsi: b.provinsi,
          uraian: b.uraian && (b.jenis === "TIKET_PERGI" || b.jenis === "TIKET_KEMBALI") ? normalkanUraianTiket(b.uraian) : b.uraian,
          qty: b.qty,
          satuan: b.satuan,
          tarif: b.tarif,
          keterangan: b.keterangan,
          etapeIndex: b.etape_urutan,
          pengeluaranRiil: b.pengeluaran_riil ?? false,
        })),
    })),
  };
}

async function sisipkanPelaksana(client: PoolClient, stId: number, pelaksana: SuratTugasPayload["pelaksana"]): Promise<void> {
  for (const [i, p] of pelaksana.entries()) {
    const { rows } = await client.query<{ id: number }>(
      `insert into pelaksana (st_id, urutan, pegawai_id, no_spd, tanggal_spd, nama, nip, jabatan, instansi, pangkat_golongan, status_kode)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) returning id`,
      [stId, i, p.pegawaiId ?? null, p.noSpd ?? null, p.tanggalSpd ?? null, p.nama, p.nip, p.jabatan, p.instansi?.trim() || INSTANSI_BAWAAN, p.pangkatGolongan?.trim() ?? "", p.status],
    );
    const pelId = (rows[0] as { id: number }).id;
    for (const [j, e] of p.etape.entries()) {
      await client.query(
        `insert into etape (pelaksana_id, urutan, provinsi, kota, kegiatan, berangkat, pulang, malam_override, hotel_nama, hotel_tarif, dinas_jabatan, fullboard_dates, hotel_30_persen, dalam_kota_8_jam)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
        [
          pelId, j, e.provinsi, e.kota, e.kegiatan, e.berangkat || null, e.pulang || null,
          e.malamOverride ?? null, e.hotelNama ?? null, e.hotelTarif ?? null, e.dinasJabatan ?? false,
          e.fullboardDates ?? [], e.hotel30Persen ?? false, e.dalamKota8Jam ?? false,
        ],
      );
    }
    for (const [j, b] of p.biaya.entries()) {
      const uraianBersih = b.uraian && (b.jenis === "TIKET_PERGI" || b.jenis === "TIKET_KEMBALI")
        ? normalkanUraianTiket(b.uraian)
        : b.uraian;
      await client.query(
        `insert into biaya (pelaksana_id, urutan, jenis, provinsi, uraian, qty, satuan, tarif, keterangan, etape_urutan, pengeluaran_riil)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
          pelId,
          j,
          b.jenis,
          b.provinsi ?? null,
          uraianBersih ?? null,
          b.qty ?? null,
          b.satuan ?? null,
          b.tarif,
          b.keterangan ?? null,
          b.etapeIndex ?? null,
          b.pengeluaranRiil ?? false,
        ],
      );
    }
  }
}

export async function createSuratTugas(payload: SuratTugasPayload, versiSbmId: number): Promise<number> {
  return withTransaction(async (client) => {
    const { rows } = await client.query<{ id: number }>(
      `insert into surat_tugas (nomor, tanggal, tanggal_spj, kode_akun, versi_sbm_id, catatan, tahun_anggaran, sumber_dana, pj_nama, pj_nip, pj_jabatan)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) returning id`,
      [
        payload.nomor,
        payload.tanggal,
        payload.tanggalSpj ?? null,
        payload.kodeAkun,
        versiSbmId,
        payload.catatan,
        payload.tahunAnggaran ?? null,
        payload.sumberDana ?? "RM",
        payload.pjNama ?? null,
        payload.pjNip ?? null,
        payload.pjJabatan ?? null,
      ],
    );
    const id = (rows[0] as { id: number }).id;
    await sisipkanPelaksana(client, id, payload.pelaksana);
    return id;
  });
}

/** Ganti seluruh pohon pelaksana/etape/biaya dalam satu transaksi. false bila ST tidak ada. */
export async function replaceSuratTugas(id: number, payload: SuratTugasPayload): Promise<boolean> {
  return withTransaction(async (client) => {
    const { rowCount } = await client.query(
      `update surat_tugas set nomor = $2, tanggal = $3, tanggal_spj = $4, kode_akun = $5, catatan = $6,
         tahun_anggaran = $7, sumber_dana = $8, pj_nama = $9, pj_nip = $10, pj_jabatan = $11, updated_at = now()
        where id = $1 and status = 'draft'`,
      [
        id,
        payload.nomor,
        payload.tanggal,
        payload.tanggalSpj ?? null,
        payload.kodeAkun,
        payload.catatan,
        payload.tahunAnggaran ?? null,
        payload.sumberDana ?? "RM",
        payload.pjNama ?? null,
        payload.pjNip ?? null,
        payload.pjJabatan ?? null,
      ],
    );
    if (!rowCount) {
      await tolakBilaTerkunci(client, id);
      return false;
    }
    await client.query("delete from pelaksana where st_id = $1", [id]);
    await sisipkanPelaksana(client, id, payload.pelaksana);
    return true;
  });
}

export async function deleteSuratTugas(db: Db, id: number): Promise<boolean> {
  const { rowCount } = await db.query("delete from surat_tugas where id = $1 and status = 'draft'", [id]);
  if (rowCount) return true;
  await tolakBilaTerkunci(db, id);
  return false;
}

export const galatTerkunci = () =>
  new HttpError(409, "ST_TERKUNCI", "Surat tugas sudah ditandai selesai dan terkunci. Buka kunci dulu untuk mengubahnya.");

/** Lempar ST_TERKUNCI bila surat tugas ada dan berstatus final. */
export async function tolakBilaTerkunci(db: Pick<Db, "query"> | PoolClient, id: number): Promise<void> {
  const { rows } = await db.query<{ status: StatusSt }>("select status from surat_tugas where id = $1", [id]);
  if (rows[0]?.status === "final") throw galatTerkunci();
}

/** Tolak perubahan atas berkas yang melekat pada surat tugas terkunci (berkas tanpa ST tidak dikunci). */
export async function tolakBilaBerkasTerkunci(db: Db, berkasId: number): Promise<void> {
  const { rows } = await db.query<{ status: StatusSt }>(
    "select s.status from berkas b join surat_tugas s on s.id = b.st_id where b.id = $1",
    [berkasId],
  );
  if (rows[0]?.status === "final") throw galatTerkunci();
}

/** Ubah status kunci. false bila ST tidak ada. Idempoten: mengunci ST yang sudah final tidak mengubah apa pun. */
export async function aturKunciSt(db: Db, id: number, kunci: boolean): Promise<boolean> {
  const sql = kunci
    ? `update surat_tugas set status = 'final', dikunci_pada = now() where id = $1 and status = 'draft'`
    : `update surat_tugas set status = 'draft', dibuka_pada = now(), jumlah_dibuka = jumlah_dibuka + 1 where id = $1 and status = 'final'`;
  const { rowCount } = await db.query(sql, [id]);
  if (rowCount) return true;
  const { rows } = await db.query("select 1 from surat_tugas where id = $1", [id]);
  return rows.length > 0;
}
