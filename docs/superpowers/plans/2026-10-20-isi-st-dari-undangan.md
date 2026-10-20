# Isi Naskah ST dari Surat Undangan Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pengguna mengunggah surat undangan (PDF/foto) di editor "Buat Surat Tugas", AI mengusulkan isian naskah, pengguna memeriksa lalu menerapkannya.

**Architecture:** Endpoint sinkron `POST /api/naskah-st/ekstrak-undangan` (multipart, berkas tidak disimpan) memakai `bacaIsi` + klien AI yang ada, mengembalikan `{ model, hasil }`. Logika usulan/penerapan adalah fungsi murni di `@spjan/shared`; web menampilkan panel usulan dengan kotak centang per field.

**Tech Stack:** Fastify 5 + `@fastify/multipart`, zod, vitest (Postgres sungguhan), React 19 + TanStack Query, Tailwind 4.

**Spec:** `docs/superpowers/specs/2026-10-20-isi-st-dari-undangan-design.md`

## Global Constraints

- TypeScript strict dengan `noUncheckedIndexedAccess`; impor relatif memakai akhiran `.js` (di `apps/web` pakai alias `@/` seperti file sekitarnya).
- Fungsi di `packages/shared` murni: tanpa DB/jaringan/`Date` implisit (hari ini dikirim sebagai argumen).
- Teks UI dan pesan galat berbahasa Indonesia.
- Setelah mengubah `packages/shared/src`, jalankan `npm run build` di `packages/shared` sebelum menguji workspace lain.
- Tidak ada tes frontend (konvensi proyek): web diverifikasi lewat `tsc`, `eslint`, `npm run build`. Jangan otomasi Chrome.
- **Jangan commit/push tanpa persetujuan eksplisit pengguna di tiap gerbang** (CLAUDE.md). Langkah "Gerbang commit" di bawah berarti: berhenti dan tanya pengguna; bila disetujui pakai Conventional Commits dengan atribusi dari system-reminder.
- Berkas undangan tidak pernah ditulis ke disk/DB. Audit tidak boleh memuat isi berkas.
- Rute baru tidak menyentuh data ST tersimpan, jadi tidak memanggil `wajibBolehLihatSt`; cukup pengguna login (hook auth global).

---

## Struktur File

| File | Tanggung jawab |
|---|---|
| `packages/shared/src/undangan-ekstraksi.ts` (baru) | Skema hasil AI, `usulanDariUndangan`, `terapkanUsulan` |
| `packages/shared/src/undangan-ekstraksi.test.ts` (baru) | Tes fungsi murni |
| `packages/shared/src/index.ts` | Ekspor modul baru |
| `apps/api/src/ekstraksi/undangan.ts` (baru) | `ekstrakUndangan(klien, konf, isi)` |
| `apps/api/src/ekstraksi/undangan.test.ts` (baru) | Tes ekstraktor dengan `klienPalsu` |
| `apps/api/src/routes/naskah-st.ts` | Rute `POST /ekstrak-undangan` |
| `apps/api/src/app.ts` | Teruskan `klien` ke `naskahStRoutes` |
| `apps/api/src/naskah-st.test.ts` | Tes rute (app dibuat dengan `klienPalsu`) |
| `apps/web/src/lib/api.ts`, `queries.ts` | `api.naskahSt.ekstrakUndangan`, `useEkstrakUndangan` |
| `apps/web/src/components/st/isi-dari-undangan.tsx` (baru) | Area unggah + panel usulan |
| `apps/web/src/pages/st-naskah-editor.tsx` | Pasang komponen, terapkan patch |
| `docs/STATUS.md` | Catatan fitur |

---

### Task 1: Skema dan fungsi murni di `@spjan/shared`

**Files:**
- Create: `packages/shared/src/undangan-ekstraksi.ts`
- Create: `packages/shared/src/undangan-ekstraksi.test.ts`
- Modify: `packages/shared/src/index.ts` (tambah `export * from "./undangan-ekstraksi.js";`)

**Interfaces:**
- Produces:
  - `HasilEkstraksiUndanganSchema`, `type HasilEkstraksiUndangan`
  - `type FieldUsulanUndangan = "maksudTugas" | "lokasiTugas" | "tanggalMulai" | "tanggalSelesai" | "dasarSpesifik"`
  - `interface UsulanIsian { field: FieldUsulanUndangan; label: string; nilaiLama: string; nilaiBaru: string; bawaanAtauKosong: boolean }`
  - `usulanDariUndangan(naskah: BagianNaskahUsulan, hasil: HasilEkstraksiUndangan, hariIni: string): UsulanIsian[]`
  - `terapkanUsulan(naskah: BagianNaskahUsulan, usulan: UsulanIsian[]): Partial<Pick<NaskahStPayload, FieldUsulanUndangan | "lamaHari">>`
  - `type BagianNaskahUsulan = Pick<NaskahStPayload, "maksudTugas" | "lokasiTugas" | "tanggalMulai" | "tanggalSelesai" | "dasarSpesifik">`

- [ ] **Step 1: Tulis tes yang gagal**

