# Laporan Perjalanan Dinas Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pengguna dapat menyusun Laporan Perjalanan Dinas per surat tugas di editor web (bagian otomatis dari data SPJ, narasi manual) dan mencetaknya sebagai PDF.

**Architecture:** Isi laporan (`LaporanIsi`, jsonb) disimpan satu baris per ST. Fungsi murni `susunLaporan` di `@spjan/shared` menggabungkan data ST + isi tersimpan menjadi `ModelLaporan` yang dipakai editor (pratinjau bagian otomatis) dan PDF. Bagian otomatis memakai `ganti: null`; "Tulis sendiri" mengisi `ganti`.

**Tech Stack:** TypeScript strict, zod 4, Fastify 5 + pg, React 19 + TanStack Query, `@react-pdf/renderer`, vitest.

**Spec:** `docs/superpowers/specs/2026-10-08-laporan-perjadin-design.md`

## Global Constraints

- TypeScript strict dengan `noUncheckedIndexedAccess`; impor relatif memakai akhiran `.js` (di `packages/shared` dan `apps/api`).
- `susunLaporan` dan `buatLaporanAwal` fungsi murni; tidak ada akses DB/jaringan/`Date.now()` di `packages/shared`.
- Teks keluaran berbahasa Indonesia; kunci instansi = `norm(nama)`.
- File `apps/web/src/pdf/*.tsx` memakai impor relatif (bukan `@/`).
- Setelah mengubah `packages/shared/src`, jalankan `npm run build` di `packages/shared` sebelum menguji api/web.
- Tidak ada tes frontend; verifikasi web lewat tsc, eslint, build, PDF contoh, dan peramban.
- Jangan commit/push/deploy tanpa persetujuan eksplisit pengguna di tiap gerbang.
- Kop sampul: baris 1 "DIREKTORAT JENDERAL PERHUTANAN SOSIAL", baris 2 "DIREKTORAT PENGENDALIAN PERHUTANAN SOSIAL" (konstanta).

---

### Task 1: Skema, template awal, dan penyusun laporan (`packages/shared`)

**Files:**
- Create: `packages/shared/src/laporan.ts` (skema zod, tipe, `buatLaporanAwal`)
- Create: `packages/shared/src/laporan-susun.ts` (`susunLaporan`, tipe model)
- Create: `packages/shared/src/laporan.test.ts`
- Modify: `packages/shared/src/index.ts` (ekspor kedua modul)

**Interfaces:**
- Produces (dipakai Task 2-4):
  - `LaporanIsiSchema`, `type LaporanIsi`, `type Bagian`, `type Blok`
  - `buatLaporanAwal(): LaporanIsi`
  - `susunLaporan(st: SuratTugasDto, pengaturan: PengaturanPayload, laporan: LaporanIsi, foto: FotoDokumentasi[]): ModelLaporan`
  - `ModelLaporan = { sampul: { judul: string; nama: string[]; tempatTanggal: string }; bagian: BagianModel[] }`
  - `BagianModel = { id: string; jenis: Bagian["jenis"]; nomor: number | null; judul: string; otomatis: boolean | null; isi: IsiBagianModel }`
  - `IsiBagianModel = {jenis:"blok";blok:Blok[]} | {jenis:"petugas";baris:{no:number;nama:string;instansi:string}[]} | {jenis:"tatawaktu";baris:{no:number;kegiatan:string[];tanggal:string}[]} | {jenis:"dokumentasi";foto:FotoDokumentasi[]}`

- [ ] **Step 1: Tulis tes gagal** `packages/shared/src/laporan.test.ts`

