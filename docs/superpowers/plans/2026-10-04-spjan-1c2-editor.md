# SPJAN Tahap 1C-2: Editor Surat Tugas - Rencana Implementasi

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Membuat editor surat tugas di `apps/web`: satu halaman untuk nomor/tanggal ST, banyak pelaksana (data pegawai, etape per kota, biaya transport dan tambahan) dengan total, terbilang, catatan pagu, dan peringatan yang dihitung langsung oleh `hitungSpj` saat mengetik.

**Architecture:** Halaman `st-editor` memuat pengaturan, versi SBM yang di-pin (atau versi aktif terbaru untuk surat tugas baru), dan data ST; komponen `Editor` memegang state `SuratTugasPayload` lokal dan menghitung `hitungSpj(toSpjInput(st, pengaturan), sbm)` dengan `useMemo`. Logika murni (nilai awal, ringkasan etape, penyejajaran baris transport) ada di `@spjan/shared/st-model` agar bisa dites.

**Tech Stack:** React 19, react-router-dom 7, TanStack Query, zod (skema bersama), vitest (hanya di shared).

**Spec:** `docs/superpowers/specs/2026-10-04-spjan-design.md` (bagian 5, 7); rencana sebelumnya 1A, 1B, 1C-1 (sudah di `main`).

## Global Constraints

- Semua yang tercantum pada Global Constraints rencana 1C-1 tetap berlaku.
- Tidak ada penyimpanan otomatis: tombol "Simpan" eksplisit, indikator "Ada perubahan yang belum disimpan", dan peringatan `beforeunload` saat meninggalkan halaman dengan perubahan (penyimpangan dari spesifikasi bagian 7 yang menyebut autosimpan; dipilih agar tidak menimpa data dengan draf setengah jadi).
- Draf boleh disimpan dengan isian kosong kecuali nomor ST, tanggal ST, dan nama pelaksana (skema `SuratTugasPayloadSchema`); kelengkapan data ditunjukkan oleh peringatan mesin hitung, bukan penolakan simpan.
- Tombol "Dokumen" hanya aktif bila tidak ada perubahan belum tersimpan; rutenya `/st/:id/dokumen` masih halaman "segera hadir" (rencana 1C-3).
- Jangan commit, push, atau deploy tanpa persetujuan eksplisit pengguna di setiap gerbang. Pesan commit Conventional Commits dengan trailer `Co-Authored-By` dan `Claude-Session`.

## Struktur berkas

```
packages/shared/src/schemas.ts            + tipe EtapePayload, BiayaPayload, PelaksanaPayload
packages/shared/src/st-model.ts           nilai awal, klasifikasi jenis, ringkasEtape, indeksBarisTransport, payloadDariDto
apps/web/src/lib/{queries,validasi}.ts    + useSuratTugas, useSimpanSuratTugas; pesanValidasi
apps/web/src/components/ui/textarea.tsx
apps/web/src/components/pegawai-form.tsx  FormPegawai (diekstrak dari pages/pegawai.tsx)
apps/web/src/components/st/{rupiah-input,etape-form,biaya-form,pelaksana-card,ringkasan}.tsx
apps/web/src/pages/st-editor.tsx
```

---

### Task 1: Logika murni editor di @spjan/shared

**Files:**
- Modify: `packages/shared/src/schemas.ts`, `packages/shared/src/index.ts`
- Create: `packages/shared/src/st-model.ts`
- Test: `packages/shared/src/st-model.test.ts`

**Interfaces:**
- Consumes: skema dan tipe `SuratTugasPayloadSchema`, `SuratTugasDto` (schemas.ts), `parseTanggal`, `selisihHari` (teks.ts), `BiayaInput`, `JenisBiaya` (types.ts).
- Produces: tipe `EtapePayload`, `BiayaPayload`, `PelaksanaPayload`; `stKosong(kodeAkun?)`, `etapeKosong()`, `biayaKosong(jenis)`, `pelaksanaKosong()`, `jenisButuhProvinsi/jenisButuhEtape/jenisButuhUraian(jenis): boolean`, `ringkasEtape(e): {hari: number|null; malam: number|null}`, `indeksBarisTransport(biaya): Array<number|null>`, `pelaksanaDariPegawai(awal, pegawai): PelaksanaPayload`, `payloadDariDto(dto): SuratTugasPayload`.

- [ ] **Step 1: Tulis tes yang gagal**

`packages/shared/src/st-model.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { SuratTugasPayloadSchema } from "./schemas.js";
import {
  biayaKosong,
  etapeKosong,
  indeksBarisTransport,
  jenisButuhEtape,
  jenisButuhProvinsi,
  jenisButuhUraian,
  pelaksanaDariPegawai,
  payloadDariDto,
  pelaksanaKosong,
  ringkasEtape,
  stKosong,
} from "./st-model.js";

describe("nilai awal", () => {
  it("stKosong dan pelaksanaKosong lolos skema (draf boleh kosong)", () => {
    const st = { ...stKosong("7288.QDD.001.052.A.524111"), nomor: "ST.1", tanggal: "2026-09-08", pelaksana: [pelaksanaKosong()] };
    // nama pelaksana wajib terisi saat disimpan
    expect(SuratTugasPayloadSchema.safeParse(st).success).toBe(false);
    st.pelaksana[0]!.nama = "A";
    expect(SuratTugasPayloadSchema.safeParse(st).success).toBe(true);
  });

  it("biayaKosong dan etapeKosong", () => {
    expect(biayaKosong("TIKET_PERGI")).toMatchObject({ jenis: "TIKET_PERGI", tarif: 0, qty: null, etapeIndex: null });
    expect(etapeKosong()).toMatchObject({ berangkat: "", pulang: "", dinasJabatan: false });
    expect(pelaksanaKosong().etape).toHaveLength(1);
  });
});

describe("klasifikasi jenis biaya", () => {
  it("provinsi, etape, dan uraian", () => {
    expect(jenisButuhProvinsi("TRANSPORT_DARAT")).toBe(true);
    expect(jenisButuhProvinsi("TAKSI_TERMINAL")).toBe(true);
    expect(jenisButuhProvinsi("SEWA_RODA4")).toBe(true);
    expect(jenisButuhProvinsi("TIKET_PERGI")).toBe(false);
    expect(jenisButuhEtape("TIKET_PERGI")).toBe(true);
    expect(jenisButuhEtape("TIKET_KEMBALI")).toBe(true);
    expect(jenisButuhEtape("TAKSI_KEDUDUKAN")).toBe(false);
    expect(jenisButuhUraian("LAINNYA")).toBe(true);
    expect(jenisButuhUraian("TAKSI_KEDUDUKAN")).toBe(false);
  });
});

describe("ringkasEtape", () => {
  it("hari dan malam, termasuk lintas bulan dan override", () => {
    expect(ringkasEtape({ berangkat: "2026-09-10", pulang: "2026-09-13" })).toEqual({ hari: 4, malam: 3 });
    expect(ringkasEtape({ berangkat: "2026-09-10", pulang: "2026-09-10" })).toEqual({ hari: 1, malam: 0 });
    expect(ringkasEtape({ berangkat: "2026-09-30", pulang: "2026-10-02" })).toEqual({ hari: 3, malam: 2 });
    expect(ringkasEtape({ berangkat: "2026-09-30", pulang: "2026-10-02", malamOverride: 1 })).toEqual({ hari: 3, malam: 1 });
  });

  it("tanggal tidak valid atau terbalik memberi null", () => {
    expect(ringkasEtape({ berangkat: "", pulang: "2026-09-13" })).toEqual({ hari: null, malam: null });
    expect(ringkasEtape({ berangkat: "2026-09-13", pulang: "2026-09-10" })).toEqual({ hari: null, malam: null });
  });
});

describe("indeksBarisTransport", () => {
  it("melewati biaya bertarif nol agar sejajar dengan baris hasil", () => {
    expect(indeksBarisTransport([{ tarif: 100 }, { tarif: 0 }, { tarif: 50 }, { tarif: 0 }, { tarif: 1 }])).toEqual([0, null, 1, null, 2]);
    expect(indeksBarisTransport([])).toEqual([]);
  });
});

describe("pelaksanaDariPegawai", () => {
  it("mengisi data pegawai dan mempertahankan etape serta biaya", () => {
    const awal = { ...pelaksanaKosong(), noSpd: "403/SPD/PPS/2026", biaya: [biayaKosong("TAKSI_KEDUDUKAN")] };
    const hasil = pelaksanaDariPegawai(awal, { id: 7, nama: "R Resa", nip: "199508222023211008", jabatan: "Surveyor", status: "ESELON_IV_GOL_III_II_I" });
    expect(hasil).toMatchObject({ pegawaiId: 7, nama: "R Resa", nip: "199508222023211008", status: "ESELON_IV_GOL_III_II_I", noSpd: "403/SPD/PPS/2026" });
    expect(hasil.biaya).toHaveLength(1);
    expect(hasil.etape).toHaveLength(1);
  });
});

describe("payloadDariDto", () => {
  it("membuang kolom server dan menjaga isian", () => {
    const dto = {
      id: 3,
      versiSbmId: 1,
      createdAt: "2026-10-04T00:00:00.000Z",
      updatedAt: "2026-10-04T00:00:00.000Z",
      nomor: "ST.1",
      tanggal: "2026-09-08",
      tanggalSpj: null,
      kodeAkun: "A",
      catatan: "",
      pelaksana: [pelaksanaKosong()],
    };
    const payload = payloadDariDto(dto);
    expect(Object.keys(payload).sort()).toEqual(["catatan", "kodeAkun", "nomor", "pelaksana", "tanggal", "tanggalSpj"]);
    expect(payload.pelaksana).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Jalankan tes, pastikan gagal**

Run: `cd packages/shared && npx vitest run src/st-model.test.ts`
Expected: FAIL, `Failed to resolve import "./st-model.js"`.

- [ ] **Step 3: Tambah tipe dan implementasi**

Di `packages/shared/src/schemas.ts`, sebelum `export type SuratTugasPayload = ...` tambahkan:
```ts
export type EtapePayload = z.infer<typeof EtapePayloadSchema>;
export type BiayaPayload = z.infer<typeof BiayaPayloadSchema>;
export type PelaksanaPayload = z.infer<typeof PelaksanaPayloadSchema>;
```
`packages/shared/src/st-model.ts`:
```ts
import type { BiayaPayload, EtapePayload, PelaksanaPayload, SuratTugasDto, SuratTugasPayload } from "./schemas.js";
import { parseTanggal, selisihHari } from "./teks.js";
import type { BiayaInput, JenisBiaya } from "./types.js";