`packages/shared/src/undangan-ekstraksi.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { HasilEkstraksiUndanganSchema, terapkanUsulan, usulanDariUndangan, type HasilEkstraksiUndangan } from "./undangan-ekstraksi.js";

const HARI_INI = "2026-10-20";
const kosong = { maksudTugas: "", lokasiTugas: "", tanggalMulai: HARI_INI, tanggalSelesai: HARI_INI, dasarSpesifik: "" };
const hasil = (p: Partial<HasilEkstraksiUndangan> = {}): HasilEkstraksiUndangan => ({
  maksudTugas: null,
  lokasiTugas: null,
  tanggalMulai: null,
  tanggalSelesai: null,
  nomorUndangan: null,
  tanggalUndangan: null,
  penyelenggara: null,
  ...p,
});
const cari = (u: ReturnType<typeof usulanDariUndangan>, f: string) => u.find((x) => x.field === f);

describe("HasilEkstraksiUndanganSchema", () => {
  it("menerima semua field null dan menolak tanggal salah format", () => {
    expect(HasilEkstraksiUndanganSchema.parse(hasil())).toEqual(hasil());
    expect(() => HasilEkstraksiUndanganSchema.parse(hasil({ tanggalMulai: "20/10/2026" }))).toThrow();
  });
});

describe("usulanDariUndangan", () => {
  it("tanpa data tidak mengusulkan apa pun", () => {
    expect(usulanDariUndangan(kosong, hasil(), HARI_INI)).toEqual([]);
  });

  it("mengusulkan maksud, lokasi, tanggal, dan dasar spesifik", () => {
    const u = usulanDariUndangan(
      kosong,
      hasil({
        maksudTugas: "Rapat Koordinasi",
        lokasiTugas: "Bandung",
        tanggalMulai: "2026-11-02",
        tanggalSelesai: "2026-11-04",
        nomorUndangan: "123/ABC/2026",
        tanggalUndangan: "2026-10-15",
        penyelenggara: "Dinas Kehutanan Jawa Barat",
      }),
      HARI_INI,
    );
    expect(cari(u, "maksudTugas")).toMatchObject({ nilaiLama: "", nilaiBaru: "Rapat Koordinasi", bawaanAtauKosong: true });
    expect(cari(u, "tanggalMulai")).toMatchObject({ nilaiBaru: "2026-11-02", bawaanAtauKosong: true });
    expect(cari(u, "dasarSpesifik")?.nilaiBaru).toBe(
      "Undangan Dinas Kehutanan Jawa Barat Nomor 123/ABC/2026 tanggal 15 Oktober 2026",
    );
  });

  it("field yang sudah diisi pengguna ditandai bukan bawaan, nilai sama dibuang", () => {
    const naskah = { ...kosong, maksudTugas: "Sudah ada", lokasiTugas: "Bandung" };
    const u = usulanDariUndangan(naskah, hasil({ maksudTugas: "Baru", lokasiTugas: "Bandung" }), HARI_INI);
    expect(cari(u, "maksudTugas")).toMatchObject({ nilaiLama: "Sudah ada", bawaanAtauKosong: false });
    expect(cari(u, "lokasiTugas")).toBeUndefined();
  });

  it("string kosong dari AI diperlakukan sebagai tidak ada", () => {
    expect(usulanDariUndangan(kosong, hasil({ maksudTugas: "   " }), HARI_INI)).toEqual([]);
  });

  it("hanya tanggal mulai: tanggal selesai ikut sama (satu hari)", () => {
    const u = usulanDariUndangan(kosong, hasil({ tanggalMulai: "2026-11-02" }), HARI_INI);
    expect(cari(u, "tanggalMulai")?.nilaiBaru).toBe("2026-11-02");
    expect(cari(u, "tanggalSelesai")?.nilaiBaru).toBe("2026-11-02");
  });

  it("tanggal selesai sebelum mulai: pasangan tanggal dibuang", () => {
    const u = usulanDariUndangan(kosong, hasil({ tanggalMulai: "2026-11-05", tanggalSelesai: "2026-11-02" }), HARI_INI);
    expect(cari(u, "tanggalMulai")).toBeUndefined();
    expect(cari(u, "tanggalSelesai")).toBeUndefined();
  });

  it("dasar spesifik dilewati bila nomor, tanggal, dan penyelenggara semuanya kosong", () => {
    const u = usulanDariUndangan(kosong, hasil({ maksudTugas: "X" }), HARI_INI);
    expect(cari(u, "dasarSpesifik")).toBeUndefined();
  });

  it("dasar spesifik hanya memuat bagian yang ada", () => {
    const u = usulanDariUndangan(kosong, hasil({ nomorUndangan: "9/X/2026" }), HARI_INI);
    expect(cari(u, "dasarSpesifik")?.nilaiBaru).toBe("Undangan Nomor 9/X/2026");
  });
});

describe("terapkanUsulan", () => {
  it("menulis field terpilih dan menghitung ulang lamaHari", () => {
    const u = usulanDariUndangan(kosong, hasil({ maksudTugas: "Rakor", tanggalMulai: "2026-11-02", tanggalSelesai: "2026-11-04" }), HARI_INI);
    expect(terapkanUsulan(kosong, u)).toEqual({
      maksudTugas: "Rakor",
      tanggalMulai: "2026-11-02",
      tanggalSelesai: "2026-11-04",
      lamaHari: 3,
    });
  });

  it("tanpa usulan terpilih menghasilkan patch kosong", () => {
    expect(terapkanUsulan(kosong, [])).toEqual({});
  });

  it("hanya satu tanggal terpilih: lamaHari memakai tanggal lain dari naskah", () => {
    const naskah = { ...kosong, tanggalMulai: "2026-11-02", tanggalSelesai: "2026-11-04" };
    const u = usulanDariUndangan(naskah, hasil({ tanggalMulai: "2026-11-03", tanggalSelesai: "2026-11-04" }), HARI_INI);
    const hanyaMulai = u.filter((x) => x.field === "tanggalMulai");
    expect(terapkanUsulan(naskah, hanyaMulai)).toEqual({ tanggalMulai: "2026-11-03", lamaHari: 2 });
  });
});
```

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `cd packages/shared && npx vitest run src/undangan-ekstraksi.test.ts`
Expected: FAIL (modul `./undangan-ekstraksi.js` tidak ada).