```ts
import { describe, expect, it } from "vitest";
import { buatLaporanAwal, LaporanIsiSchema, type LaporanIsi } from "./laporan.js";
import { susunLaporan } from "./laporan-susun.js";
import type { PengaturanPayload, SuratTugasDto } from "./schemas.js";
import { etapeKosong } from "./st-model.js";

const pengaturan = { kotaKedudukan: "Jakarta" } as PengaturanPayload;

function stUji(over: Partial<SuratTugasDto> = {}): SuratTugasDto {
  return {
    id: 1, versiSbmId: 1, createdAt: "", updatedAt: "",
    nomor: "ST.228/PPS/PEMPS/PSL.04.02/B/09/2026", tanggal: "2026-09-14", tanggalSpj: "2026-09-21",
    kodeAkun: "", catatan: "", tahunAnggaran: null, sumberDana: "RM", pjNama: null, pjNip: null, pjJabatan: null,
    pelaksana: [
      { pegawaiId: null, nama: "Gunadi Firdaus", nip: "1", jabatan: "", status: null, noSpd: null, tanggalSpd: null, biaya: [],
        etape: [{ ...etapeKosong(), provinsi: "SUMATERA SELATAN", kota: "Musi Banyuasin",
          kegiatan: "Pengawasan di Desa Muara Merang", berangkat: "2026-09-17", pulang: "2026-09-19" }] },
      { pegawaiId: null, nama: "Aisyah", nip: "2", jabatan: "", status: null, noSpd: null, tanggalSpd: null, biaya: [],
        etape: [{ ...etapeKosong(), provinsi: "SUMATERA SELATAN", kota: "Musi Banyuasin",
          kegiatan: "Pengawasan di Desa Muara Merang", berangkat: "2026-09-17", pulang: "2026-09-19" }] },
    ],
    ...over,
  };
}
const teksBlok = (m: ReturnType<typeof susunLaporan>, id: string) => {
  const isi = m.bagian.find((b) => b.id === id)!.isi;
  return isi.jenis === "blok" ? isi.blok : [];
};

describe("buatLaporanAwal", () => {
  it("lolos skema dan id unik", () => {
    const awal = buatLaporanAwal();
    expect(LaporanIsiSchema.safeParse(awal).success).toBe(true);
    expect(new Set(awal.bagian.map((b) => b.id)).size).toBe(awal.bagian.length);
    expect(awal.bagian[0]?.jenis).toBe("sampul");
  });
  it("skema menolak id ganda dan teks terlalu panjang", () => {
    const awal = buatLaporanAwal();
    const ganda = { ...awal, bagian: [...awal.bagian, awal.bagian[1]!] };
    expect(LaporanIsiSchema.safeParse(ganda).success).toBe(false);
    const panjang: LaporanIsi = { versi: 1, bagian: [{ id: "x", jenis: "teks", judul: "A", blok: [{ tipe: "paragraf", teks: "a".repeat(10_001) }] }] };
    expect(LaporanIsiSchema.safeParse(panjang).success).toBe(false);
  });
});

describe("susunLaporan", () => {
  it("menurunkan bagian otomatis dari data ST", () => {
    const m = susunLaporan(stUji(), pengaturan, buatLaporanAwal(), []);
    expect(m.sampul.judul).toBe("PERJALANAN DINAS DALAM RANGKA PENGAWASAN DI DESA MUARA MERANG");
    expect(m.sampul.nama).toEqual(["Gunadi Firdaus", "Aisyah"]);
    expect(m.sampul.tempatTanggal).toBe("JAKARTA, 21 SEPTEMBER 2026");
    expect(teksBlok(m, "dasar")).toEqual([
      { tipe: "paragraf", teks: "Surat Tugas Direktur Pengendalian Perhutanan Sosial nomor: ST.228/PPS/PEMPS/PSL.04.02/B/09/2026 tanggal 14 September 2026." },
    ]);
    expect(teksBlok(m, "maksud")).toEqual([
      { tipe: "paragraf", teks: "Melakukan perjalanan dinas dalam rangka Pengawasan di Desa Muara Merang." },
    ]);
    expect(teksBlok(m, "lama")).toEqual([
      { tipe: "paragraf", teks: "Perjalanan dinas selama 3 (tiga) hari, pada tanggal 17 s.d. 19 September 2026." },
    ]);
    expect(teksBlok(m, "tempat")).toEqual([
      { tipe: "paragraf", teks: "Perjalanan dinas dilaksanakan di tempat berikut:" },
      { tipe: "daftar", butir: ["Musi Banyuasin, Provinsi Sumatera Selatan"] },
    ]);
    const tw = m.bagian.find((b) => b.id === "tatawaktu")!;
    expect(tw.isi).toEqual({ jenis: "tatawaktu", baris: [{ no: 1, kegiatan: ["Pengawasan di Desa Muara Merang"], tanggal: "17-19 September 2026" }] });
    expect(tw.otomatis).toBe(true);
  });

  it("menomori bagian ber-judul saja; penutup tanpa judul tidak bernomor", () => {
    const m = susunLaporan(stUji(), pengaturan, buatLaporanAwal(), []);
    expect(m.bagian.map((b) => b.nomor)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, null, 9]);
    expect(m.bagian.some((b) => b.jenis === "sampul")).toBe(false);
  });

  it("ganti menimpa bagian otomatis dan tidak lagi mengikuti ST", () => {
    const awal = buatLaporanAwal();
    const laporan: LaporanIsi = {
      ...awal,
      bagian: awal.bagian.map((b) => (b.id === "dasar" && b.jenis === "dasar" ? { ...b, ganti: [{ tipe: "paragraf" as const, teks: "Tulis sendiri" }] } : b)),
    };
    const m = susunLaporan(stUji({ nomor: "ST.BARU" }), pengaturan, laporan, []);
    expect(teksBlok(m, "dasar")).toEqual([{ tipe: "paragraf", teks: "Tulis sendiri" }]);
    expect(m.bagian.find((b) => b.id === "dasar")!.otomatis).toBe(false);
    expect(JSON.stringify(teksBlok(m, "maksud"))).toContain("Pengawasan");
  });

  it("instansi terikat ke nama sehingga aman bila urutan pelaksana berubah", () => {
    const awal = buatLaporanAwal();
    const laporan: LaporanIsi = {
      ...awal,
      bagian: awal.bagian.map((b) => (b.jenis === "petugas" ? { ...b, instansi: [{ kunci: "AISYAH", instansi: "Direktorat PPS" }] } : b)),
    };
    const st = stUji();
    const terbalik = stUji({ pelaksana: [...st.pelaksana].reverse() });
    for (const s of [st, terbalik]) {
      const p = susunLaporan(s, pengaturan, laporan, []).bagian.find((b) => b.jenis === "petugas")!.isi;
      expect(p.jenis === "petugas" && p.baris.find((r) => r.nama === "Aisyah")?.instansi).toBe("Direktorat PPS");
    }
  });

  it("tanpa etape: bagian turunan kosong dan judul sampul bawaan", () => {
    const st = stUji();
    const kosong = stUji({ pelaksana: st.pelaksana.map((p) => ({ ...p, etape: [] })) });
    const m = susunLaporan(kosong, pengaturan, buatLaporanAwal(), []);
    expect(m.sampul.judul).toBe("PERJALANAN DINAS");
    expect(teksBlok(m, "lama")).toEqual([]);
    expect(teksBlok(m, "maksud")).toEqual([]);
    expect(m.bagian.find((b) => b.id === "tatawaktu")!.isi).toEqual({ jenis: "tatawaktu", baris: [] });
  });

  it("dua etape berbeda: tempat dan tata waktu terurut menurut tanggal", () => {
    const st = stUji();
    const p0 = st.pelaksana[0]!;
    const dua = stUji({
      pelaksana: [{ ...p0, etape: [
        { ...etapeKosong(), provinsi: "JAMBI", kota: "Kota Jambi", kegiatan: "Koordinasi", berangkat: "2026-09-20", pulang: "2026-09-20" },
        ...p0.etape,
      ] }],
    });
    const m = susunLaporan(dua, pengaturan, buatLaporanAwal(), []);
    const tw = m.bagian.find((b) => b.id === "tatawaktu")!.isi;
    expect(tw.jenis === "tatawaktu" && tw.baris.map((r) => r.tanggal)).toEqual(["17-19 September 2026", "20 September 2026"]);
    expect(teksBlok(m, "lama")[0]).toEqual({ tipe: "paragraf", teks: "Perjalanan dinas selama 4 (empat) hari, pada tanggal 17 s.d. 20 September 2026." });
  });
});
```

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `cd packages/shared && npx vitest run src/laporan.test.ts`
Expected: FAIL (modul `./laporan.js` tidak ada).

