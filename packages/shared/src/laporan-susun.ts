import type { Bagian, BarisTataWaktuLaporan, Blok, LaporanIsi } from "./laporan.js";
import { bersihkanKegiatanUraian } from "./hitung.js";
import type { PengaturanPayload, SuratTugasDto } from "./schemas.js";
import {
  angkaKata,
  norm,
  parseTanggal,
  proper,
  rentangRincian,
  rentangSptb,
  selisihHari,
  tanggalIndonesia,
  toIsoTanggal,
  type Tanggal,
} from "./teks.js";
import type { FotoDokumentasi } from "./berkas.js";

export type IsiBagianModel =
  | { jenis: "blok"; blok: Blok[] }
  | { jenis: "petugas"; baris: { no: number; nama: string; instansi: string }[] }
  | { jenis: "tatawaktu"; baris: { no: number; kegiatan: string[]; tanggal: string }[] }
  | { jenis: "dokumentasi"; foto: FotoDokumentasi[] };

export interface BagianModel {
  id: string;
  jenis: Bagian["jenis"];
  nomor: number | null;
  judul: string;
  /** true = dihitung dari data ST; false = ditimpa "Tulis sendiri"; null = bagian tanpa mode otomatis. */
  otomatis: boolean | null;
  isi: IsiBagianModel;
}

export interface ModelLaporan {
  sampul: { judul: string; nama: string[]; tempatTanggal: string };
  bagian: BagianModel[];
}

interface EtapeRingkas {
  kota: string;
  provinsi: string;
  kegiatan: string;
  berangkat: Tanggal | null;
  pulang: Tanggal | null;
}

function ringkasEtape(st: SuratTugasDto): EtapeRingkas[] {
  const lihat = new Set<string>();
  const hasil: EtapeRingkas[] = [];
  for (const pel of st.pelaksana) {
    for (const e of pel.etape) {
      const r: EtapeRingkas = {
        kota: (e.kota ?? "").trim(),
        provinsi: (e.provinsi ?? "").trim(),
        kegiatan: bersihkanKegiatanUraian(e.kegiatan ?? ""),
        berangkat: parseTanggal(e.berangkat),
        pulang: parseTanggal(e.pulang),
      };
      const kunci = [norm(r.kota), r.berangkat && toIsoTanggal(r.berangkat), r.pulang && toIsoTanggal(r.pulang), r.kegiatan].join("|");
      if (lihat.has(kunci)) continue;
      lihat.add(kunci);
      hasil.push(r);
    }
  }
  return hasil;
}

const iso = (t: Tanggal | null): string => (t ? toIsoTanggal(t) : "");
const paragraf = (teks: string): Blok[] => (teks ? [{ tipe: "paragraf", teks }] : []);