- [ ] **Step 3: Implementasi minimal**

`packages/shared/src/undangan-ekstraksi.ts`:

```ts
import { z } from "zod";

import { hitungLamaHariSt } from "./naskah-st.js";
import type { NaskahStPayload } from "./schemas.js";
import { parseTanggal, tanggalIndonesia } from "./teks.js";

const tanggalIso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format YYYY-MM-DD");
const teksNull = (maks: number) => z.string().trim().max(maks).nullable();

export const HasilEkstraksiUndanganSchema = z.object({
  maksudTugas: teksNull(2000),
  lokasiTugas: teksNull(500),
  tanggalMulai: tanggalIso.nullable(),
  tanggalSelesai: tanggalIso.nullable(),
  nomorUndangan: teksNull(200),
  tanggalUndangan: tanggalIso.nullable(),
  penyelenggara: teksNull(300),
});
export type HasilEkstraksiUndangan = z.infer<typeof HasilEkstraksiUndanganSchema>;

export type BagianNaskahUsulan = Pick<
  NaskahStPayload,
  "maksudTugas" | "lokasiTugas" | "tanggalMulai" | "tanggalSelesai" | "dasarSpesifik"
>;
export type FieldUsulanUndangan = keyof BagianNaskahUsulan;

export interface UsulanIsian {
  field: FieldUsulanUndangan;
  label: string;
  nilaiLama: string;
  nilaiBaru: string;
  /** Nilai lama kosong atau masih bawaan: aman dicentang otomatis. */
  bawaanAtauKosong: boolean;
}

const LABEL: Record<FieldUsulanUndangan, string> = {
  maksudTugas: "Maksud penugasan",
  lokasiTugas: "Lokasi penugasan",
  tanggalMulai: "Tanggal mulai",
  tanggalSelesai: "Tanggal selesai",
  dasarSpesifik: "Dasar spesifik (undangan)",
};

const bersih = (s: string | null): string => (s ?? "").trim();

function rangkaiDasar(h: HasilEkstraksiUndangan): string {
  const penyelenggara = bersih(h.penyelenggara);
  const nomor = bersih(h.nomorUndangan);
  const tanggal = tanggalIndonesia(h.tanggalUndangan);
  if (!penyelenggara && !nomor && !tanggal) return "";
  return `Undangan${penyelenggara ? ` ${penyelenggara}` : ""}${nomor ? ` Nomor ${nomor}` : ""}${tanggal ? ` tanggal ${tanggal}` : ""}`;
}

export function usulanDariUndangan(
  naskah: BagianNaskahUsulan,
  hasil: HasilEkstraksiUndangan,
  hariIni: string,
): UsulanIsian[] {
  const usulan: UsulanIsian[] = [];
  const tambah = (field: FieldUsulanUndangan, nilaiBaru: string, bawaan: (lama: string) => boolean) => {
    const nilaiLama = naskah[field];
    if (!nilaiBaru || nilaiBaru === nilaiLama) return;
    usulan.push({ field, label: LABEL[field], nilaiLama, nilaiBaru, bawaanAtauKosong: bawaan(nilaiLama) });
  };
  const kosong = (lama: string) => lama.trim() === "";

  tambah("maksudTugas", bersih(hasil.maksudTugas), kosong);
  tambah("lokasiTugas", bersih(hasil.lokasiTugas), kosong);

  // Satu tanggal saja berarti kegiatan satu hari. Pasangan tidak valid atau terbalik dibuang.
  const mulai = hasil.tanggalMulai ?? hasil.tanggalSelesai;
  const selesai = hasil.tanggalSelesai ?? hasil.tanggalMulai;
  if (mulai && selesai && parseTanggal(mulai) && parseTanggal(selesai) && mulai <= selesai) {
    const bawaanTanggal = (lama: string) => lama === hariIni;
    tambah("tanggalMulai", mulai, bawaanTanggal);
    tambah("tanggalSelesai", selesai, bawaanTanggal);
  }

  tambah("dasarSpesifik", rangkaiDasar(hasil), kosong);
  return usulan;
}

export function terapkanUsulan(
  naskah: BagianNaskahUsulan,
  usulan: UsulanIsian[],
): Partial<BagianNaskahUsulan & Pick<NaskahStPayload, "lamaHari">> {
  const patch: Partial<BagianNaskahUsulan & Pick<NaskahStPayload, "lamaHari">> = {};
  for (const u of usulan) patch[u.field] = u.nilaiBaru;
  if (patch.tanggalMulai !== undefined || patch.tanggalSelesai !== undefined) {
    patch.lamaHari = hitungLamaHariSt(patch.tanggalMulai ?? naskah.tanggalMulai, patch.tanggalSelesai ?? naskah.tanggalSelesai);
  }
  return patch;
}
```

Tambahkan di `packages/shared/src/index.ts` setelah baris `naskah-st.js`: `export * from "./undangan-ekstraksi.js";`

- [ ] **Step 4: Jalankan, pastikan lulus, lalu lint dan build**