- [ ] **Step 3: Implementasi** `packages/shared/src/laporan.ts`

```ts
import { z } from "zod";

const judulPendek = z.string().max(300);
const teksPanjang = z.string().max(10_000);
const tanggalIso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const idBagian = z.string().min(1).max(40);

export const BlokSchema = z.discriminatedUnion("tipe", [
  z.object({ tipe: z.literal("paragraf"), teks: teksPanjang }),
  z.object({ tipe: z.literal("subjudul"), teks: judulPendek }),
  z.object({ tipe: z.literal("daftar"), butir: z.array(teksPanjang).max(100) }),
  z.object({ tipe: z.literal("nomor"), butir: z.array(teksPanjang).max(100) }),
]);
export type Blok = z.infer<typeof BlokSchema>;
const DaftarBlok = z.array(BlokSchema).max(200);

const BarisTataWaktu = z.object({ kegiatan: z.array(judulPendek).max(20), tanggal: judulPendek });
export type BarisTataWaktuLaporan = z.infer<typeof BarisTataWaktu>;

const teksOtomatis = <J extends "dasar" | "maksud" | "tempat" | "lama">(jenis: J) =>
  z.object({ id: idBagian, jenis: z.literal(jenis), judul: judulPendek, ganti: DaftarBlok.nullable() });

export const BagianSchema = z.discriminatedUnion("jenis", [
  z.object({ id: idBagian, jenis: z.literal("sampul"), judul: judulPendek.nullish(), tanggal: tanggalIso.nullish() }),
  z.object({
    id: idBagian,
    jenis: z.literal("petugas"),
    judul: judulPendek,
    instansi: z.array(z.object({ kunci: judulPendek, instansi: judulPendek })).max(30),
  }),
  z.object({ id: idBagian, jenis: z.literal("dokumentasi"), judul: judulPendek }),
  teksOtomatis("dasar"),
  teksOtomatis("maksud"),
  teksOtomatis("tempat"),
  teksOtomatis("lama"),
  z.object({ id: idBagian, jenis: z.literal("tatawaktu"), judul: judulPendek, ganti: z.array(BarisTataWaktu).max(100).nullable() }),
  z.object({ id: idBagian, jenis: z.literal("teks"), judul: judulPendek, blok: DaftarBlok }),
]);
export type Bagian = z.infer<typeof BagianSchema>;

export const LaporanIsiSchema = z
  .object({ versi: z.literal(1), bagian: z.array(BagianSchema).min(1).max(40) })
  .refine((v) => new Set(v.bagian.map((b) => b.id)).size === v.bagian.length, { message: "id bagian harus unik" });
export type LaporanIsi = z.infer<typeof LaporanIsiSchema>;

const p = (teks = ""): Blok => ({ tipe: "paragraf", teks });
const sj = (teks: string): Blok => ({ tipe: "subjudul", teks });

/** Template "Pengawasan PS": semua bagian otomatis belum ditimpa (`ganti: null`), bagian narasi kosong. */
export function buatLaporanAwal(): LaporanIsi {
  return {
    versi: 1,
    bagian: [
      { id: "sampul", jenis: "sampul", judul: null, tanggal: null },
      { id: "dasar", jenis: "dasar", judul: "Dasar Penugasan", ganti: null },
      { id: "petugas", jenis: "petugas", judul: "Petugas yang Melaksanakan Perjalanan Dinas", instansi: [] },
      { id: "maksud", jenis: "maksud", judul: "Maksud dan Tujuan Perjalanan Dinas", ganti: null },
      { id: "tempat", jenis: "tempat", judul: "Tempat yang Dikunjungi", ganti: null },
      { id: "lama", jenis: "lama", judul: "Lama Perjalanan Dinas", ganti: null },
      { id: "tatawaktu", jenis: "tatawaktu", judul: "Tata Waktu Pelaksanaan", ganti: null },
      {
        id: "hasil",
        jenis: "teks",
        judul: "Hasil Kegiatan",
        blok: [
          sj("Pelaksanaan Pengawasan"), p(),
          sj("Hasil Pengawasan"), p(),
          sj("Pemenuhan Hak"), p(),
          sj("Pelaksanaan Kewajiban Pengelolaan"), p(),
          sj("Kepatuhan terhadap Larangan"), p(),
          sj("Perlindungan Hutan dan Pengendalian Kebakaran"), p(),
        ],
      },
      {
        id: "simpulan",
        jenis: "teks",
        judul: "Kesimpulan dan Rekomendasi Tindak Lanjut",
        blok: [sj("Simpulan"), p(), sj("Saran dan Tindak Lanjut"), { tipe: "nomor", butir: [""] }],
      },
      { id: "penutup", jenis: "teks", judul: "", blok: [p("Demikian laporan ini dibuat, semoga bermanfaat.")] },
      { id: "dokumentasi", jenis: "dokumentasi", judul: "Dokumentasi Kegiatan" },
    ],
  };
}
```

