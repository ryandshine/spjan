import { describe, expect, it } from "vitest";
import { dokDariBlok, dokKeTeks, dokKosong, dokPunyaIsi, DokSchema } from "./laporan-dokumen.js";
import { buatLaporanAwal, LaporanIsiSchema, naikkanLaporan, type LaporanIsi } from "./laporan.js";
import { ringkasStatusLaporan, susunLaporan } from "./laporan-susun.js";
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
const dokDari = (m: ReturnType<typeof susunLaporan>, id: string) => {
  const isi = m.bagian.find((b) => b.id === id)!.isi;
  return isi.jenis === "dokumen" ? isi.dok : null;
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
    const panjang: LaporanIsi = { versi: 2, bagian: [{ id: "x", jenis: "teks", judul: "A", isi: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "a".repeat(10_001) }] }] } }] };
    expect(LaporanIsiSchema.safeParse(panjang).success).toBe(false);
  });
});

describe("susunLaporan", () => {
  it("menurunkan bagian otomatis dari data ST", () => {
    const m = susunLaporan(stUji(), pengaturan, buatLaporanAwal(), []);
    expect(m.sampul.judul).toBe("PERJALANAN DINAS DALAM RANGKA PENGAWASAN DI DESA MUARA MERANG");
    expect(m.sampul.nama).toEqual(["Gunadi Firdaus", "Aisyah"]);
    expect(m.sampul.tempatTanggal).toBe("JAKARTA, 21 SEPTEMBER 2026");
    expect(dokKeTeks(dokDari(m, "dasar")!)).toBe(
      "Surat Tugas Direktur Pengendalian Perhutanan Sosial nomor: ST.228/PPS/PEMPS/PSL.04.02/B/09/2026 tanggal 14 September 2026.",
    );
    expect(dokKeTeks(dokDari(m, "maksud")!)).toBe("Melakukan perjalanan dinas dalam rangka Pengawasan di Desa Muara Merang.");
    expect(dokKeTeks(dokDari(m, "lama")!)).toBe("Perjalanan dinas selama 3 (tiga) hari, pada tanggal 17 s.d. 19 September 2026.");
    expect(dokDari(m, "tempat")).toEqual(
      dokDariBlok([
        { tipe: "paragraf", teks: "Perjalanan dinas dilaksanakan di tempat berikut:" },
        { tipe: "daftar", butir: ["Musi Banyuasin, Provinsi Sumatera Selatan"] },
      ]),
    );
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
      bagian: awal.bagian.map((b) => (b.id === "dasar" && b.jenis === "dasar" ? { ...b, ganti: dokDariBlok([{ tipe: "paragraf", teks: "Tulis sendiri" }]) } : b)),
    };
    const m = susunLaporan(stUji({ nomor: "ST.BARU" }), pengaturan, laporan, []);
    expect(dokKeTeks(dokDari(m, "dasar")!)).toBe("Tulis sendiri");
    expect(m.bagian.find((b) => b.id === "dasar")!.otomatis).toBe(false);
    expect(dokKeTeks(dokDari(m, "maksud")!)).toContain("Pengawasan");
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

  it("instansi diambil dari pelaksana; isian manual di laporan menimpanya", () => {
    const st = stUji();
    const denganInstansi = stUji({ pelaksana: st.pelaksana.map((p) => ({ ...p, instansi: "Direktorat Pengendalian Perhutanan Sosial" })) });
    const baris = (m: ReturnType<typeof susunLaporan>) => {
      const isi = m.bagian.find((b) => b.jenis === "petugas")!.isi;
      return isi.jenis === "petugas" ? isi.baris.map((r) => r.instansi) : [];
    };
    expect(baris(susunLaporan(denganInstansi, pengaturan, buatLaporanAwal(), []))).toEqual([
      "Direktorat Pengendalian Perhutanan Sosial",
      "Direktorat Pengendalian Perhutanan Sosial",
    ]);
    const awal = buatLaporanAwal();
    const manual: LaporanIsi = {
      ...awal,
      bagian: awal.bagian.map((b) => (b.jenis === "petugas" ? { ...b, instansi: [{ kunci: "AISYAH", instansi: "Setditjen PS" }] } : b)),
    };
    expect(baris(susunLaporan(denganInstansi, pengaturan, manual, []))).toEqual(["Direktorat Pengendalian Perhutanan Sosial", "Setditjen PS"]);
  });

  it("tanpa etape: bagian turunan kosong dan judul sampul bawaan", () => {
    const st = stUji();
    const kosong = stUji({ pelaksana: st.pelaksana.map((p) => ({ ...p, etape: [] })) });
    const m = susunLaporan(kosong, pengaturan, buatLaporanAwal(), []);
    expect(m.sampul.judul).toBe("PERJALANAN DINAS");
    expect(dokPunyaIsi(dokDari(m, "lama")!)).toBe(false);
    expect(dokPunyaIsi(dokDari(m, "maksud")!)).toBe(false);
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
    expect(dokKeTeks(dokDari(m, "lama")!)).toBe("Perjalanan dinas selama 4 (empat) hari, pada tanggal 17 s.d. 20 September 2026.");
  });
});

describe("dokumen teks kaya", () => {
  const dokKaya = {
    type: "doc",
    content: [
      { type: "heading", attrs: { level: 3, textAlign: "center" }, content: [{ type: "text", text: "Judul" }] },
      {
        type: "paragraph",
        attrs: { textAlign: "justify" },
        content: [
          { type: "text", text: "tebal", marks: [{ type: "bold" }, { type: "underline" }] },
          { type: "text", text: " tautan", marks: [{ type: "link", attrs: { href: "https://contoh.id", target: "_blank", rel: "noopener", class: null } }] },
          { type: "hardBreak" },
        ],
      },
      { type: "orderedList", attrs: { start: 1 }, content: [{ type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "satu" }] }] }] },
      {
        type: "table",
        content: [{ type: "tableRow", content: [{ type: "tableHeader", attrs: { colspan: 1, rowspan: 1, colwidth: null }, content: [{ type: "paragraph" }] }] }],
      },
      { type: "image", attrs: { src: "/api/berkas/5/isi", alt: null, title: null, berkasId: 5 } },
    ],
  };

  it("menerima dokumen TipTap yang memakai semua fitur", () => {
    expect(DokSchema.safeParse(dokKaya).success).toBe(true);
    expect(dokPunyaIsi(dokKaya as never)).toBe(true);
    expect(dokPunyaIsi(dokKosong())).toBe(false);
  });

  it("menolak tautan berbahaya, node asing, gambar tanpa berkasId, teks kosong, dan sarang terlalu dalam", () => {
    const dengan = (node: unknown) => DokSchema.safeParse({ type: "doc", content: [node] }).success;
    expect(dengan({ type: "paragraph", content: [{ type: "text", text: "x", marks: [{ type: "link", attrs: { href: "javascript:alert(1)" } }] }] })).toBe(false);
    expect(dengan({ type: "script" })).toBe(false);
    expect(dengan({ type: "image", attrs: { src: "http://luar/x.png" } })).toBe(false);
    expect(dengan({ type: "paragraph", content: [{ type: "text", text: "" }] })).toBe(false);
    let dalam: unknown = { type: "paragraph" };
    for (let i = 0; i < 15; i++) dalam = { type: "listItem", content: [dalam] };
    expect(dengan(dalam)).toBe(false);
  });

  it("naikkanLaporan mengonversi versi 1 dan menolak bentuk tak dikenal", () => {
    const v1 = {
      versi: 1,
      bagian: [
        { id: "sampul", jenis: "sampul", judul: null, tanggal: null },
        { id: "dasar", jenis: "dasar", judul: "Dasar", ganti: [{ tipe: "paragraf", teks: "Teks lama" }] },
        { id: "hasil", jenis: "teks", judul: "Hasil", blok: [{ tipe: "subjudul", teks: "Sub" }, { tipe: "nomor", butir: ["a", "b"] }] },
      ],
    };
    const baru = naikkanLaporan(v1)!;
    expect(baru.versi).toBe(2);
    const dasar = baru.bagian.find((b) => b.id === "dasar")!;
    expect(dasar.jenis === "dasar" && dasar.ganti && dokKeTeks(dasar.ganti)).toBe("Teks lama");
    const hasil = baru.bagian.find((b) => b.id === "hasil")!;
    expect(hasil.jenis === "teks" && dokKeTeks(hasil.isi)).toBe("Sub\na\nb");
    expect(LaporanIsiSchema.safeParse(baru).success).toBe(true);
    expect(naikkanLaporan(baru)).toEqual(baru);
    expect(naikkanLaporan({ versi: 9 })).toBeNull();
    expect(naikkanLaporan(null)).toBeNull();
  });
});