Run: `cd packages/shared && npx vitest run src/undangan-ekstraksi.test.ts && npm run lint && npm run build`
Expected: semua PASS, `tsc` bersih. (Bila tes "tanggal selesai sebelum mulai" gagal karena `parseTanggal` menerima tanggal tak valid, itu bukan masalah; yang dicek di sana hanya urutan.)

- [ ] **Step 5: Gerbang commit**

Tanyakan pengguna sebelum commit (`feat(shared): skema dan usulan isian dari surat undangan`).

---

### Task 2: Ekstraktor AI `ekstrakUndangan`

**Files:**
- Create: `apps/api/src/ekstraksi/undangan.ts`
- Create: `apps/api/src/ekstraksi/undangan.test.ts`

**Interfaces:**
- Consumes: `HasilEkstraksiUndanganSchema`, `HasilEkstraksiUndangan` (Task 1); `AiGalat`, `KlienAi`, `KonfigurasiAi` (`../ai/klien.js`); `skemaJson`, `uraikanJsonAi` (`../ai/skema.js`); `IsiBerkas` (`./baca-berkas.js`); `klienPalsu` (`../test-support/helpers.js`).
- Produces: `ekstrakUndangan(klien: KlienAi, konf: KonfigurasiAi, isi: IsiBerkas): Promise<{ model: string; hasil: HasilEkstraksiUndangan }>`

- [ ] **Step 1: Tulis tes yang gagal**

`apps/api/src/ekstraksi/undangan.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { AiGalat, type KonfigurasiAi } from "../ai/klien.js";
import { klienPalsu } from "../test-support/helpers.js";
import { ekstrakUndangan } from "./undangan.js";

const konf: KonfigurasiAi = { llmUrl: "http://x:1", modelTeks: "m-teks", modelGambar: "m-gambar" };
const validJson = JSON.stringify({
  maksudTugas: "Rapat Koordinasi",
  lokasiTugas: "Bandung",
  tanggalMulai: "2026-11-02",
  tanggalSelesai: "2026-11-04",
  nomorUndangan: "123/ABC/2026",
  tanggalUndangan: "2026-10-15",
  penyelenggara: "Dinas Kehutanan",
});

describe("ekstrakUndangan", () => {
  it("dokumen berteks memakai model teks dan menyertakan isi dokumen di prompt", async () => {
    const klien = klienPalsu(() => validJson);
    const { model, hasil } = await ekstrakUndangan(klien, konf, { teks: "UNDANGAN RAPAT...", gambar: [] });
    expect(model).toBe("m-teks");
    expect(hasil.lokasiTugas).toBe("Bandung");
    expect(klien.panggilan[0]?.prompt).toContain("UNDANGAN RAPAT...");
    expect(klien.panggilan[0]?.gambar).toBeUndefined();
  });

  it("dokumen gambar memakai model gambar dan hanya halaman pertama", async () => {
    const klien = klienPalsu(() => validJson);
    const { model } = await ekstrakUndangan(klien, konf, { teks: "", gambar: ["AAA", "BBB"] });
    expect(model).toBe("m-gambar");
    expect(klien.panggilan[0]?.gambar).toEqual(["AAA"]);
  });

  it("membaca JSON dalam blok markdown", async () => {
    const klien = klienPalsu(() => `\`\`\`json\n${validJson}\n\`\`\``);
    const { hasil } = await ekstrakUndangan(klien, konf, { teks: "x".repeat(60), gambar: [] });
    expect(hasil.nomorUndangan).toBe("123/ABC/2026");
  });

  it("mencoba ulang sekali bila JSON pertama tidak valid", async () => {
    const klien = klienPalsu((_p, ke) => (ke === 1 ? '{"maksudTugas": 5}' : validJson));
    const { hasil } = await ekstrakUndangan(klien, konf, { teks: "UNDANGAN", gambar: [] });
    expect(hasil.maksudTugas).toBe("Rapat Koordinasi");
    expect(klien.panggilan).toHaveLength(2);
    expect(klien.panggilan[1]?.prompt).toContain("tidak valid");
  });

  it("HASIL_TIDAK_VALID setelah dua jawaban buruk", async () => {
    const klien = klienPalsu(() => "bukan json");
    await expect(ekstrakUndangan(klien, konf, { teks: "UNDANGAN", gambar: [] })).rejects.toMatchObject({ kode: "HASIL_TIDAK_VALID" });
  });

  it("MODEL_BELUM_DIATUR bila model yang dibutuhkan null", async () => {
    const klien = klienPalsu(() => validJson);
    await expect(ekstrakUndangan(klien, { ...konf, modelTeks: null }, { teks: "UNDANGAN", gambar: [] })).rejects.toBeInstanceOf(AiGalat);
    await expect(ekstrakUndangan(klien, { ...konf, modelGambar: null }, { teks: "", gambar: ["A"] })).rejects.toMatchObject({ kode: "MODEL_BELUM_DIATUR" });
  });

  it("BERKAS_TIDAK_TERBACA bila tidak ada teks maupun gambar", async () => {
    const klien = klienPalsu(() => validJson);
    await expect(ekstrakUndangan(klien, konf, { teks: "  ", gambar: [] })).rejects.toMatchObject({ kode: "BERKAS_TIDAK_TERBACA" });
  });
});
```

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `cd apps/api && npx vitest run src/ekstraksi/undangan.test.ts`
Expected: FAIL (modul tidak ada).

- [ ] **Step 3: Implementasi**

`apps/api/src/ekstraksi/undangan.ts`:

```ts
import { HasilEkstraksiUndanganSchema, type HasilEkstraksiUndangan } from "@spjan/shared";