`packages/shared/src/laporan-susun.ts`

```ts
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
            baris: st.pelaksana.map((p, i) => ({ no: i + 1, nama: p.nama, instansi: instansi.get(norm(p.nama)) ?? "" })),
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
```

Catatan: `FotoDokumentasi` didefinisikan di `packages/shared/src/berkas.ts` (sudah ada). Tambahkan di `packages/shared/src/index.ts`:

```ts
export * from "./laporan.js";
export * from "./laporan-susun.js";
```

- [ ] **Step 4: Jalankan tes sampai lulus**

Run: `cd packages/shared && npx vitest run src/laporan.test.ts && npm run lint && npm run build`
Expected: semua tes lulus, lint dan build bersih.

---

### Task 2: Penyimpanan dan API laporan (`apps/api`)

**Files:**
- Create: `apps/api/migrations/1791126000012_laporan.sql`
- Create: `apps/api/src/repositories/laporan.ts`
- Create: `apps/api/src/routes/laporan.ts`
- Modify: `apps/api/src/app.ts` (daftarkan route di bawah `/api/surat-tugas/:id/laporan`)
- Test: `apps/api/src/laporan.test.ts`

**Interfaces:**
- Consumes: `LaporanIsiSchema`, `type LaporanIsi` dari `@spjan/shared` (Task 1, sudah di-build).
- Produces: `GET /api/surat-tugas/:id/laporan` → `{ isi: LaporanIsi | null, updatedAt: string | null }`; `PUT` body `LaporanIsi` → bentuk sama. 404 bila ST tidak ada, 400 bila isi tidak valid.

- [ ] **Step 1: Tulis tes gagal** `apps/api/src/laporan.test.ts`

```ts
import type { FastifyInstance } from "fastify";
import { buatLaporanAwal } from "@spjan/shared";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { closePool, pool } from "./db.js";
import { bersihkanData, loginCookie, siapkanApp, stResa } from "./test-support/helpers.js";

let app: FastifyInstance;
let cookie: string;
beforeAll(async () => {
  app = await siapkanApp();
  cookie = await loginCookie(app);
});
afterAll(async () => {
  await app.close();
  await closePool();
});
beforeEach(bersihkanData);

const call = (method: "GET" | "POST" | "PUT" | "DELETE", url: string, payload?: unknown) =>
  app.inject({ method, url, headers: { cookie }, ...(payload !== undefined ? { payload: payload as object } : {}) });
const buatSt = async () => (await call("POST", "/api/surat-tugas", stResa)).json().id as number;

describe("laporan perjalanan dinas", () => {
  it("GET sebelum pernah disimpan mengembalikan isi null", async () => {
    const id = await buatSt();
    const res = await call("GET", `/api/surat-tugas/${id}/laporan`);
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ isi: null, updatedAt: null });
  });

  it("PUT menyimpan, GET membacanya, PUT kedua menimpa", async () => {
    const id = await buatSt();
    const awal = buatLaporanAwal();
    const put = await call("PUT", `/api/surat-tugas/${id}/laporan`, awal);
    expect(put.statusCode).toBe(200);
    expect(put.json().isi).toEqual(awal);
    expect(typeof put.json().updatedAt).toBe("string");

    const ubah = { ...awal, bagian: awal.bagian.map((b) => (b.id === "hasil" && b.jenis === "teks" ? { ...b, judul: "Hasil Lapangan" } : b)) };
    await call("PUT", `/api/surat-tugas/${id}/laporan`, ubah);
    const get = await call("GET", `/api/surat-tugas/${id}/laporan`);
    expect(get.json().isi).toEqual(ubah);
    const { rows } = await pool.query("select count(*)::int as n from laporan where st_id = $1", [id]);
    expect(rows[0].n).toBe(1);
  });

  it("menolak isi tidak valid dengan 400", async () => {
    const id = await buatSt();
    const res = await call("PUT", `/api/surat-tugas/${id}/laporan`, { versi: 1, bagian: [] });
    expect(res.statusCode).toBe(400);
  });

  it("404 untuk surat tugas yang tidak ada", async () => {
    expect((await call("GET", "/api/surat-tugas/99999/laporan")).statusCode).toBe(404);
    expect((await call("PUT", "/api/surat-tugas/99999/laporan", buatLaporanAwal())).statusCode).toBe(404);
  });

  it("menghapus ST ikut menghapus laporan", async () => {
    const id = await buatSt();
    await call("PUT", `/api/surat-tugas/${id}/laporan`, buatLaporanAwal());
    await call("DELETE", `/api/surat-tugas/${id}`);
    const { rows } = await pool.query("select count(*)::int as n from laporan");
    expect(rows[0].n).toBe(0);
  });
});
```

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `cd apps/api && npx vitest run src/laporan.test.ts`
Expected: FAIL (route belum ada / tabel `laporan` tidak ada).