export function stKosong(kodeAkun = ""): SuratTugasPayload {
  return { nomor: "", tanggal: "", tanggalSpj: null, kodeAkun, catatan: "", pelaksana: [] };
}

export function etapeKosong(): EtapePayload {
  return {
    provinsi: "",
    kota: "",
    kegiatan: "",
    berangkat: "",
    pulang: "",
    malamOverride: null,
    hotelNama: null,
    hotelTarif: null,
    dinasJabatan: false,
  };
}

export function biayaKosong(jenis: JenisBiaya): BiayaPayload {
  return {
    jenis,
    provinsi: null,
    uraian: null,
    qty: null,
    satuan: null,
    tarif: 0,
    keterangan: null,
    etapeIndex: null,
  };
}

export function pelaksanaKosong(): PelaksanaPayload {
  return {
    pegawaiId: null,
    nama: "",
    nip: "",
    jabatan: "",
    status: null,
    noSpd: null,
    etape: [etapeKosong()],
    biaya: [],
  };
}

const BUTUH_PROVINSI = new Set<JenisBiaya>(["TRANSPORT_DARAT", "TAKSI_TERMINAL", "SEWA_RODA4", "SEWA_RODA6", "SEWA_BUS_BESAR"]);
const BUTUH_ETAPE = new Set<JenisBiaya>(["TIKET_PERGI", "TIKET_KEMBALI"]);

/** Jenis yang pagunya dicari berdasarkan provinsi. */
export function jenisButuhProvinsi(jenis: JenisBiaya): boolean {
  return BUTUH_PROVINSI.has(jenis);
}

/** Jenis yang terkait dengan satu etape (tiket). */
export function jenisButuhEtape(jenis: JenisBiaya): boolean {
  return BUTUH_ETAPE.has(jenis);
}

/** Jenis yang uraiannya wajib bermakna: transport darat dan Jakarta-sekitar (kunci pagu), airport tax dan lainnya (teks bebas). */
export function jenisButuhUraian(jenis: JenisBiaya): boolean {
  return ["TRANSPORT_DARAT", "TRANSPORT_JAKARTA_SEKITAR", "AIRPORT_TAX_BAGASI", "KERETA_BUS_LAIN", "LAINNYA"].includes(jenis);
}

export interface RingkasEtape {
  /** null bila tanggal belum valid atau pulang lebih awal dari berangkat. */
  hari: number | null;
  malam: number | null;
}

export function ringkasEtape(e: Pick<EtapePayload, "berangkat" | "pulang" | "malamOverride">): RingkasEtape {
  const a = parseTanggal(e.berangkat);
  const b = parseTanggal(e.pulang);
  if (!a || !b) return { hari: null, malam: null };
  const hari = selisihHari(a, b) + 1;
  if (hari < 1) return { hari: null, malam: null };
  return { hari, malam: e.malamOverride != null ? e.malamOverride : Math.max(hari - 1, 0) };
}

/**
 * hitungSpj membuang biaya bertarif <= 0, sehingga indeks baris transport hasil tidak sejajar
 * dengan indeks biaya masukan. Mengembalikan, untuk tiap biaya masukan, indeks barisnya pada
 * `transport` hasil (atau null bila biaya itu tidak menghasilkan baris).
 */
export function indeksBarisTransport(biaya: Pick<BiayaInput, "tarif">[]): Array<number | null> {
  let berikut = 0;
  return biaya.map((b) => (b.tarif > 0 ? berikut++ : null));
}

/** Pelaksana baru dari data pegawai; mempertahankan etape/biaya yang sudah ada. */
export function pelaksanaDariPegawai(
  awal: PelaksanaPayload,
  pegawai: { id: number; nama: string; nip: string; jabatan: string; status: PelaksanaPayload["status"] },
): PelaksanaPayload {
  return { ...awal, pegawaiId: pegawai.id, nama: pegawai.nama, nip: pegawai.nip, jabatan: pegawai.jabatan, status: pegawai.status };
}

/** Menyalin isian surat tugas dari DTO server (membuang id, versi SBM, dan stempel waktu). */
export function payloadDariDto(dto: SuratTugasDto): SuratTugasPayload {
  return {
    nomor: dto.nomor,
    tanggal: dto.tanggal,
    tanggalSpj: dto.tanggalSpj ?? null,
    kodeAkun: dto.kodeAkun,
    catatan: dto.catatan,
    pelaksana: dto.pelaksana,
  };
}
```

Tambahkan di akhir `packages/shared/src/index.ts`:
```ts
export * from "./st-model.js";
```

- [ ] **Step 4: Jalankan tes, lint, dan build**

Run: `cd packages/shared && npx vitest run && npx tsc -p tsconfig.lint.json --noEmit && npm run build`
Expected: `Tests  60 passed (60)`; lint dan build tanpa galat.

- [ ] **Step: Commit (minta persetujuan pengguna dulu)**

Tampilkan berkas dan ringkasan satu baris, tunggu "ya" eksplisit, baru jalankan:

```bash
git add packages/shared/src/schemas.ts packages/shared/src/st-model.ts packages/shared/src/st-model.test.ts packages/shared/src/index.ts
git commit -m "feat(shared): logika murni editor surat tugas

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01WzvKDJwroXVpHhvv4xyAzM"
```

---

### Task 2: Pondasi web editor (hook, validasi, input rupiah, FormPegawai)

**Files:**
- Create: `apps/web/src/components/ui/textarea.tsx`, `apps/web/src/components/pegawai-form.tsx`, `apps/web/src/components/st/rupiah-input.tsx`, `apps/web/src/lib/validasi.ts`
- Modify: `apps/web/src/pages/pegawai.tsx`, `apps/web/src/lib/queries.ts`

**Interfaces:**
- Consumes: `usePegawaiMutations`, `Field`, `Dialog*`, `PegawaiPayloadSchema`, `api.suratTugas.*`.
- Produces: `FormPegawai({ awal: PegawaiDto | null; onSelesai(disimpan: PegawaiDto | null) })` (null = dibatalkan); `RupiahInput({ value: number | null | undefined; onChange(v: number | null); nolKosong? })` (+ prop `Input`); `Textarea`; `pesanValidasi(isu): string[]` (mis. "Pelaksana 1 > Etape 2 > Tarif hotel: ..."); hook `useSuratTugas(id)` dan `useSimpanSuratTugas()` (mutasi `{id: number|null; payload}`: null = buat baru).

- [ ] **Step 1: Tulis komponen dan pembantu baru**

`apps/web/src/components/ui/textarea.tsx`:
```tsx
import * as React from 'react'

import { cn } from '@/lib/utils'