import { AiGalat, type KlienAi, type KonfigurasiAi } from "../ai/klien.js";
import { skemaJson, uraikanJsonAi } from "../ai/skema.js";
import type { IsiBerkas } from "./baca-berkas.js";

export const SKEMA_EKSTRAKSI_UNDANGAN = skemaJson(HasilEkstraksiUndanganSchema);

const PROMPT_UNDANGAN = `Anda adalah asisten administrasi perjalanan dinas pemerintah Indonesia.
Baca surat undangan (rapat, bimbingan teknis, sosialisasi, lokakarya, kunjungan, dll.) berikut dan ekstrak informasinya ke dalam JSON sesuai skema:
- maksudTugas: maksud/nama kegiatan yang diundangkan, ditulis ringkas sebagai frasa penugasan (mis. "Menghadiri Rapat Koordinasi Percepatan Perhutanan Sosial"). Jangan menyalin seluruh paragraf.
- lokasiTugas: tempat pelaksanaan kegiatan (nama gedung/hotel bila ada, kota/kabupaten, provinsi), mis. "Hotel Grand Preanger, Kota Bandung, Jawa Barat"
- tanggalMulai: tanggal pertama kegiatan, format YYYY-MM-DD
- tanggalSelesai: tanggal terakhir kegiatan, format YYYY-MM-DD (sama dengan tanggalMulai bila satu hari)
- nomorUndangan: nomor surat undangan persis seperti tertulis
- tanggalUndangan: tanggal surat undangan dibuat, format YYYY-MM-DD
- penyelenggara: instansi pengirim/penyelenggara (mis. "Dinas Kehutanan Provinsi Jawa Barat")

Panduan: tanggal bisa tertulis "Senin, 2 November 2026" atau "2 - 4 November 2026"; ubah ke YYYY-MM-DD. Jangan menebak: bila suatu nilai tidak tertera jelas, isi null. Jangan mengarang nomor atau tanggal.

Balas HANYA JSON yang valid sesuai skema.`;

export async function ekstrakUndangan(
  klien: KlienAi,
  konf: KonfigurasiAi,
  isi: IsiBerkas,
): Promise<{ model: string; hasil: HasilEkstraksiUndangan }> {
  const pakaiGambar = isi.gambar.length > 0;
  const model = pakaiGambar ? konf.modelGambar : konf.modelTeks;
  if (!model) {
    throw new AiGalat("MODEL_BELUM_DIATUR", `Model ${pakaiGambar ? "gambar" : "teks"} belum diatur di Pengaturan > Model AI.`);
  }
  if (!pakaiGambar && isi.teks.trim().length === 0) {
    throw new AiGalat("BERKAS_TIDAK_TERBACA", "Surat undangan tidak memuat teks atau gambar yang dapat dibaca.");
  }

  const gambar = pakaiGambar ? [isi.gambar[0]!] : undefined;
  const promptDasar = pakaiGambar ? PROMPT_UNDANGAN : `${PROMPT_UNDANGAN}\n\nIsi Surat Undangan:\n${isi.teks}`;
  let prompt = promptDasar;

  for (let percobaan = 0; percobaan < 2; percobaan += 1) {
    const balasan = await klien.chat({ baseUrl: konf.llmUrl, model, prompt, gambar, skema: SKEMA_EKSTRAKSI_UNDANGAN });
    try {
      return { model, hasil: HasilEkstraksiUndanganSchema.parse(uraikanJsonAi(balasan)) };
    } catch (error) {
      const sebab = (error as Error).message.replace(/\s+/g, " ").slice(0, 200);
      prompt = `${promptDasar}\n\nJawaban sebelumnya tidak valid (${sebab}). Balas HANYA JSON sesuai skema.`;
    }
  }
  throw new AiGalat("HASIL_TIDAK_VALID", "Model tidak mengembalikan data undangan yang valid.");
}
```

- [ ] **Step 4: Jalankan, pastikan lulus**

Run: `cd apps/api && npx vitest run src/ekstraksi/undangan.test.ts && npm run lint`
Expected: PASS, `tsc` bersih.

- [ ] **Step 5: Gerbang commit** — tanya pengguna (`feat(api): ekstraktor AI surat undangan`).

---

### Task 3: Rute `POST /api/naskah-st/ekstrak-undangan`

**Files:**
- Modify: `apps/api/src/app.ts:92` (kirim `klien`)
- Modify: `apps/api/src/routes/naskah-st.ts` (opts + rute + impor)
- Modify: `apps/api/src/naskah-st.test.ts` (app dengan `klienPalsu`, tes rute)

**Interfaces:**
- Consumes: `ekstrakUndangan` (Task 2), `bacaIsi` (`../ekstraksi/baca-berkas.js`), `deteksiMime` (`../berkas/deteksi.js`), `konfigurasiAi` (`../repositories/model-ai.js`), `catatAudit`, `penggunaAktif`, `HttpError`, `BATAS_BERKAS`.
- Produces: HTTP `POST /api/naskah-st/ekstrak-undangan` multipart field `file` → 200 `{ model: string, hasil: HasilEkstraksiUndangan }`; galat: 400 `BERKAS_KOSONG`, 400 `TIPE_BERKAS_TIDAK_DIDUKUNG`, 413 `BERKAS_TERLALU_BESAR`, 409 `MODEL_BELUM_DIATUR`, 422 `BERKAS_TIDAK_TERBACA`/`HASIL_TIDAK_VALID`, 502 lainnya.

- [ ] **Step 1: Tulis tes yang gagal**

Di `apps/api/src/naskah-st.test.ts`: ubah setup agar memakai klien palsu yang bisa diganti per tes.

```ts
// impor tambahan
import { AiGalat } from "./ai/klien.js";
import { pool } from "./db.js";
import { bodyMultipart, klienPalsu, PNG_1X1 } from "./test-support/helpers.js";
import type { PermintaanAi } from "./ai/klien.js";