- [ ] **Step 3: Implementasi**

`apps/api/migrations/1791126000012_laporan.sql`

```sql
-- Up Migration
create table laporan (
  st_id bigint primary key references surat_tugas (id) on delete cascade,
  isi jsonb not null,
  updated_at timestamptz not null default now()
);

-- Down Migration
drop table if exists laporan;
```

`apps/api/src/repositories/laporan.ts`

```ts
import type { LaporanIsi } from "@spjan/shared";

import type { Db } from "../db.js";

export interface LaporanDto {
  isi: LaporanIsi | null;
  updatedAt: string | null;
}

export async function stAda(db: Db, stId: number): Promise<boolean> {
  const { rows } = await db.query("select 1 from surat_tugas where id = $1", [stId]);
  return rows.length > 0;
}

export async function getLaporan(db: Db, stId: number): Promise<LaporanDto> {
  const { rows } = await db.query<{ isi: LaporanIsi; updated_at: Date }>("select isi, updated_at from laporan where st_id = $1", [stId]);
  const r = rows[0];
  return r ? { isi: r.isi, updatedAt: r.updated_at.toISOString() } : { isi: null, updatedAt: null };
}

export async function simpanLaporan(db: Db, stId: number, isi: LaporanIsi): Promise<LaporanDto> {
  const { rows } = await db.query<{ isi: LaporanIsi; updated_at: Date }>(
    `insert into laporan (st_id, isi) values ($1, $2)
     on conflict (st_id) do update set isi = excluded.isi, updated_at = now()
     returning isi, updated_at`,
    [stId, JSON.stringify(isi)],
  );
  const r = rows[0] as { isi: LaporanIsi; updated_at: Date };
  return { isi: r.isi, updatedAt: r.updated_at.toISOString() };
}
```

`apps/api/src/routes/laporan.ts`

```ts
import type { FastifyInstance } from "fastify";
import { LaporanIsiSchema } from "@spjan/shared";
import { z } from "zod";

import type { Db } from "../db.js";
import { notFound } from "../errors.js";
import { getLaporan, simpanLaporan, stAda } from "../repositories/laporan.js";

const IdSchema = z.object({ id: z.coerce.number().int().positive() });

export async function laporanRoutes(app: FastifyInstance, opts: { db: Db }): Promise<void> {
  app.get("/:id/laporan", async (req) => {
    const { id } = IdSchema.parse(req.params);
    if (!(await stAda(opts.db, id))) throw notFound("Surat tugas");
    return getLaporan(opts.db, id);
  });

  app.put("/:id/laporan", async (req) => {
    const { id } = IdSchema.parse(req.params);
    const isi = LaporanIsiSchema.parse(req.body);
    if (!(await stAda(opts.db, id))) throw notFound("Surat tugas");
    return simpanLaporan(opts.db, id, isi);
  });
}
```

`apps/api/src/app.ts`: tambah `import { laporanRoutes } from "./routes/laporan.js";` dan, tepat setelah baris `await app.register(suratTugasRoutes, ...)`:

```ts
  await app.register(laporanRoutes, { prefix: "/api/surat-tugas", db });
```

(Dua plugin dengan prefix sama aman di Fastify selama rute tidak bentrok.)

- [ ] **Step 4: Jalankan tes sampai lulus**

Run: `cd apps/api && npx vitest run src/laporan.test.ts && npm run lint && npm run test`
Expected: tes laporan lulus; seluruh tes api lulus; lint bersih.

---

### Task 3: Lapisan data web dan editor tab Laporan (`apps/web`)

