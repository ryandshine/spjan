import { z } from "zod";

/** Kolom hasil baca yang menurut model perlu dicek manusia (ditebak, buram, terpotong, atau tidak tertera). */
export const PerluDicekSchema = z.object({
  kolom: z.string().trim().min(1).max(60),
  alasan: z.string().trim().min(1).max(200),
});
export type PerluDicek = z.infer<typeof PerluDicekSchema>;

/**
 * Bidang opsional `perluDicek` untuk semua skema hasil ekstraksi. Isian yang tidak sesuai bentuk diabaikan
 * (jadi `undefined`), supaya catatan pendamping ini tidak pernah menggagalkan hasil baca utama.
 */
export const bidangPerluDicek = z.array(PerluDicekSchema).max(10).optional().catch(undefined);

/** Gabungkan `perluDicek` dari beberapa potongan hasil (mis. tiket multi-segmen) tanpa duplikat. */
export function gabungPerluDicek(items: unknown[]): PerluDicek[] | undefined {
  const hasil: PerluDicek[] = [];
  const kunci = new Set<string>();
  for (const it of items) {
    const daftar = bidangPerluDicek.parse((it as { perluDicek?: unknown } | null)?.perluDicek);
    for (const p of daftar ?? []) {
      const k = `${p.kolom}|${p.alasan}`;
      if (!kunci.has(k)) {
        kunci.add(k);
        hasil.push(p);
      }
    }
  }
  return hasil.length > 0 ? hasil.slice(0, 10) : undefined;
}

/** Label kolom yang dibaca pengguna; kolom lain ditampilkan apa adanya. */
const LABEL_KOLOM: Record<string, string> = {
  nomor: "Nomor",
  tanggal: "Tanggal",
  kegiatan: "Kegiatan",
  pelaksana: "Pelaksana",
  nama: "Nama",
  nip: "NIP",
  jabatan: "Jabatan",
  etape: "Jadwal perjalanan",
  tujuan: "Tujuan",
  tanggalBerangkat: "Tanggal berangkat",
  tanggalKembali: "Tanggal kembali",
  namaHotel: "Nama hotel",
  nomorInvoice: "Nomor invoice",
  tamu: "Tamu",
  checkIn: "Check-in",
  checkOut: "Check-out",
  jumlahMalam: "Jumlah malam",
  tarifPerMalam: "Tarif per malam",
  totalBiaya: "Total biaya",
  moda: "Moda",
  maskapai: "Maskapai/operator",
  kodeBooking: "Kode booking",
  nomorTiket: "Nomor tiket",
  penumpang: "Penumpang",
  daftarPenumpang: "Daftar penumpang",
  asal: "Asal",
  jam: "Jam",
  nomorPenerbangan: "Nomor penerbangan",
  tarif: "Tarif",
  basisTarif: "Basis tarif",
  arah: "Arah",
  segmen: "Segmen",
  kategori: "Kategori",
  penyedia: "Penyedia",
  nomorKuitansi: "Nomor kuitansi",
  uraian: "Uraian",
};

/** `pelaksana[2].nip` -> "Pelaksana ke-3, NIP"; nama kolom yang tidak dikenal ditampilkan apa adanya. */
export function labelKolom(kolom: string): string {
  return kolom
    .split(".")
    .map((bagian) => {
      const m = /^(\w+)\[(\d+)\]$/.exec(bagian);
      if (m) return `${LABEL_KOLOM[m[1]!] ?? m[1]} ke-${Number(m[2]) + 1}`;
      return LABEL_KOLOM[bagian] ?? bagian;
    })
    .join(", ");
}

/** Catatan model sebagai baris peringatan usulan: "Perlu dicek: Total biaya (angka terpotong di foto)". */
export function pesanPerluDicek(daftar: PerluDicek[] | undefined): string[] {
  return (daftar ?? []).map((p) => `Perlu dicek: ${labelKolom(p.kolom)} (${p.alasan}).`);
}