export function susunLaporan(
  st: SuratTugasDto,
  pengaturan: PengaturanPayload,
  laporan: LaporanIsi,
  foto: FotoDokumentasi[],
): ModelLaporan {
  const etape = ringkasEtape(st);
  const kegiatan = [...new Set(etape.map((e) => e.kegiatan).filter(Boolean))];
  const semuaTanggal = etape.flatMap((e) => [e.berangkat, e.pulang ?? e.berangkat]).filter((t): t is Tanggal => t !== null);
  const urut = [...semuaTanggal].sort((a, b) => iso(a).localeCompare(iso(b)));
  const awal = urut[0] ?? null;
  const akhir = urut[urut.length - 1] ?? null;
  const hari = awal && akhir ? selisihHari(awal, akhir) + 1 : 0;

  const otomatis: Record<"dasar" | "maksud" | "tempat" | "lama", Blok[]> = {
    dasar: paragraf(`Surat Tugas Direktur Pengendalian Perhutanan Sosial nomor: ${st.nomor} tanggal ${tanggalIndonesia(st.tanggal)}.`),
    maksud: paragraf(kegiatan.length ? `Melakukan perjalanan dinas dalam rangka ${kegiatan.join("; ")}.` : ""),
    tempat: (() => {
      const butir = [...new Set(etape.filter((e) => e.kota).map((e) => `${e.kota}${e.provinsi ? `, Provinsi ${proper(e.provinsi)}` : ""}`))];
      return butir.length
        ? [{ tipe: "paragraf", teks: "Perjalanan dinas dilaksanakan di tempat berikut:" }, { tipe: "daftar", butir }]
        : [];
    })(),
    lama: paragraf(
      hari > 0 && awal && akhir
        ? `Perjalanan dinas selama ${hari}${hari <= 99 ? ` (${angkaKata(hari)})` : ""} hari, pada tanggal ${rentangSptb(awal, akhir)}.`
        : "",
    ),
  };

  const tataWaktuOtomatis: BarisTataWaktuLaporan[] = [...etape]
    .sort((a, b) => iso(a.berangkat).localeCompare(iso(b.berangkat)))
    .map((e) => {
      const a = e.berangkat ?? e.pulang;
      const b = e.pulang ?? e.berangkat;
      return {
        kegiatan: [e.kegiatan || (e.kota ? `Perjalanan dinas ke ${e.kota}` : "Perjalanan dinas")],
        tanggal: a && b ? rentangRincian(a, b) : "",
      };
    });

  const sampulBagian = laporan.bagian.find((b) => b.jenis === "sampul");
  const sampulJudul = sampulBagian?.judul?.trim();
  const tanggalSampul = (sampulBagian?.tanggal ?? "") || (st.tanggalSpj ?? "") || iso(akhir);
  const teksTanggal = tanggalIndonesia(tanggalSampul).toUpperCase();
  const kota = pengaturan.kotaKedudukan.toUpperCase();

  const instansi = new Map<string, string>();
  for (const b of laporan.bagian) {
    if (b.jenis === "petugas") for (const i of b.instansi) instansi.set(norm(i.kunci), i.instansi);
  }

  let nomor = 0;
  const bagian: BagianModel[] = [];
  for (const b of laporan.bagian) {
    if (b.jenis === "sampul") continue;
    const nomorBagian = b.judul.trim() ? ++nomor : null;
    const dasar = { id: b.id, jenis: b.jenis, nomor: nomorBagian, judul: b.judul };
    switch (b.jenis) {
      case "teks":
        bagian.push({ ...dasar, otomatis: null, isi: { jenis: "blok", blok: b.blok } });
        break;
      case "dasar":
      case "maksud":
      case "tempat":
      case "lama":
        bagian.push({ ...dasar, otomatis: b.ganti === null, isi: { jenis: "blok", blok: b.ganti ?? otomatis[b.jenis] } });
        break;
      case "tatawaktu":
        bagian.push({
          ...dasar,
          otomatis: b.ganti === null,
          isi: { jenis: "tatawaktu", baris: (b.ganti ?? tataWaktuOtomatis).map((r, i) => ({ no: i + 1, ...r })) },
        });
        break;
      case "petugas":
        bagian.push({
          ...dasar,
          otomatis: null,
          isi: {
            jenis: "petugas",
            baris: st.pelaksana.map((p, i) => ({ no: i + 1, nama: p.nama, instansi: instansi.get(norm(p.nama)) ?? p.instansi ?? "" })),
          },
        });
        break;
      case "dokumentasi":
        bagian.push({ ...dasar, otomatis: null, isi: { jenis: "dokumentasi", foto } });
        break;
    }
  }

  return {
    sampul: {
      judul: sampulJudul || (kegiatan.length ? `PERJALANAN DINAS DALAM RANGKA ${kegiatan.join("; ").toUpperCase()}` : "PERJALANAN DINAS"),
      nama: st.pelaksana.map((p) => p.nama).filter(Boolean),
      tempatTanggal: teksTanggal ? `${kota}, ${teksTanggal}` : kota,
    },
    bagian,
  };
}