**Files:**
- Modify: `apps/web/src/lib/api.ts` (tambah `suratTugas.laporan` get/put)
- Modify: `apps/web/src/lib/queries.ts` (`keys.laporan`, `useLaporan`, `useSimpanLaporan`)
- Create: `apps/web/src/components/laporan/blok-editor.tsx`
- Create: `apps/web/src/components/laporan/bagian-card.tsx`
- Create: `apps/web/src/components/laporan/laporan-editor.tsx`
- Modify: `apps/web/src/pages/st-editor.tsx` (tab "Laporan")

**Interfaces:**
- Consumes: `LaporanIsi`, `Bagian`, `Blok`, `ModelLaporan`, `BagianModel`, `buatLaporanAwal`, `susunLaporan` (Task 1); endpoint Task 2.
- Produces: `api.suratTugas.laporan.get(id)` → `{isi: LaporanIsi|null; updatedAt: string|null}`, `.simpan(id, isi)`; `useLaporan(stId: number | undefined)`, `useSimpanLaporan(stId: number)`; `<LaporanEditor stId={number} />`.

- [ ] **Step 1: API client dan hook**

Di `api.ts`, di dalam objek `suratTugas`, setelah `usulanTransport`:

```ts
    laporan: {
      get: (id: number) => request<LaporanDto>('GET', `/api/surat-tugas/${id}/laporan`),
      simpan: (id: number, isi: LaporanIsi) => request<LaporanDto>('PUT', `/api/surat-tugas/${id}/laporan`, isi),
    },
```

dan deklarasi tipe lokal di atas objek `api` (impor `LaporanIsi` dari `@spjan/shared`):

```ts
export interface LaporanDto {
  isi: LaporanIsi | null
  updatedAt: string | null
}
```

Di `queries.ts`: tambah `laporan: (id: number) => ['st', id, 'laporan'] as const,` ke `keys`, impor `LaporanIsi` (type) dan:

```ts
export function useLaporan(id: number | undefined) {
  return useQuery({
    queryKey: keys.laporan(id ?? 0),
    queryFn: () => api.suratTugas.laporan.get(id as number),
    enabled: id !== undefined,
  })
}

export function useSimpanLaporan(id: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (isi: LaporanIsi) => api.suratTugas.laporan.simpan(id, isi),
    onSuccess: (data) => qc.setQueryData(keys.laporan(id), data),
  })
}
```

- [ ] **Step 2: `blok-editor.tsx`**

Props: `{ blok: Blok[]; onUbah: (blok: Blok[]) => void }`. Perilaku:
- Setiap blok satu baris kartu kecil: label jenis ("Paragraf", "Subjudul", "Daftar berbutir", "Daftar bernomor"), tombol naik, turun, hapus (ikon `ChevronUpIcon`, `ChevronDownIcon`, `Trash2Icon`; `aria-label` Indonesia).
- `paragraf`: `Textarea` (`rows={4}`) → `{tipe:'paragraf', teks}`.
- `subjudul`: `Input` tebal → `{tipe:'subjudul', teks}`.
- `daftar`/`nomor`: `Textarea` dengan satu butir per baris (`value = butir.join('\n')`, `onChange` → `split('\n')`), `placeholder="Satu butir per baris"`.
- Tombol tambah di bawah: "+ Paragraf", "+ Subjudul", "+ Daftar", "+ Daftar bernomor" (blok baru: `paragraf ''`, `subjudul ''`, `daftar ['']`, `nomor ['']`).
- Helper dalam berkas: `geser<T>(arr: T[], i: number, delta: -1 | 1): T[]` (kembalikan salinan; tidak berubah bila di luar batas).

- [ ] **Step 3: `bagian-card.tsx`**

Props: `{ bagian: Bagian; model: BagianModel | undefined; sampul: ModelLaporan['sampul']; jumlahFoto: number; bisaNaik: boolean; bisaTurun: boolean; onUbah: (b: Bagian) => void; onNaik: () => void; onTurun: () => void; onHapus: () => void }`. Perilaku per `bagian.jenis`:
- Header kartu: input judul (kecuali `sampul`; untuk `teks` judul boleh kosong dengan placeholder "Tanpa judul (tidak bernomor)"), nomor dari `model?.nomor`, tombol naik/turun/hapus (tidak ditampilkan untuk `sampul`).
- `sampul`: dua input: "Judul (kosongkan untuk otomatis)" dengan `placeholder={sampul.judul}`, dan "Tanggal sampul" `type="date"` (kosong = otomatis). Teks bantu: "Kota dan tanggal tercetak: {sampul.tempatTanggal}".
- `petugas`: tabel dari `model.isi.baris` (No, Nama, Instansi); input Instansi memperbarui array `instansi` dengan `{kunci: norm(nama), instansi}` (ganti entri berkunci sama; hapus entri bila kosong).
- `dasar|maksud|tempat|lama`: bila `bagian.ganti === null`: badge "Otomatis dari data ST", pratinjau teks hasil (`model.isi.blok` sebagai paragraf/daftar baca-saja) dan tombol "Tulis sendiri" (`onUbah({...bagian, ganti: model.isi.blok})`); bila terisi: badge "Ditulis sendiri", `BlokEditor` pada `ganti`, tombol "Kembali ke otomatis" (`ganti: null`).
- `tatawaktu`: sama pola; mode tulis sendiri menampilkan baris editable: `Textarea` kegiatan (satu per baris) + `Input` tanggal + tombol hapus baris, dan tombol "+ Baris"; "Tulis sendiri" menyalin `model.isi.baris` tanpa `no`.
- `dokumentasi`: teks "{jumlahFoto} foto dari kartu Foto Dokumentasi (tab Bukti & usulan)."
- `teks`: `BlokEditor` pada `bagian.blok`.