function Textarea({ className, ...props }: React.ComponentProps<'textarea'>) {
  return (
    <textarea
      className={cn(
        'min-h-16 w-full rounded-md border border-input bg-card px-3 py-2 text-sm shadow-xs outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  )
}

export { Textarea }
```

`apps/web/src/components/pegawai-form.tsx`:
```tsx
import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { PegawaiPayloadSchema, STATUS_KODE, STATUS_LABEL, type PegawaiDto, type PegawaiPayload, type StatusKode } from '@spjan/shared'

import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { DialogFooter } from '@/components/ui/dialog'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { ApiError } from '@/lib/api'
import { pesanGalat } from '@/lib/format'
import { usePegawaiMutations } from '@/lib/queries'

type Galat = Partial<Record<keyof PegawaiPayload, string>>

/** Formulir tambah/ubah pegawai. onSelesai(dto) dipanggil setelah tersimpan, onSelesai(null) saat dibatalkan. */
export function FormPegawai({ awal, onSelesai }: { awal: PegawaiDto | null; onSelesai: (disimpan: PegawaiDto | null) => void }) {
  const { buat, ubah } = usePegawaiMutations()
  const [nama, setNama] = useState(awal?.nama ?? '')
  const [nip, setNip] = useState(awal?.nip ?? '')
  const [jabatan, setJabatan] = useState(awal?.jabatan ?? '')
  const [status, setStatus] = useState<StatusKode | ''>(awal?.status ?? '')
  const [galat, setGalat] = useState<Galat>({})
  const [galatServer, setGalatServer] = useState<string | null>(null)
  const sibuk = buat.isPending || ubah.isPending

  async function simpan(e: FormEvent) {
    e.preventDefault()
    setGalatServer(null)
    const data = { nama: nama.trim(), nip: nip.replace(/\s/g, ''), jabatan: jabatan.trim(), status: status || null }
    const hasil = PegawaiPayloadSchema.safeParse(data)
    if (!hasil.success) {
      const g: Galat = {}
      for (const isu of hasil.error.issues) {
        const kunci = isu.path[0] as keyof PegawaiPayload
        g[kunci] ??= isu.message
      }
      setGalat(g)
      return
    }
    setGalat({})
    try {
      const dto = awal ? await ubah.mutateAsync({ id: awal.id, data: hasil.data }) : await buat.mutateAsync(hasil.data)
      toast.success(awal ? 'Data pegawai diperbarui.' : 'Pegawai ditambahkan.')
      onSelesai(dto)
    } catch (error) {
      setGalatServer(error instanceof ApiError && error.status === 409 ? 'NIP sudah terdaftar.' : pesanGalat(error))
    }
  }

  return (
    <form onSubmit={simpan} className="grid gap-4">
      {galatServer ? <Alert variant="destructive">{galatServer}</Alert> : null}
      <Field label="Nama (dengan gelar)" htmlFor="nama" error={galat.nama}>
        <Input id="nama" value={nama} onChange={(e) => setNama(e.target.value)} autoFocus />
      </Field>
      <Field label="NIP" htmlFor="nip" error={galat.nip} hint="Angka saja, tanpa spasi.">
        <Input id="nip" inputMode="numeric" value={nip} onChange={(e) => setNip(e.target.value)} />
      </Field>
      <Field label="Jabatan" htmlFor="jabatan" error={galat.jabatan}>
        <Input id="jabatan" value={jabatan} onChange={(e) => setJabatan(e.target.value)} />
      </Field>
      <Field label="Status / golongan" htmlFor="status" hint="Menentukan batas hotel, uang representasi, dan kelas tiket.">
        <Select id="status" value={status} onChange={(e) => setStatus(e.target.value as StatusKode | '')}>
          <option value="">- belum dipilih -</option>
          {STATUS_KODE.map((k) => (
            <option key={k} value={k}>
              {STATUS_LABEL[k]}
            </option>
          ))}
        </Select>
      </Field>
      <DialogFooter>
        <Button variant="outline" onClick={() => onSelesai(null)}>
          Batal
        </Button>
        <Button type="submit" disabled={sibuk}>
          {sibuk ? 'Menyimpan...' : 'Simpan'}
        </Button>
      </DialogFooter>
    </form>
  )
}
```

`apps/web/src/components/st/rupiah-input.tsx`:
```tsx
import type { ComponentProps } from 'react'
import { formatAngka } from '@spjan/shared'

import { Input } from '@/components/ui/input'

/** Input angka rupiah dengan pemisah ribuan titik. Nilai kosong = null. */
export function RupiahInput({
  value,
  onChange,
  nolKosong = false,
  ...props
}: Omit<ComponentProps<typeof Input>, 'value' | 'onChange'> & {
  value: number | null | undefined
  onChange: (v: number | null) => void
  /** Tampilkan 0 sebagai kosong. */
  nolKosong?: boolean
}) {
  const tampil = value == null || (nolKosong && value === 0) ? '' : formatAngka(value)
  return (
    <Input
      inputMode="numeric"
      className="text-right tabular-nums"
      value={tampil}
      onChange={(e) => {
        const digit = e.target.value.replace(/\D/g, '')
        onChange(digit === '' ? null : Number(digit))
      }}
      {...props}
    />
  )
}
```

`apps/web/src/lib/validasi.ts`:
```ts
interface Isu {
  path: ReadonlyArray<PropertyKey>
  message: string
  code: string
  origin?: unknown
}

const LABEL: Record<string, string> = {
  nomor: 'Nomor surat tugas',
  tanggal: 'Tanggal surat tugas',
  tanggalSpj: 'Tanggal SPJ',
  kodeAkun: 'Kode akun',
  catatan: 'Catatan',
  nama: 'Nama',
  nip: 'NIP',
  jabatan: 'Jabatan',
  status: 'Status',
  noSpd: 'No. SPD',
  provinsi: 'Provinsi',
  kota: 'Kota',
  kegiatan: 'Kegiatan',
  berangkat: 'Tanggal berangkat',
  pulang: 'Tanggal pulang',
  hotelNama: 'Nama hotel',
  hotelTarif: 'Tarif hotel',
  malamOverride: 'Malam menginap',
  jenis: 'Jenis biaya',
  uraian: 'Uraian',
  qty: 'Jumlah',
  satuan: 'Satuan',
  tarif: 'Tarif',
  keterangan: 'Keterangan',
}

/** Mengubah isu validasi zod menjadi kalimat Indonesia dengan lokasi (Pelaksana 1 > Etape 2 > Tarif hotel). */
export function pesanValidasi(isu: ReadonlyArray<Isu>): string[] {
  return isu.map((i) => {
    const bagian: string[] = []
    const p = i.path
    for (let k = 0; k < p.length; k += 1) {
      const kunci = String(p[k])
      const berikut = p[k + 1]
      if ((kunci === 'pelaksana' || kunci === 'etape' || kunci === 'biaya') && typeof berikut === 'number') {
        bagian.push(`${kunci === 'pelaksana' ? 'Pelaksana' : kunci === 'etape' ? 'Etape' : 'Biaya'} ${berikut + 1}`)
        k += 1
      } else {
        bagian.push(LABEL[kunci] ?? kunci)
      }
    }
    const pesan = i.code === 'too_small' && i.origin === 'string' ? 'wajib diisi' : i.message
    return `${bagian.join(' > ')}: ${pesan}`
  })
}
```

- [ ] **Step 2: Ubah halaman Pegawai agar memakai FormPegawai**

Ganti `apps/web/src/pages/pegawai.tsx` dengan:
```tsx
import { useState } from 'react'
import { PencilIcon, PlusIcon, RotateCcwIcon, UserXIcon } from 'lucide-react'
import { toast } from 'sonner'
import { STATUS_LABEL, type PegawaiDto } from '@spjan/shared'

import { DataTable, type Kolom } from '@/components/data-table'
import { FormPegawai } from '@/components/pegawai-form'
import { PageHeader } from '@/components/page-header'
import { Alert } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { pesanGalat } from '@/lib/format'
import { usePegawai, usePegawaiMutations } from '@/lib/queries'

export default function PegawaiPage() {
  const [tampilNonaktif, setTampilNonaktif] = useState(false)
  const daftar = usePegawai(!tampilNonaktif)
  const { ubah, nonaktifkan } = usePegawaiMutations()
  const [dialog, setDialog] = useState<{ pegawai: PegawaiDto | null } | null>(null)

  async function nonaktif(p: PegawaiDto) {
    try {
      await nonaktifkan.mutateAsync(p.id)
      toast.success(`${p.nama} dinonaktifkan.`)
    } catch (error) {
      toast.error(pesanGalat(error))
    }
  }
  async function aktifkan(p: PegawaiDto) {
    try {
      await ubah.mutateAsync({ id: p.id, data: {} })
      toast.success(`${p.nama} diaktifkan kembali.`)
    } catch (error) {
      toast.error(pesanGalat(error))
    }
  }

  const kolom: Kolom<PegawaiDto>[] = [
    { judul: 'Nama', teks: (p) => p.nama, sel: (p) => <span className="font-medium">{p.nama}</span> },
    { judul: 'NIP', teks: (p) => p.nip, sel: (p) => <span className="tabular-nums">{p.nip}</span> },
    { judul: 'Jabatan', teks: (p) => p.jabatan, sel: (p) => p.jabatan || '-' },
    {
      judul: 'Status',
      teks: (p) => (p.status ? STATUS_LABEL[p.status] : ''),
      sel: (p) => (p.status ? <Badge>{STATUS_LABEL[p.status]}</Badge> : <Badge variant="warning">Belum dipilih</Badge>),
    },
    {
      judul: '',
      sel: (p) => (
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="icon" aria-label={`Ubah ${p.nama}`} onClick={() => setDialog({ pegawai: p })}>
            <PencilIcon />
          </Button>
          {p.aktif ? (
            <Button variant="ghost" size="icon" aria-label={`Nonaktifkan ${p.nama}`} onClick={() => nonaktif(p)}>
              <UserXIcon className="text-destructive" />
            </Button>
          ) : (
            <Button variant="ghost" size="icon" aria-label={`Aktifkan ${p.nama}`} onClick={() => aktifkan(p)}>
              <RotateCcwIcon />
            </Button>
          )}
        </div>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title="Pegawai"
        description="Data pegawai disimpan permanen dan dipilih saat menyusun surat tugas."
        actions={
          <>
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <input type="checkbox" checked={tampilNonaktif} onChange={(e) => setTampilNonaktif(e.target.checked)} />
              Tampilkan nonaktif
            </label>
            <Button onClick={() => setDialog({ pegawai: null })}>
              <PlusIcon /> Tambah pegawai
            </Button>
          </>
        }
      />
      {daftar.isError ? (
        <Alert variant="destructive">{pesanGalat(daftar.error)}</Alert>
      ) : (
        <DataTable
          kolom={kolom}
          baris={daftar.data ?? []}
          kosong={daftar.isPending ? 'Memuat...' : tampilNonaktif ? 'Tidak ada pegawai nonaktif.' : 'Belum ada pegawai.'}
        />
      )}

      <Dialog open={dialog !== null} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dialog?.pegawai ? 'Ubah pegawai' : 'Tambah pegawai'}</DialogTitle>
            <DialogDescription>NIP harus unik. Status dapat diubah kapan saja; surat tugas lama tidak ikut berubah.</DialogDescription>
          </DialogHeader>
          {dialog ? <FormPegawai awal={dialog.pegawai} onSelesai={() => setDialog(null)} /> : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}
```

- [ ] **Step 3: Tambah hook di queries.ts**

Ubah baris impor tipe pertama menjadi:
```ts
import type { PegawaiPayload, PengaturanPayload, StatusKode, StatusKonfigurasi, SuratTugasPayload } from '@spjan/shared'
```
dan tambahkan di akhir berkas:
```ts
export function useSuratTugas(id: number | undefined) {
  return useQuery({
    queryKey: keys.st(id ?? 0),
    queryFn: () => api.suratTugas.get(id as number),
    enabled: id !== undefined,
  })
}

export function useSimpanSuratTugas() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (v: { id: number | null; payload: SuratTugasPayload }) =>
      v.id === null ? api.suratTugas.create(v.payload) : api.suratTugas.replace(v.id, v.payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['st'] }),
  })
}
```

- [ ] **Step 4: Jalankan tsc, eslint, dan build**

Run (dari root): `npx tsc -b apps/web && npm run lint -w web && npm run build -w web`
Expected: tanpa galat.

- [ ] **Step 5: Periksa regresi halaman Pegawai**

Ikuti "Pemeriksaan peramban" (rencana 1C-1), buka `/pegawai`: tambah, ubah, dan batalkan pegawai tetap berfungsi seperti sebelumnya.

- [ ] **Step: Commit (minta persetujuan pengguna dulu)**

Tampilkan berkas dan ringkasan satu baris, tunggu "ya" eksplisit, baru jalankan:

```bash
git add apps/web/src/components/ui/textarea.tsx apps/web/src/components/pegawai-form.tsx apps/web/src/components/st/rupiah-input.tsx apps/web/src/lib/validasi.ts apps/web/src/pages/pegawai.tsx apps/web/src/lib/queries.ts
git commit -m "refactor(web): ekstrak FormPegawai dan tambah hook serta input rupiah untuk editor

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01WzvKDJwroXVpHhvv4xyAzM"
```

---

### Task 3: Formulir etape dan biaya

**Files:**
- Create: `apps/web/src/components/st/etape-form.tsx`, `apps/web/src/components/st/biaya-form.tsx`

**Interfaces:**
- Consumes: `RupiahInput` (Task 2); `ringkasEtape`, `jenisButuhProvinsi/Etape/Uraian`, `JENIS_BIAYA`, `JENIS_LABEL` (Task 1); tipe `EtapePayload`, `BiayaPayload`, `Peringatan`, `BarisBiaya`.
- Produces: `EtapeForm({ idAwal, nomor, etape, provinsi: string[], bolehRepresentasi, batasHotel: number|null, peringatan: Peringatan[], bisaHapus, onUbah(patch), onHapus() })` dengan id elemen `etape-<idAwal>-{prov|kota|brkt|plg|keg|hotel|tarif|malam}`; `BiayaForm({ biaya, etapeJumlah, etapeLabel(i), provinsi, baris: BarisBiaya|null|undefined, onUbah(patch), onHapus() })` yang menampilkan teks tercetak, jumlah, dan catatan pagu dari `baris`.

- [ ] **Step 1: Tulis komponen**

`apps/web/src/components/st/etape-form.tsx`:
```tsx
import { Trash2Icon } from 'lucide-react'
import { ringkasEtape, type EtapePayload, type Peringatan } from '@spjan/shared'

import { RupiahInput } from '@/components/st/rupiah-input'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { rupiah } from '@/lib/format'

export function EtapeForm({
  idAwal,
  nomor,
  etape,
  provinsi,
  bolehRepresentasi,
  batasHotel,
  peringatan,
  bisaHapus,
  onUbah,
  onHapus,
}: {
  /** Awalan id elemen agar unik di antara beberapa pelaksana. */
  idAwal: string
  nomor: number
  etape: EtapePayload
  provinsi: string[]
  bolehRepresentasi: boolean
  batasHotel: number | null
  peringatan: Peringatan[]
  bisaHapus: boolean
  onUbah: (patch: Partial<EtapePayload>) => void
  onHapus: () => void
}) {
  const { hari, malam } = ringkasEtape(etape)
  const id = (k: string) => `etape-${idAwal}-${k}`
  return (
    <div className="grid gap-3 rounded-lg border bg-muted/30 p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h4 className="text-sm font-semibold">Etape {nomor}</h4>
          {hari !== null ? (
            <Badge variant="muted">
              {hari} hari / {malam} malam
            </Badge>
          ) : null}
        </div>
        {bisaHapus ? (
          <Button variant="ghost" size="sm" onClick={onHapus} aria-label={`Hapus etape ${nomor}`}>
            <Trash2Icon className="text-destructive" /> Hapus etape
          </Button>
        ) : null}
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Provinsi tujuan" htmlFor={id('prov')}>
          <Select id={id('prov')} value={etape.provinsi} onChange={(e) => onUbah({ provinsi: e.target.value })}>
            <option value="">- pilih provinsi -</option>
            {provinsi.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Kota tujuan" htmlFor={id('kota')} hint="Dipakai pada uraian tiket.">
          <Input id={id('kota')} value={etape.kota} onChange={(e) => onUbah({ kota: e.target.value })} />
        </Field>
        <Field label="Berangkat" htmlFor={id('brkt')}>
          <Input id={id('brkt')} type="date" value={etape.berangkat} onChange={(e) => onUbah({ berangkat: e.target.value })} />
        </Field>
        <Field label="Pulang" htmlFor={id('plg')}>
          <Input id={id('plg')} type="date" value={etape.pulang} onChange={(e) => onUbah({ pulang: e.target.value })} />
        </Field>
      </div>
      <Field label="Kegiatan / tujuan (untuk uraian SPTB)" htmlFor={id('keg')}>
        <Textarea id={id('keg')} rows={2} value={etape.kegiatan} onChange={(e) => onUbah({ kegiatan: e.target.value })} />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Nama hotel" htmlFor={id('hotel')} className="lg:col-span-2">
          <Input id={id('hotel')} value={etape.hotelNama ?? ''} onChange={(e) => onUbah({ hotelNama: e.target.value || null })} />
        </Field>
        <Field
          label="Tarif hotel per malam"
          htmlFor={id('tarif')}
          hint={batasHotel !== null ? `Batas SBM ${rupiah(batasHotel)}` : undefined}
        >
          <RupiahInput id={id('tarif')} value={etape.hotelTarif} onChange={(v) => onUbah({ hotelTarif: v })} />
        </Field>
        <Field label="Malam menginap" htmlFor={id('malam')} hint="Kosong = otomatis.">
          <Input
            id={id('malam')}
            type="number"
            min={0}
            value={etape.malamOverride ?? ''}
            onChange={(e) => onUbah({ malamOverride: e.target.value === '' ? null : Number(e.target.value) })}
          />
        </Field>
      </div>
      {bolehRepresentasi ? (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={etape.dinasJabatan ?? false} onChange={(e) => onUbah({ dinasJabatan: e.target.checked })} />
          Perjalanan dinas jabatan (berhak uang representasi)
        </label>
      ) : null}
      {peringatan.length > 0 ? (
        <ul className="grid gap-1 text-xs text-destructive">
          {peringatan.map((p, i) => (
            <li key={i}>{p.pesan}</li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
```

`apps/web/src/components/st/biaya-form.tsx`:
```tsx
import { Trash2Icon } from 'lucide-react'
import {
  JENIS_BIAYA,
  JENIS_LABEL,
  jenisButuhEtape,
  jenisButuhProvinsi,
  jenisButuhUraian,
  type BarisBiaya,
  type BiayaPayload,
  type JenisBiaya,
} from '@spjan/shared'

import { RupiahInput } from '@/components/st/rupiah-input'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { rupiah } from '@/lib/format'

function Sel({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1 text-xs text-muted-foreground">
      {label}
      {children}
    </label>
  )
}

export function BiayaForm({
  biaya,
  etapeJumlah,
  etapeLabel,
  provinsi,
  baris,
  onUbah,
  onHapus,
}: {
  biaya: BiayaPayload
  etapeJumlah: number
  etapeLabel: (indeks: number) => string
  provinsi: string[]
  /** Baris hasil hitung untuk biaya ini (null/undefined bila tarif 0). */
  baris: BarisBiaya | null | undefined
  onUbah: (patch: Partial<BiayaPayload>) => void
  onHapus: () => void
}) {
  const perluProvinsi = jenisButuhProvinsi(biaya.jenis)
  const perluEtape = jenisButuhEtape(biaya.jenis) && etapeJumlah > 1
  const perluUraian = jenisButuhUraian(biaya.jenis)
  const uraianLabel =
    biaya.jenis === 'TRANSPORT_DARAT' || biaya.jenis === 'TRANSPORT_JAKARTA_SEKITAR' ? 'Kab/kota tujuan (persis PMK)' : 'Uraian'
  return (
    <div className="grid gap-2 rounded-lg border bg-card p-3">
      <div className="flex flex-wrap items-end gap-2">
        <Sel label="Jenis biaya">
          <Select className="w-64" value={biaya.jenis} onChange={(e) => onUbah({ jenis: e.target.value as JenisBiaya })}>
            {JENIS_BIAYA.map((j) => (
              <option key={j} value={j}>
                {JENIS_LABEL[j]}
              </option>
            ))}
          </Select>
        </Sel>
        {perluEtape ? (
          <Sel label="Untuk etape">
            <Select
              className="w-44"
              value={biaya.etapeIndex ?? ''}
              onChange={(e) => onUbah({ etapeIndex: e.target.value === '' ? null : Number(e.target.value) })}
            >
              <option value="">{biaya.jenis === 'TIKET_PERGI' ? 'Etape 1 (otomatis)' : 'Etape terakhir (otomatis)'}</option>
              {Array.from({ length: etapeJumlah }, (_, i) => (
                <option key={i} value={i}>
                  {etapeLabel(i)}
                </option>
              ))}
            </Select>
          </Sel>
        ) : null}
        {perluProvinsi ? (
          <Sel label="Provinsi (untuk pagu)">
            <Select className="w-48" value={biaya.provinsi ?? ''} onChange={(e) => onUbah({ provinsi: e.target.value || null })}>
              <option value="">- pilih -</option>
              {provinsi.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </Select>
          </Sel>
        ) : null}
        {perluUraian ? (
          <Sel label={uraianLabel}>
            <Input className="w-56" value={biaya.uraian ?? ''} onChange={(e) => onUbah({ uraian: e.target.value || null })} />
          </Sel>
        ) : null}
        <Sel label="Jumlah">
          <Input
            className="w-20 text-right"
            type="number"
            min={1}
            placeholder="1"
            value={biaya.qty ?? ''}
            onChange={(e) => onUbah({ qty: e.target.value === '' ? null : Number(e.target.value) })}
          />
        </Sel>
        <Sel label="Tarif / harga (Rp)">
          <RupiahInput className="w-36" nolKosong value={biaya.tarif} onChange={(v) => onUbah({ tarif: v ?? 0 })} />
        </Sel>
        <Sel label="Keterangan">
          <Input
            className="w-40"
            placeholder="Bukti terlampir"
            value={biaya.keterangan ?? ''}
            onChange={(e) => onUbah({ keterangan: e.target.value || null })}
          />
        </Sel>
        <Button variant="ghost" size="icon" onClick={onHapus} aria-label="Hapus biaya">
          <Trash2Icon className="text-destructive" />
        </Button>
      </div>
      {baris ? (
        <div className="flex flex-wrap items-baseline justify-between gap-2 text-xs">
          <span className="text-muted-foreground">
            Tercetak: <span className="text-foreground">{baris.uraian}</span>
            {baris.qty ? ` (${baris.qty} ${baris.satuan} @ ${rupiah(baris.tarif ?? 0)})` : ''}
          </span>
          <span className="font-medium tabular-nums">{rupiah(baris.jumlah)}</span>
        </div>
      ) : null}
      {baris?.catatan ? <p className="text-xs text-muted-foreground">{baris.catatan}</p> : null}
    </div>
  )
}
```

- [ ] **Step 2: Jalankan tsc, eslint, dan build**

Run (dari root): `npx tsc -b apps/web && npm run lint -w web && npm run build -w web`
Expected: tanpa galat (komponen belum dipakai halaman; diverifikasi di Task 4).

- [ ] **Step: Commit (minta persetujuan pengguna dulu)**

Tampilkan berkas dan ringkasan satu baris, tunggu "ya" eksplisit, baru jalankan:

```bash
git add apps/web/src/components/st/etape-form.tsx apps/web/src/components/st/biaya-form.tsx
git commit -m "feat(web): formulir etape dan biaya untuk editor surat tugas

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01WzvKDJwroXVpHhvv4xyAzM"
```

---

### Task 4: Kartu pelaksana, panel ringkasan, dan halaman editor

**Files:**
- Create: `apps/web/src/components/st/pelaksana-card.tsx`, `apps/web/src/components/st/ringkasan.tsx`, `apps/web/src/pages/st-editor.tsx`
- Modify: `apps/web/src/App.tsx`

**Interfaces:**
- Consumes: semua komponen Task 2-3; `useSuratTugas`, `useSimpanSuratTugas`, `useHapusSuratTugas`, `usePegawai`, `usePengaturan`, `useVersiSbm`, `useSbm`; `hitungSpj`, `toSpjInput`, `payloadDariDto`, `stKosong`, `pelaksanaKosong`, `pelaksanaDariPegawai`, `indeksBarisTransport`, `norm`.
- Produces: rute `/st/baru` dan `/st/:id` (editor), `/st/:id/dokumen` (halaman "segera hadir"). Editor: kartu surat tugas, satu `PelaksanaCard` per pelaksana (pilih/tambah pegawai, etape, biaya, subtotal, terbilang, peringatan), `RingkasanPanel` (total SPTB dan status tiap pelaksana), simpan (POST bila baru lalu pindah ke `/st/:id`, PUT bila sudah ada), hapus berkonfirmasi.

- [ ] **Step 1: Tulis komponen dan halaman**

`apps/web/src/components/st/pelaksana-card.tsx`:
```tsx
import { useState } from 'react'
import { PlusIcon, Trash2Icon, UserPlusIcon } from 'lucide-react'
import {
  STATUS_KODE,
  STATUS_LABEL,
  biayaKosong,
  etapeKosong,
  indeksBarisTransport,
  norm,
  pelaksanaDariPegawai,
  type BiayaPayload,
  type EtapePayload,
  type PegawaiDto,
  type PelaksanaHasil,
  type PelaksanaPayload,
  type Sbm,
  type StatusKode,
} from '@spjan/shared'

import { FormPegawai } from '@/components/pegawai-form'
import { BiayaForm } from '@/components/st/biaya-form'
import { EtapeForm } from '@/components/st/etape-form'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { rupiah } from '@/lib/format'

export function PelaksanaCard({
  nomor,
  p,
  hasil,
  sbm,
  pegawai,
  provinsi,
  onUbah,
  onHapus,
}: {
  nomor: number
  p: PelaksanaPayload
  hasil: PelaksanaHasil | undefined
  sbm: Sbm
  pegawai: PegawaiDto[]
  provinsi: string[]
  onUbah: (fn: (p: PelaksanaPayload) => PelaksanaPayload) => void
  onHapus: () => void
}) {
  const [dialogPegawai, setDialogPegawai] = useState(false)
  const id = (k: string) => `pel-${nomor}-${k}`
  const cfg = p.status ? sbm.statusKonfigurasi[p.status] : undefined
  const indeks = indeksBarisTransport(p.biaya)

  const ubahEtape = (i: number, patch: Partial<EtapePayload>) =>
    onUbah((x) => ({ ...x, etape: x.etape.map((e, j) => (j === i ? { ...e, ...patch } : e)) }))
  const ubahBiaya = (i: number, patch: Partial<BiayaPayload>) =>
    onUbah((x) => ({ ...x, biaya: x.biaya.map((b, j) => (j === i ? { ...b, ...patch } : b)) }))
  const tambahBiaya = (b: BiayaPayload) => onUbah((x) => ({ ...x, biaya: [...x.biaya, b] }))

  function tambahTiketPergi() {
    const sudah = p.biaya.filter((b) => b.jenis === 'TIKET_PERGI').length
    tambahBiaya({ ...biayaKosong('TIKET_PERGI'), etapeIndex: sudah < p.etape.length ? sudah : null })
  }

  const batasHotel = (e: EtapePayload): number | null => {
    if (!cfg) return null
    return sbm.penginapan[norm(e.provinsi)]?.[cfg.kolomHotel - 1] ?? null
  }

  const umum = hasil?.peringatan.filter((w) => w.etape === undefined) ?? []

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-2">
        <CardTitle>
          Pelaksana {nomor}
          {p.nama ? <span className="ml-2 font-normal text-muted-foreground">{p.nama}</span> : null}
        </CardTitle>
        <Button variant="ghost" size="sm" onClick={onHapus}>
          <Trash2Icon className="text-destructive" /> Hapus pelaksana
        </Button>
      </CardHeader>
      <CardContent className="grid gap-5">
        <section className="grid gap-3">
          <div className="flex flex-wrap items-end gap-2">
            <Field label="Pilih dari daftar pegawai" htmlFor={id('pil')} className="min-w-64 flex-1">
              <Select
                id={id('pil')}
                value={p.pegawaiId ?? ''}
                onChange={(e) => {
                  const dto = pegawai.find((g) => g.id === Number(e.target.value))
                  if (dto) onUbah((x) => pelaksanaDariPegawai(x, dto))
                  else onUbah((x) => ({ ...x, pegawaiId: null }))
                }}
              >
                <option value="">- ketik manual di bawah -</option>
                {pegawai.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.nama}
                  </option>
                ))}
              </Select>
            </Field>
            <Button variant="outline" onClick={() => setDialogPegawai(true)}>
              <UserPlusIcon /> Pegawai baru
            </Button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Nama (dengan gelar)" htmlFor={id('nama')} className="lg:col-span-2">
              <Input id={id('nama')} value={p.nama} onChange={(e) => onUbah((x) => ({ ...x, nama: e.target.value }))} />
            </Field>
            <Field label="NIP" htmlFor={id('nip')}>
              <Input id={id('nip')} inputMode="numeric" value={p.nip} onChange={(e) => onUbah((x) => ({ ...x, nip: e.target.value }))} />
            </Field>
            <Field label="No. SPD" htmlFor={id('spd')}>
              <Input id={id('spd')} value={p.noSpd ?? ''} onChange={(e) => onUbah((x) => ({ ...x, noSpd: e.target.value || null }))} />
            </Field>
            <Field label="Jabatan" htmlFor={id('jab')} className="lg:col-span-2">
              <Input id={id('jab')} value={p.jabatan} onChange={(e) => onUbah((x) => ({ ...x, jabatan: e.target.value }))} />
            </Field>
            <Field label="Status / golongan" htmlFor={id('status')} className="lg:col-span-2">
              <Select
                id={id('status')}
                value={p.status ?? ''}
                onChange={(e) => onUbah((x) => ({ ...x, status: (e.target.value || null) as StatusKode | null }))}
              >
                <option value="">- belum dipilih -</option>
                {STATUS_KODE.map((k) => (
                  <option key={k} value={k}>
                    {STATUS_LABEL[k]}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        </section>

        <section className="grid gap-3">
          <h3 className="text-sm font-semibold">Perjalanan (satu etape per kota tujuan)</h3>
          {p.etape.map((e, i) => (
            <EtapeForm
              key={i}
              idAwal={`${nomor}-${i + 1}`}
              nomor={i + 1}
              etape={e}
              provinsi={provinsi}
              bolehRepresentasi={(cfg?.barisRepresentasi ?? 0) > 0}
              batasHotel={batasHotel(e)}
              peringatan={hasil?.peringatan.filter((w) => w.etape === i) ?? []}
              bisaHapus={p.etape.length > 1}
              onUbah={(patch) => ubahEtape(i, patch)}
              onHapus={() =>
                onUbah((x) => ({
                  ...x,
                  etape: x.etape.filter((_, j) => j !== i),
                  biaya: x.biaya.map((b) => (b.etapeIndex != null && b.etapeIndex >= i ? { ...b, etapeIndex: b.etapeIndex === i ? null : b.etapeIndex - 1 } : b)),
                }))
              }
            />
          ))}
          <div>
            <Button variant="outline" size="sm" onClick={() => onUbah((x) => ({ ...x, etape: [...x.etape, etapeKosong()] }))}>
              <PlusIcon /> Tambah etape (kota lain)
            </Button>
          </div>
        </section>

        <section className="grid gap-3">
          <h3 className="text-sm font-semibold">Biaya transport dan biaya tambahan</h3>
          {p.biaya.length === 0 ? <p className="text-sm text-muted-foreground">Belum ada biaya. Tambahkan tiket, taksi, atau biaya lain.</p> : null}
          {p.biaya.map((b, i) => (
            <BiayaForm
              key={i}
              biaya={b}
              etapeJumlah={p.etape.length}
              etapeLabel={(k) => `Etape ${k + 1}${p.etape[k]?.kota ? ` - ${p.etape[k]?.kota}` : ''}`}
              provinsi={provinsi}
              baris={indeks[i] != null ? hasil?.transport[indeks[i] as number] : null}
              onUbah={(patch) => ubahBiaya(i, patch)}
              onHapus={() => onUbah((x) => ({ ...x, biaya: x.biaya.filter((_, j) => j !== i) }))}
            />
          ))}
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={tambahTiketPergi}>
              <PlusIcon /> Tiket pergi
            </Button>
            <Button variant="outline" size="sm" onClick={() => tambahBiaya(biayaKosong('TIKET_KEMBALI'))}>
              <PlusIcon /> Tiket kembali
            </Button>
            <Button variant="outline" size="sm" onClick={() => tambahBiaya(biayaKosong('TAKSI_KEDUDUKAN'))}>
              <PlusIcon /> Taksi dari kedudukan
            </Button>
            <Button variant="outline" size="sm" onClick={() => tambahBiaya(biayaKosong('LAINNYA'))}>
              <PlusIcon /> Biaya lain
            </Button>
          </div>
        </section>

        {hasil ? (
          <section className="grid gap-3 border-t pt-4">
            <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-4">
              {(
                [
                  ['Transport', hasil.totalTransport],
                  ['Uang harian', hasil.totalUangHarian],
                  ['Representasi', hasil.totalRepresentasi],
                  ['Penginapan', hasil.totalPenginapan],
                ] as const
              ).map(([label, nilai]) => (
                <div key={label}>
                  <dt className="text-xs text-muted-foreground">{label}</dt>
                  <dd className="tabular-nums">{rupiah(nilai)}</dd>
                </div>
              ))}
            </dl>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="text-sm text-muted-foreground">{hasil.terbilang}</span>
              <span className="text-lg font-semibold tabular-nums">{rupiah(hasil.total)}</span>
            </div>
            {umum.length > 0 ? (
              <Alert variant="warning">
                <ul className="grid gap-0.5">
                  {umum.map((w, i) => (
                    <li key={i}>{w.pesan}</li>
                  ))}
                </ul>
              </Alert>
            ) : null}
            {hasil.catatan.length > 0 ? (
              <ul className="grid gap-0.5 text-xs text-muted-foreground">
                {hasil.catatan.map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>
            ) : null}
          </section>
        ) : null}
      </CardContent>

      <Dialog open={dialogPegawai} onOpenChange={setDialogPegawai}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Pegawai baru</DialogTitle>
            <DialogDescription>Disimpan permanen di daftar pegawai dan langsung dipakai pada pelaksana ini.</DialogDescription>
          </DialogHeader>
          <FormPegawai
            awal={null}
            onSelesai={(dto) => {
              if (dto) onUbah((x) => pelaksanaDariPegawai(x, dto))
              setDialogPegawai(false)
            }}
          />
        </DialogContent>
      </Dialog>
    </Card>
  )
}
```

`apps/web/src/components/st/ringkasan.tsx`:
```tsx
import type { SpjHasil } from '@spjan/shared'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { rupiah } from '@/lib/format'

/** Panel total keseluruhan dan status per pelaksana. */
export function RingkasanPanel({ hasil }: { hasil: SpjHasil }) {
  const jumlahPeringatan = hasil.pelaksana.reduce((n, p) => n + p.peringatan.length, 0)
  return (
    <Card className="lg:sticky lg:top-6">
      <CardContent className="grid gap-4">
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Total SPTB</p>
          <p className="text-2xl font-semibold tabular-nums">{rupiah(hasil.total)}</p>
          <p className="mt-1 text-xs text-muted-foreground">{hasil.terbilang}</p>
        </div>
        <div className="grid gap-2 border-t pt-3">
          {hasil.pelaksana.length === 0 ? <p className="text-sm text-muted-foreground">Belum ada pelaksana.</p> : null}
          {hasil.pelaksana.map((p, i) => (
            <div key={i} className="flex items-start justify-between gap-2 text-sm">
              <div className="min-w-0">
                <p className="truncate font-medium">{p.nama || `Pelaksana ${i + 1}`}</p>
                {p.peringatan.length > 0 ? (
                  <Badge variant="destructive">{p.peringatan.length} perlu diperiksa</Badge>
                ) : (
                  <Badge variant="success">Lengkap</Badge>
                )}
              </div>
              <span className="tabular-nums">{rupiah(p.total)}</span>
            </div>
          ))}
        </div>
        {jumlahPeringatan > 0 ? (
          <p className="text-xs text-destructive">{jumlahPeringatan} peringatan data. Lengkapi sebelum mencetak dokumen.</p>
        ) : hasil.pelaksana.length > 0 ? (
          <p className="text-xs text-success">Semua data lengkap.</p>
        ) : null}
      </CardContent>
    </Card>
  )
}
```

`apps/web/src/pages/st-editor.tsx`:
```tsx
import { useEffect, useMemo, useState } from 'react'
import { FileTextIcon, PlusIcon, SaveIcon, Trash2Icon } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import {
  SuratTugasPayloadSchema,
  hitungSpj,
  payloadDariDto,
  pelaksanaKosong,
  stKosong,
  toSpjInput,
  type PelaksanaPayload,
  type PengaturanPayload,
  type Sbm,
  type SuratTugasPayload,
} from '@spjan/shared'

import { PageHeader } from '@/components/page-header'
import { PelaksanaCard } from '@/components/st/pelaksana-card'
import { RingkasanPanel } from '@/components/st/ringkasan'
import { Alert } from '@/components/ui/alert'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { pesanGalat } from '@/lib/format'
import {
  useHapusSuratTugas,
  usePegawai,
  usePengaturan,
  useSbm,
  useSimpanSuratTugas,
  useSuratTugas,
  useVersiSbm,
} from '@/lib/queries'
import { pesanValidasi } from '@/lib/validasi'

function Editor({ id, awal, sbm, pengaturan }: { id: number | null; awal: SuratTugasPayload; sbm: Sbm; pengaturan: PengaturanPayload }) {
  const navigate = useNavigate()
  const pegawai = usePegawai(true)
  const simpan = useSimpanSuratTugas()
  const hapus = useHapusSuratTugas()
  const [st, setSt] = useState<SuratTugasPayload>(awal)
  const [baseline, setBaseline] = useState(() => JSON.stringify(awal))
  const [galat, setGalat] = useState<string[]>([])
  const [dialogHapus, setDialogHapus] = useState(false)
  const kotor = JSON.stringify(st) !== baseline

  useEffect(() => {
    if (!kotor) return
    const cegah = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', cegah)
    return () => window.removeEventListener('beforeunload', cegah)
  }, [kotor])

  const hasil = useMemo(() => hitungSpj(toSpjInput(st, pengaturan), sbm), [st, pengaturan, sbm])
  const provinsi = useMemo(() => Object.keys(sbm.uangHarian), [sbm])

  const ubahSt = (patch: Partial<SuratTugasPayload>) => setSt((s) => ({ ...s, ...patch }))
  const ubahPelaksana = (i: number, fn: (p: PelaksanaPayload) => PelaksanaPayload) =>
    setSt((s) => ({ ...s, pelaksana: s.pelaksana.map((p, j) => (j === i ? fn(p) : p)) }))

  async function kirim() {
    const cek = SuratTugasPayloadSchema.safeParse(st)
    if (!cek.success) {
      const pesan = pesanValidasi(cek.error.issues)
      setGalat(pesan)
      toast.error('Ada isian yang belum benar.')
      return
    }
    setGalat([])
    try {
      const dto = await simpan.mutateAsync({ id, payload: cek.data })
      setBaseline(JSON.stringify(st))
      toast.success('Surat tugas disimpan.')
      if (id === null) navigate(`/st/${dto.id}`, { replace: true })
    } catch (error) {
      setGalat([pesanGalat(error)])
    }
  }

  async function konfirmasiHapus() {
    if (id === null) return
    try {
      await hapus.mutateAsync(id)
      toast.success('Surat tugas dihapus.')
      navigate('/', { replace: true })
    } catch (error) {
      toast.error(pesanGalat(error))
      setDialogHapus(false)
    }
  }

  return (
    <div>
      <PageHeader
        title={id === null ? 'Surat tugas baru' : st.nomor || 'Surat tugas'}
        description={kotor ? 'Ada perubahan yang belum disimpan.' : id === null ? 'Isi data lalu simpan.' : 'Tersimpan.'}
        actions={
          <>
            {id !== null ? (
              <>
                <Button variant="ghost" onClick={() => setDialogHapus(true)}>
                  <Trash2Icon className="text-destructive" /> Hapus
                </Button>
                <Link
                  to={`/st/${id}/dokumen`}
                  className={buttonVariants({ variant: 'outline' })}
                  aria-disabled={kotor}
                  onClick={(e) => {
                    if (kotor) {
                      e.preventDefault()
                      toast.info('Simpan perubahan dulu sebelum membuka dokumen.')
                    }
                  }}
                >
                  <FileTextIcon className="size-4" /> Dokumen
                </Link>
              </>
            ) : null}
            <Button onClick={kirim} disabled={simpan.isPending || (!kotor && id !== null)}>
              <SaveIcon /> {simpan.isPending ? 'Menyimpan...' : 'Simpan'}
            </Button>
          </>
        }
      />

      {galat.length > 0 ? (
        <Alert variant="destructive" className="mb-5">
          <p className="mb-1 font-medium">Belum bisa disimpan:</p>
          <ul className="list-inside list-disc">
            {galat.map((g, i) => (
              <li key={i}>{g}</li>
            ))}
          </ul>
        </Alert>
      ) : null}

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Surat tugas</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <Field label="Nomor surat tugas" htmlFor="st-nomor" className="sm:col-span-2">
                <Input id="st-nomor" value={st.nomor} onChange={(e) => ubahSt({ nomor: e.target.value })} placeholder="ST.226/PPS/PEMPS/PSL.04.02/B/09/2026" />
              </Field>
              <Field label="Tanggal surat tugas" htmlFor="st-tanggal">
                <Input id="st-tanggal" type="date" value={st.tanggal} onChange={(e) => ubahSt({ tanggal: e.target.value })} />
              </Field>
              <Field label="Tanggal SPJ (tanggal dokumen)" htmlFor="st-spj" hint="Boleh kosong; dilengkapi saat dokumen dicetak.">
                <Input id="st-spj" type="date" value={st.tanggalSpj ?? ''} onChange={(e) => ubahSt({ tanggalSpj: e.target.value || null })} />
              </Field>
              <Field label="Kode akun (mata anggaran)" htmlFor="st-akun" className="sm:col-span-2">
                <Input id="st-akun" value={st.kodeAkun} onChange={(e) => ubahSt({ kodeAkun: e.target.value })} />
              </Field>
              <Field label="Catatan" htmlFor="st-catatan" className="sm:col-span-2">
                <Textarea id="st-catatan" rows={2} value={st.catatan} onChange={(e) => ubahSt({ catatan: e.target.value })} />
              </Field>
            </CardContent>
          </Card>

          {st.pelaksana.map((p, i) => (
            <PelaksanaCard
              key={i}
              nomor={i + 1}
              p={p}
              hasil={hasil.pelaksana[i]}
              sbm={sbm}
              pegawai={pegawai.data ?? []}
              provinsi={provinsi}
              onUbah={(fn) => ubahPelaksana(i, fn)}
              onHapus={() => setSt((s) => ({ ...s, pelaksana: s.pelaksana.filter((_, j) => j !== i) }))}
            />
          ))}
          <div>
            <Button variant="outline" onClick={() => setSt((s) => ({ ...s, pelaksana: [...s.pelaksana, pelaksanaKosong()] }))}>
              <PlusIcon /> Tambah pelaksana
            </Button>
          </div>
        </div>
        <RingkasanPanel hasil={hasil} />
      </div>

      <Dialog open={dialogHapus} onOpenChange={setDialogHapus}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hapus surat tugas?</DialogTitle>
            <DialogDescription>{st.nomor} beserta seluruh pelaksana, etape, dan biayanya akan dihapus permanen.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogHapus(false)}>
              Batal
            </Button>
            <Button variant="destructive" onClick={konfirmasiHapus} disabled={hapus.isPending}>
              {hapus.isPending ? 'Menghapus...' : 'Hapus'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

/** Memuat data yang dibutuhkan lalu menampilkan editor; `key` memastikan state direset saat berpindah surat tugas. */
export default function StEditorPage() {
  const { id: idParam } = useParams()
  const id = idParam === undefined ? null : Number(idParam)
  const idValid = id === null || (Number.isInteger(id) && id > 0)
  const pengaturan = usePengaturan()
  const versi = useVersiSbm()
  const st = useSuratTugas(id ?? undefined)
  const versiId = id === null ? versi.data?.[0]?.id : st.data?.versiSbmId
  const sbm = useSbm(versiId)

  if (!idValid) return <Alert variant="destructive">Alamat surat tugas tidak valid.</Alert>
  const galat = pengaturan.error ?? versi.error ?? st.error ?? sbm.error
  if (galat) return <Alert variant="destructive">{pesanGalat(galat)}</Alert>
  if (!pengaturan.data || !sbm.data || (id !== null && !st.data)) {
    return <p className="text-sm text-muted-foreground">Memuat...</p>
  }
  const awal: SuratTugasPayload = st.data ? payloadDariDto(st.data) : stKosong(pengaturan.data.kodeAkunDefault)
  return <Editor key={id ?? 'baru'} id={id} awal={awal} sbm={sbm.data.data} pengaturan={pengaturan.data} />
}
```

- [ ] **Step 2: Daftarkan rute**

`apps/web/src/App.tsx`:
```tsx
import { Route, Routes } from 'react-router-dom'

import { AppShell } from '@/components/app-shell'
import { RequireAuth } from '@/components/require-auth'
import LoginPage from '@/pages/login'
import PegawaiPage from '@/pages/pegawai'
import PengaturanPage from '@/pages/pengaturan'
import SbmPage from '@/pages/sbm'
import StEditorPage from '@/pages/st-editor'
import SuratTugasListPage from '@/pages/st-list'
import { NotFoundPage, SegeraPage } from '@/pages/placeholder'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<RequireAuth />}>
        <Route element={<AppShell />}>
          <Route index element={<SuratTugasListPage />} />
          <Route path="st/baru" element={<StEditorPage />} />
          <Route path="st/:id" element={<StEditorPage />} />
          <Route path="st/:id/dokumen" element={<SegeraPage judul="Dokumen" />} />
          <Route path="pegawai" element={<PegawaiPage />} />
          <Route path="pengaturan" element={<PengaturanPage />} />
          <Route path="sbm" element={<SbmPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Route>
    </Routes>
  )
}
```

- [ ] **Step 3: Jalankan tsc, eslint, dan build**

Run (dari root): `npx tsc -b apps/web && npm run lint -w web && npm run build -w web`
Expected: tanpa galat.

- [ ] **Step 4: Verifikasi skenario Resa di peramban**

Ikuti "Pemeriksaan peramban" (rencana 1C-1) dengan database kosong, lalu jalankan skrip ini dari folder sementara (`npm i playwright-core`):
```js
// editor.mjs - jalankan dari folder sementara dengan playwright-core terpasang
import { chromium } from 'playwright-core'
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox'] })
const page = await browser.newPage({ viewport: { width: 1360, height: 900 } })
const errors = []
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message))
await page.goto('http://localhost:5173/login')
await page.fill('#username', 'admin'); await page.fill('#password', 'sandi-dev-12345'); await page.click('button[type=submit]')
await page.waitForURL('http://localhost:5173/')
await page.click('text=Surat tugas baru'); await page.waitForURL('**/st/baru')
await page.fill('#st-nomor', 'ST.226/PPS/PEMPS/PSL.04.02/B/09/2026'); await page.fill('#st-tanggal', '2026-09-08')
await page.click('button:has-text("Tambah pelaksana")')
await page.click('button:has-text("Pegawai baru")')
await page.fill('[role=dialog] #nama', 'R Resa Adam Gunawan, S.T.'); await page.fill('[role=dialog] #nip', '199508222023211008')
await page.fill('[role=dialog] #jabatan', 'Surveyor Pemetaan Ahli Pertama'); await page.selectOption('[role=dialog] #status', 'ESELON_IV_GOL_III_II_I')
await page.click('[role=dialog] button:has-text("Simpan")'); await page.waitForTimeout(1500)
await page.fill('#pel-1-spd', '403/SPD/PPS/2026')
await page.selectOption('#etape-1-1-prov', 'BALI'); await page.fill('#etape-1-1-kota', 'Denpasar')
await page.fill('#etape-1-1-keg', 'Pendampingan Audiensi terkait Rencana Pembongkaran Homestay pada areal kerja Persetujuan Pengelolaan Perhutanan Sosial di Kota Denpasar Provinsi Bali')
await page.fill('#etape-1-1-brkt', '2026-09-10'); await page.fill('#etape-1-1-plg', '2026-09-11')
await page.fill('#etape-1-1-hotel', 'Kuto Paradiso Hotel'); await page.fill('#etape-1-1-tarif', '1021948')
await page.click('button:has-text("Tiket pergi")'); await page.click('button:has-text("Tiket kembali")'); await page.click('button:has-text("Taksi dari kedudukan")')
const tarif = page.getByLabel('Tarif / harga (Rp)')
await tarif.nth(0).fill('2260940'); await tarif.nth(1).fill('2223091'); await tarif.nth(2).fill('250000')
await page.getByLabel('Jumlah', { exact: true }).nth(2).fill('2')
await page.waitForTimeout(400)
console.log('total panel:', (await page.locator('text=Total SPTB').locator('..').innerText()).replace(/\n/g, ' | '))
await page.click('button:has-text("Simpan")'); await page.waitForURL(/\/st\/\d+$/); await page.waitForTimeout(800)
await page.reload(); await page.waitForTimeout(1200)
console.log('total setelah reload:', (await page.locator('text=Total SPTB').locator('..').innerText()).replace(/\n/g, ' | '))
await page.fill('#etape-1-1-tarif', '1200000'); await page.waitForTimeout(300)
console.log('peringatan:', (await page.locator('li:has-text("melebihi batas")').allInnerTexts()).join(' / '))
console.log('errors:', JSON.stringify(errors))
await browser.close()
```
Expected (dalam keluaran): `total panel:` memuat `Rp6.965.979` dan `Enam Juta Sembilan Ratus Enam Puluh Lima Ribu Sembilan Ratus Tujuh Puluh Sembilan Rupiah`; `total setelah reload:` sama (data tersimpan di server); `peringatan:` `Etape 1: tarif hotel Rp1.200.000 melebihi batas SBM Rp1.138.000.`; `errors: []`.
Periksa juga secara manual: etape kedua (kota lain) menambah baris uang harian dan pilihan "Untuk etape" pada tiket; mengisi status Eselon II memunculkan kotak "Perjalanan dinas jabatan"; tombol Dokumen nonaktif (menampilkan info) saat ada perubahan belum disimpan.

- [ ] **Step: Commit (minta persetujuan pengguna dulu)**

Tampilkan berkas dan ringkasan satu baris, tunggu "ya" eksplisit, baru jalankan:

```bash
git add apps/web/src/components/st/pelaksana-card.tsx apps/web/src/components/st/ringkasan.tsx apps/web/src/pages/st-editor.tsx apps/web/src/App.tsx
git commit -m "feat(web): editor surat tugas dengan hitungan langsung

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01WzvKDJwroXVpHhvv4xyAzM"
```

---

## Self-Review

1. **Cakupan spec:** bagian 7 (editor ST satu halaman: header ST, kartu per pelaksana dengan etape dan biaya, panel total dan peringatan langsung; pegawai bisa ditambah dari editor; dropdown provinsi dan status) = Task 1-4; bagian 5 (aturan hitung ditampilkan: hari/malam, batas hotel, catatan pagu, representasi, kelas tiket, terbilang) lewat `hitungSpj` tanpa menduplikasi logika; autosimpan diganti tombol Simpan + peringatan `beforeunload` (dicatat di Global Constraints). Dokumen PDF dan pratinjau = rencana 1C-3.
2. **Placeholder:** tidak ada; semua langkah memuat isi berkas lengkap dan keluaran yang diharapkan.
3. **Konsistensi tipe:** nama dan tanda tangan pada blok Interfaces sama dengan berkas; `PelaksanaCard` memanggil `EtapeForm` dengan `idAwal` dan `BiayaForm` dengan `baris` hasil `indeksBarisTransport`; jumlah tes shared 60 sesuai berkas.