let balasAi: (p: PermintaanAi) => string = () => "{}";
```

Ganti `app = await siapkanApp();` menjadi `app = await siapkanApp({ klien: klienPalsu((p) => balasAi(p)) });` (pertahankan impor `bersihkanData, loginCookie, siapkanApp` yang ada dan gabungkan dengan impor helper di atas). Tambahkan blok tes baru di akhir file:

```ts
describe("POST /api/naskah-st/ekstrak-undangan", () => {
  const JSON_UNDANGAN = JSON.stringify({
    maksudTugas: "Rapat Koordinasi", lokasiTugas: "Bandung", tanggalMulai: "2026-11-02", tanggalSelesai: "2026-11-04",
    nomorUndangan: "123/ABC/2026", tanggalUndangan: "2026-10-15", penyelenggara: "Dinas Kehutanan",
  });
  const unggah = (nama: string, isi: Buffer, withCookie = true) => {
    const { payload, headers } = bodyMultipart(nama, isi);
    return app.inject({ method: "POST", url: "/api/naskah-st/ekstrak-undangan", headers: { ...(withCookie ? { cookie } : {}), ...headers }, payload });
  };
  const aturModelGambar = () => pool.query("update model_ai set model_gambar = 'm-gambar' where id = 1");

  it("mengembalikan hasil ekstraksi dan mencatat audit tanpa isi berkas", async () => {
    await aturModelGambar();
    balasAi = () => JSON_UNDANGAN;
    const res = await unggah("undangan.png", PNG_1X1);
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ model: "m-gambar", hasil: { lokasiTugas: "Bandung", nomorUndangan: "123/ABC/2026" } });
    const { rows } = await pool.query("select detail from log_audit where aksi = 'st.ekstrak_undangan'");
    expect(rows).toHaveLength(1);
    expect(JSON.stringify(rows[0].detail)).not.toContain("Bandung");
  });

  it("menolak tanpa login (401)", async () => {
    expect((await unggah("u.png", PNG_1X1, false)).statusCode).toBe(401);
  });

  it("menolak permintaan tanpa berkas (400 BERKAS_KOSONG)", async () => {
    const res = await app.inject({
      method: "POST", url: "/api/naskah-st/ekstrak-undangan",
      headers: { cookie, "content-type": "multipart/form-data; boundary=x" }, payload: "--x--\r\n",
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe("BERKAS_KOSONG");
  });

  it("menolak tipe berkas yang bukan PDF/gambar berdasarkan isi (400)", async () => {
    const res = await unggah("undangan.pdf", Buffer.from("ini teks biasa, bukan pdf"));
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe("TIPE_BERKAS_TIDAK_DIDUKUNG");
  });

  it("model gambar belum diatur memberi 409 MODEL_BELUM_DIATUR", async () => {
    const res = await unggah("undangan.png", PNG_1X1);
    expect(res.statusCode).toBe(409);
    expect(res.json().error).toBe("MODEL_BELUM_DIATUR");
  });

  it("balasan AI tidak valid memberi 422 HASIL_TIDAK_VALID", async () => {
    await aturModelGambar();
    balasAi = () => "bukan json";
    const res = await unggah("undangan.png", PNG_1X1);
    expect(res.statusCode).toBe(422);
    expect(res.json().error).toBe("HASIL_TIDAK_VALID");
  });

  it("galat tak terduga dari klien AI memberi 502 tanpa membocorkan detail", async () => {
    await aturModelGambar();
    balasAi = () => {
      throw new AiGalat("WAKTU_HABIS", "Model tidak merespons.");
    };
    const res = await unggah("undangan.png", PNG_1X1);
    expect(res.statusCode).toBe(502);
    expect(res.json().error).toBe("WAKTU_HABIS");
  });
});
```

(`PNG_1X1` sudah diekspor di `helpers.ts`. Jika `AiGalat` diekspor ulang dari helpers, boleh diimpor dari sana.)

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `cd apps/api && npx vitest run src/naskah-st.test.ts -t ekstrak-undangan`
Expected: FAIL (rute 404).

- [ ] **Step 3: Implementasi**

`apps/api/src/app.ts:92`: `await app.register(naskahStRoutes, { prefix: "/api/naskah-st", db, klien });`

`apps/api/src/routes/naskah-st.ts`:
- Impor tambahan:
```ts
import multipart from "@fastify/multipart";
import { BATAS_BERKAS } from "@spjan/shared";