- [ ] **Step 4: `laporan-editor.tsx`**

`export function LaporanEditor({ stId }: { stId: number })`:
- Data: `useSuratTugas(stId)`, `usePengaturan()`, `useLaporan(stId)`, `useDaftarBerkas(stId)`, `const simpan = useSimpanLaporan(stId)`.
- State turunan tanpa efek-setState: `const [draf, setDraf] = useState<LaporanIsi | null>(null)`, `const [tersimpan, setTersimpan] = useState<LaporanIsi | null>(null)`; `const isi = draf ?? laporan.data?.isi ?? buatLaporanAwal()` (di-`useMemo` untuk kasus awal). `kotor = draf !== null && draf !== tersimpan`.
- Autosimpan: `useEffect(() => { if (!kotor || !draf) return; const t = window.setTimeout(() => simpan.mutate(draf, { onSuccess: () => setTersimpan(draf) }), 1500); return () => window.clearTimeout(t) }, [draf, kotor, simpan.mutate])`.
- Peringatan keluar: `useEffect` memasang `beforeunload` (`e.preventDefault()`) selama `kotor || simpan.isPending`.
- Foto: dari `useDaftarBerkas`, `b.jenis === 'dokumentasi'` → `FotoDokumentasi` `{id, namaAsli, keterangan: b.keterangan || b.namaAsli, mime, src: \`/api/berkas/${b.id}/isi\`, createdAt}`.
- Model: `useMemo(() => st.data && pengaturan.data ? susunLaporan(st.data, pengaturan.data, isi, foto) : null, [...])`.
- Render: header kartu dengan indikator ("Menyimpan..." bila `kotor || simpan.isPending`; "Gagal menyimpan, coba lagi" bila `simpan.isError`; selain itu "Tersimpan"), tombol "Pratinjau/cetak" berupa `Link` ke `/st/${stId}/dokumen`; catatan "Bagian otomatis mengikuti surat tugas yang tersimpan."; daftar `BagianCard` per bagian di `isi.bagian` (cari model per `id`); pembaruan lewat `ubahBagian(index, b)`, `geserBagian(index, delta)` (sampul tak bergeser; tidak boleh melewati posisi 0), `hapusBagian(index)`.
- Menu tambah bagian: `Select` dengan opsi Teks bebas, Tata waktu, Petugas, Dokumentasi + tombol "Tambah bagian". Bagian baru: `id` = `crypto.randomUUID().slice(0, 8)`; teks → `{jenis:'teks', judul:'Bagian baru', blok:[{tipe:'paragraf', teks:''}]}`; tatawaktu → `ganti:null`, judul "Tata Waktu Pelaksanaan"; petugas → `instansi:[]`; dokumentasi → judul "Dokumentasi Kegiatan".
- Batas: tombol tambah nonaktif bila `isi.bagian.length >= 40`.

- [ ] **Step 5: Tab di `st-editor.tsx`**

`type TabKunci = 'data' | 'pelaksana' | 'bukti' | 'laporan'`; di `itemTab` tambah (hanya bila `id !== null`) `{ kunci: 'laporan' as const, label: 'Laporan' }`; setelah `TabPanel` bukti tambah:

```tsx
{id !== null ? (
  <TabPanel idAwal="st" kunci="laporan" aktif={tab === 'laporan'}>
    <LaporanEditor stId={id} />
  </TabPanel>
) : null}
```

- [ ] **Step 6: Verifikasi**

Run: `cd apps/web && npx tsc -b && npx eslint src && npm run build`
Expected: tanpa galat.

---

### Task 4: PDF laporan, jenis cetak, dan data contoh (`apps/web`)

**Files:**
- Create: `apps/web/src/pdf/laporan.tsx`
- Modify: `apps/web/src/pdf/spj-document.tsx` (jenis `laporan`, prop `laporan?: ModelLaporan`)
- Modify: `apps/web/src/pages/dokumen.tsx` (pilihan "Laporan Perjalanan Dinas")
- Modify: `apps/web/scripts/sample-data.ts` (`laporanContoh`), `apps/web/scripts/render-sample.tsx` (tulis `laporan.pdf`)

**Interfaces:**
- Consumes: `ModelLaporan`, `BagianModel`, `Blok` (Task 1); `PDF_FONT` (`./fonts`), `LOGO_KEMENHUT_BASE64` (`./logo`).
- Produces: `LaporanPages({ m }: { m: ModelLaporan })` (fragmen berisi `<Page>`), `JenisDokumen` ditambah `'laporan'`.

- [ ] **Step 1: `pdf/laporan.tsx`**