describe("ringkasStatusLaporan", () => {
  const ringkas = (st = stUji(), laporan = buatLaporanAwal()) => ringkasStatusLaporan(susunLaporan(st, pengaturan, laporan, []), laporan);
  const status = (r: ReturnType<typeof ringkas>, id: string) => r.bagian.find((b) => b.id === id)!;

  it("laporan baru: narasi kosong, instansi belum lengkap, bagian otomatis siap", () => {
    const r = ringkas();
    expect(status(r, "hasil")).toMatchObject({ kelompok: "tulis", status: "kosong", wajib: true, siap: false });
    expect(status(r, "simpulan")).toMatchObject({ status: "kosong", wajib: true });
    expect(status(r, "penutup")).toMatchObject({ kelompok: "tulis", wajib: false, siap: false });
    expect(status(r, "petugas")).toMatchObject({ kelompok: "otomatis", status: "perlu", detail: "0/2", wajib: true });
    expect(status(r, "dasar")).toMatchObject({ kelompok: "otomatis", status: "otomatis" });
    expect(status(r, "sampul").status).toBe("otomatis");
    expect(status(r, "dokumentasi")).toMatchObject({ kelompok: "lampiran", status: "kosong", detail: "0 foto", wajib: false });
    expect(r.wajibTotal).toBe(3);
    expect(r.wajibSiap).toBe(0);
    expect(r.belumSiap).toEqual(["Petugas yang Melaksanakan Perjalanan Dinas", "Hasil Kegiatan", "Kesimpulan dan Rekomendasi Tindak Lanjut"]);
  });

  it("kemajuan naik saat narasi terisi dan instansi lengkap; status sendiri dan tanpa data", () => {
    const awal = buatLaporanAwal();
    const isi = dokDariBlok([{ tipe: "paragraf", teks: "Temuan lapangan." }]);
    const laporan: LaporanIsi = {
      ...awal,
      bagian: awal.bagian.map((b) => {
        if (b.id === "hasil" && b.jenis === "teks") return { ...b, isi };
        if (b.jenis === "dasar") return { ...b, ganti: dokDariBlok([{ tipe: "paragraf", teks: "Sendiri" }]) };
        if (b.jenis === "sampul") return { ...b, judul: "Judul saya" };
        return b;
      }),
    };
    const st = stUji();
    const denganInstansi = stUji({ pelaksana: st.pelaksana.map((p) => ({ ...p, instansi: "Direktorat PPS" })) });
    const r = ringkas(denganInstansi, laporan);
    expect(status(r, "hasil")).toMatchObject({ status: "terisi", siap: true });
    expect(status(r, "petugas")).toMatchObject({ status: "lengkap", detail: "2/2", siap: true });
    expect(status(r, "dasar").status).toBe("sendiri");
    expect(status(r, "sampul").status).toBe("sendiri");
    expect(r.wajibSiap).toBe(2);
    expect(r.belumSiap).toEqual(["Kesimpulan dan Rekomendasi Tindak Lanjut"]);

    const tanpaEtape = ringkas(stUji({ pelaksana: st.pelaksana.map((p) => ({ ...p, etape: [] })) }));
    expect(status(tanpaEtape, "lama").status).toBe("tanpa-data");
    expect(status(tanpaEtape, "tatawaktu").status).toBe("tanpa-data");
  });
});