import { AiGalat, type KlienAi } from "../ai/klien.js";
import { deteksiMime } from "../berkas/deteksi.js";
import { bacaIsi } from "../ekstraksi/baca-berkas.js";
import { ekstrakUndangan } from "../ekstraksi/undangan.js";
import { konfigurasiAi } from "../repositories/model-ai.js";
```
(gabungkan `BATAS_BERKAS` ke impor `@spjan/shared` yang sudah ada.)
- Ubah tanda tangan: `export async function naskahStRoutes(app: FastifyInstance, opts: { db: Db; klien: KlienAi }): Promise<void> {`
- Tambahkan di awal fungsi (sebelum rute `/:id`):

```ts
  // multipart terenkapsulasi per plugin: daftarkan sendiri (berkasRoutes tidak berlaku di sini).
  await app.register(multipart, { limits: { fileSize: BATAS_BERKAS.maksUkuranMb * 1024 * 1024, files: 1, fields: 0 } });

  // 0. Ekstraksi surat undangan -> usulan isian. Berkas dibaca sekali dan tidak disimpan.
  app.post("/ekstrak-undangan", async (req) => {
    const user = penggunaAktif(req);
    const file = await req.file();
    if (!file) throw new HttpError(400, "BERKAS_KOSONG", "Tidak ada berkas pada permintaan.");
    let data: Buffer;
    try {
      data = await file.toBuffer();
    } catch (error) {
      if ((error as { code?: string }).code === "FST_REQ_FILE_TOO_LARGE") {
        throw new HttpError(413, "BERKAS_TERLALU_BESAR", `Berkas melebihi ${BATAS_BERKAS.maksUkuranMb} MB.`);
      }
      throw error;
    }
    const mime = deteksiMime(data);
    if (!mime) {
      throw new HttpError(400, "TIPE_BERKAS_TIDAK_DIDUKUNG", "Hanya berkas PDF, JPG, PNG, atau WEBP yang didukung.");
    }
    try {
      const isi = await bacaIsi(mime, data);
      const { model, hasil } = await ekstrakUndangan(opts.klien, await konfigurasiAi(opts.db), isi);
      await catatAudit(opts.db, user, {
        aksi: "st.ekstrak_undangan",
        entitas: "naskah_st",
        entitasId: null,
        detail: { mime, ukuran: data.length, model },
      });
      return { model, hasil };
    } catch (error) {
      if (error instanceof AiGalat) {
        const status = error.kode === "MODEL_BELUM_DIATUR" ? 409 : error.kode === "BERKAS_TIDAK_TERBACA" || error.kode === "HASIL_TIDAK_VALID" ? 422 : 502;
        throw new HttpError(status, error.kode, error.message);
      }
      throw error;
    }
  });
```

Periksa tipe `catatAudit` (`apps/api/src/repositories/audit.ts`): bila `entitasId` tidak boleh `null`/wajib, sesuaikan (hilangkan properti atau pakai nilai yang diizinkan) agar `tsc` lulus.

- [ ] **Step 4: Jalankan, pastikan lulus**

Run: `cd apps/api && npx vitest run src/naskah-st.test.ts && npm run lint`
Expected: seluruh tes naskah-st PASS (termasuk yang lama), `tsc` bersih.

- [ ] **Step 5: Gerbang commit** — tanya pengguna (`feat(api): rute ekstraksi surat undangan untuk naskah ST`).

---

### Task 4: Antarmuka web

**Files:**
- Modify: `apps/web/src/lib/api.ts` (tambah di objek `naskahSt`, sekitar baris 175)
- Modify: `apps/web/src/lib/queries.ts` (hook baru dekat `useBuatSpjDariNaskah`)
- Create: `apps/web/src/components/st/isi-dari-undangan.tsx`
- Modify: `apps/web/src/pages/st-naskah-editor.tsx` (pasang komponen di kolom kiri, sebelum kartu "1. Format Naskah & Nomor Surat")

**Interfaces:**
- Consumes: `HasilEkstraksiUndangan`, `UsulanIsian`, `usulanDariUndangan`, `terapkanUsulan`, `BagianNaskahUsulan` (Task 1); endpoint Task 3; `useSeretLepas` (`@/lib/use-seret-lepas`); `ApiError`, `pesanGalat` (`@/lib/format`).
- Produces: `api.naskahSt.ekstrakUndangan(file: File): Promise<{ model: string; hasil: HasilEkstraksiUndangan }>`; `useEkstrakUndangan()` (`useMutation<…, Error, File>`); komponen `<IsiDariUndangan naskah={BagianNaskahUsulan} onTerapkan={(patch) => void} />`.

- [ ] **Step 1: API client** — di `api.ts`, impor `HasilEkstraksiUndangan` dari `@spjan/shared` dan tambahkan ke objek `naskahSt` (meniru `berkas.unggah` untuk penanganan galat):

```ts
    ekstrakUndangan: async (file: File): Promise<{ model: string; hasil: HasilEkstraksiUndangan }> => {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch('/api/naskah-st/ekstrak-undangan', { method: 'POST', credentials: 'same-origin', body: form })
      const data: unknown = await res.json().catch(() => null)
      if (!res.ok) {
        const d = (data ?? {}) as { error?: string; pesan?: string; rincian?: unknown }
        throw new ApiError(res.status, d.error ?? 'GALAT', d.pesan ?? res.statusText, d.rincian)
      }
      return data as { model: string; hasil: HasilEkstraksiUndangan }
    },
```

- [ ] **Step 2: Hook** — di `queries.ts`:

```ts
export function useEkstrakUndangan() {
  return useMutation({ mutationFn: (file: File) => api.naskahSt.ekstrakUndangan(file) })
}
```

- [ ] **Step 3: Komponen** `apps/web/src/components/st/isi-dari-undangan.tsx`. Baca dulu `apps/web/src/components/ui/{card,button}.tsx` dan satu komponen di `components/st/` untuk meniru gaya kelas, lalu implementasikan:
  - State: `usulan: UsulanIsian[] | null`, `terpilih: Set<FieldUsulanUndangan>`, `model: string | null`.
  - Unggah: input `type="file" accept="application/pdf,image/png,image/jpeg,image/webp"` tersembunyi + area seret-lepas via `useSeretLepas(files => proses(files[0]))`. Tolak `file.size > 10 * 1024 * 1024` dengan `toast.error('Ukuran berkas melebihi batas 10 MB.')`.
  - `proses(file)`: `const { hasil, model } = await mutation.mutateAsync(file)`; `const u = usulanDariUndangan(naskah, hasil, new Date().toISOString().slice(0, 10))`; bila `u.length === 0` → `toast.info('Tidak ada isian baru yang dapat diusulkan dari dokumen ini.')`; selain itu `setUsulan(u)` dan `setTerpilih(new Set(u.filter(x => x.bawaanAtauKosong).map(x => x.field)))`. Galat → `toast.error(pesanGalat(err))`.
  - Saat `mutation.isPending`: tombol nonaktif dengan `Loader2Icon` berputar dan teks "Membaca dokumen…".
  - Panel usulan: judul "Usulan dari surat undangan", teks kecil model yang dipakai, daftar baris per usulan: kotak centang + `label`, nilai lama (dicoret, "kosong" bila `''`; tanggal ditampilkan lewat `tanggalIndonesia`) → nilai baru. Field yang bukan `bawaanAtauKosong` diberi catatan "akan menimpa isian Anda" dan tidak tercentang awal.
  - Tombol "Terapkan (n)" (nonaktif bila n = 0): `onTerapkan(terapkanUsulan(naskah, usulan.filter(u => terpilih.has(u.field))))`, `toast.success('Isian diterapkan. Periksa kembali sebelum menyimpan.')`, lalu `setUsulan(null)`. Tombol "Batal" → `setUsulan(null)`. Panel hilang setelah itu (data hanya hidup di formulir).
  - Hanya token warna tema (`text-muted-foreground`, `border-border`, `bg-primary/5`, dst); tanpa kelas `slate/amber` mentah.

- [ ] **Step 4: Pasang di editor** — di `st-naskah-editor.tsx` impor `IsiDariUndangan` dan, di kolom kiri tepat sebelum kartu "1. Format Naskah & Nomor Surat", tambahkan:

```tsx
          <IsiDariUndangan
            naskah={form}
            onTerapkan={(patch) => setForm((prev) => ({ ...prev, ...patch }))}
          />
```

`form` (`NaskahStPayload`) sudah memenuhi `BagianNaskahUsulan`.

- [ ] **Step 5: Verifikasi (tanpa tes frontend)**

Run (dari root): `npm run build -w @spjan/shared && npm run lint -w web && npm run build -w web`
Expected: `tsc -b`, `eslint`, dan `vite build` bersih. Jangan otomasi Chrome; beri tahu pengguna bahwa tampilan belum dilihat di peramban.

- [ ] **Step 6: Gerbang commit** — tanya pengguna (`feat(web): isi naskah ST dari surat undangan`).

---

### Task 5: Dokumentasi status dan verifikasi akhir

**Files:**
- Modify: `docs/STATUS.md`

- [ ] **Step 1:** Tambahkan bagian "Isi naskah ST dari surat undangan (belum di-commit)" di `docs/STATUS.md` (dekat bagian Pembuat Naskah ST): ringkas endpoint, berkas tidak disimpan, panel usulan, dan risiko (mutu bergantung model AI admin; gambar hanya halaman pertama; belum dilihat di peramban; belum ada pembaca .docx). Perbarui tanggal "Terakhir diperbarui".

- [ ] **Step 2: Verifikasi seluruh monorepo**

Run (dari root): `npm run build && npm run test && npm run lint`
Expected: semua hijau (api, shared, web). Laporkan angka tes sebenarnya, jangan menebak. Bila ada yang gagal, tampilkan keluarannya apa adanya.

- [ ] **Step 3: Gerbang commit/push** — tanya pengguna terpisah untuk commit, lalu untuk push (dua persetujuan). Dua berkas untracked di root (`Cuplikan layar ... .png`, `Surat-Tugas-_nomor_naskah_ (3).docx`) tidak boleh ikut di-stage.

---

## Self-Review

- **Cakupan spec:** skema + usulan + penerapan (Task 1); ekstraktor teks/gambar/retry/galat (Task 2); multipart sendiri, validasi magic bytes, batas ukuran, pemetaan galat, audit tanpa isi berkas (Task 3); komponen seret-lepas, panel usulan dengan centang default, tanpa penayangan ganda (Task 4); STATUS + verifikasi (Task 5).
- **Penyimpangan kecil dari spec:** spec menyebut PDF/PNG/JPG; `deteksiMime` juga mengenali WEBP, jadi WEBP ikut diterima (pesan galat menyebutnya). Penerapan usulan (`terapkanUsulan`) ditaruh di shared agar murni dan teruji.
- **Konsistensi tipe:** `UsulanIsian`, `BagianNaskahUsulan`, `usulanDariUndangan(naskah, hasil, hariIni)`, `terapkanUsulan(naskah, usulan)`, `ekstrakUndangan(klien, konf, isi)`, `api.naskahSt.ekstrakUndangan(file)` dipakai dengan nama dan tanda tangan yang sama di semua task.