Ekspor `LaporanPages`. Aturan tata letak (A4 potret, margin 56/48, Liberation Sans 11, `lineHeight 1.4`, teks rata kiri-kanan):
- Halaman sampul sendiri: kop dua baris tebal rata tengah (konstanta Global Constraints), logo `Image` lebar 110, "LAPORAN" (tebal 16), `m.sampul.judul` (tebal 13, rata tengah), "Oleh:" lalu satu nama per baris, `m.sampul.tempatTanggal` tebal di dasar halaman (`position: 'absolute', bottom: 56`).
- Halaman isi: satu `<Page wrap>` untuk semua bagian. Nomor halaman `fixed` di kanan bawah dengan `render={({ pageNumber, totalPages }) => ...}`.
- Judul bagian: `<Text minPresenceAhead={60}>` tebal `"{nomor}. {judul}"` (tanpa nomor bila `nomor === null`; tanpa elemen bila `judul` kosong).
- Blok: `subjudul` tebal dengan `minPresenceAhead={40}`; `paragraf` (lewati teks kosong); `daftar` baris `•` (lewati butir kosong), `nomor` baris `1.`; setiap butir `wrap={false}`.
- Tabel petugas: kolom No 30 / Nama flex / Instansi 150, garis `0.75pt solid #000`, baris `wrap={false}`, header tebal. Tabel tata waktu: No 30 / Kegiatan flex (banyak baris kegiatan bila >1 tampil sebagai butir) / Tanggal 110.
- Dokumentasi: kisi dua kolom (`flexDirection: 'row', flexWrap: 'wrap'`), tiap item lebar 48%, `wrap={false}`, `Image` tinggi 150 `objectFit: 'contain'`, keterangan rata tengah di bawah. Tanpa foto: teks miring "Belum ada foto dokumentasi."

- [ ] **Step 2: `spj-document.tsx` dan `dokumen.tsx`**

`JenisDokumen` tambah `'laporan'`; `SpjDocument` menerima `laporan?: ModelLaporan` dan menambah `{jenis === 'laporan' && laporan ? <LaporanPages m={laporan} /> : null}`; `title` dokumen jadi `jenis === 'laporan' ? \`Laporan ${d.st.nomor}\` : \`SPJ ${d.st.nomor}\``. Jenis `semua` tidak berubah.

Di `dokumen.tsx`: impor `useLaporan`, `buatLaporanAwal`, `susunLaporan`; `const laporanQuery = useLaporan(stIdValid)`; `const modelLaporan = useMemo(() => (d ? susunLaporan(d.st, d.pengaturan, laporanQuery.data?.isi ?? buatLaporanAwal(), fotoDokumentasi) : null), [d, laporanQuery.data, fotoDokumentasi])` (diletakkan bersama hook lain sebelum early return); pada `pilihan` tambah sebelum `semua`: `{ kunci: 'laporan', label: 'Laporan Perjalanan Dinas', jenis: 'laporan' }`; teruskan `laporan={modelLaporan ?? undefined}` ke `SpjDocument`; nama unduhan memakai `Laporan-` bila `terpilih.jenis === 'laporan'`, selain itu `SPJ-`.

- [ ] **Step 3: Data contoh dan skrip**

`sample-data.ts`: ekspor `laporanContoh(): LaporanIsi` yang mengambil `buatLaporanAwal()` lalu mengisi bagian `hasil` (paragraf di bawah tiap subjudul dengan 2-3 kalimat panjang meniru contoh Muara Merang), `simpulan` (dua paragraf + enam butir `nomor`), instansi petugas (`"Direktorat PPS"`, `"Balai PS Palembang"` bergantian), dan satu bagian `teks` tambahan "Catatan Tambahan" dengan daftar berbutir. `render-sample.tsx`: tambahkan

```tsx
const m = susunLaporan(d.st, d.pengaturan, laporanContoh(), fotoContoh)
await renderToFile(<SpjDocument d={d} jenis="laporan" laporan={m} />, path.join(keluar, 'laporan.pdf'))
```

dengan `fotoContoh` tiga `FotoDokumentasi` yang `src`-nya `LOGO_KEMENHUT_BASE64` dan keterangan berbeda.

- [ ] **Step 4: Verifikasi**

Run: `cd apps/web && npx tsc -b && npx eslint src scripts && npm run build && npm run pdf:contoh -- /tmp/spjan-pdf && pdftoppm -r 60 -png /tmp/spjan-pdf/laporan.pdf /tmp/spjan-pdf/lap`
Expected: tanpa galat; lihat halaman PNG: sampul tidak terpotong, judul bagian tidak sendirian di dasar halaman, baris tabel tidak terbelah, foto dua kolom rapi. Perbaiki tata letak bila ada cacat lalu ulangi.

---

### Task 5: Verifikasi menyeluruh

- [ ] **Step 1:** Dari root: `npm run build && npm run test && npm run lint`. Expected: semuanya lulus.
- [ ] **Step 2:** Jalankan `npm run db:up`, `npm run dev:api`, `npm run dev:web`; di peramban buka ST, tab Laporan: cek bagian otomatis terisi, "Tulis sendiri"/"Kembali ke otomatis", isi instansi, ketik narasi, muat ulang (data tetap), buka Dokumen → Laporan Perjalanan Dinas → PDF tampil dan terunduh.
- [ ] **Step 3:** Laporkan hasil ke pengguna beserta cacat yang ditemukan. Commit/push hanya bila pengguna menyetujui.
