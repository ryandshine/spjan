import { formatRp, norm } from "./teks.js";
import type { BiayaInput, Sbm, StatusKode } from "./types.js";

export interface PaguBiaya {
  /** false = jenis ini memang tidak punya pagu di PMK (biaya riil). */
  adaPagu: boolean;
  /** null = pagu ada tetapi tujuan/provinsi tidak ditemukan di tabel PMK. */
  nilai: number | null;
}

const TANPA_PAGU: PaguBiaya = { adaPagu: false, nilai: null };

function ada(nilai: number | null | undefined): PaguBiaya {
  return { adaPagu: true, nilai: nilai === undefined || nilai === 0 ? null : nilai };
}

/** Pagu PMK per satuan untuk satu biaya; tiket pesawat ditangani terpisah (lihat paguTiket). */
export function paguBiaya(sbm: Sbm, biaya: BiayaInput, provinsiKedudukan: string): PaguBiaya {
  const prov = norm(biaya.provinsi ?? "");
  const uraian = norm(biaya.uraian ?? "");
  switch (biaya.jenis) {
    case "TRANSPORT_DARAT":
      return ada(sbm.transportIbukota.find((r) => r.provinsi === prov && norm(r.kabKota) === uraian)?.besaran);
    case "TRANSPORT_JAKARTA_SEKITAR":
      return ada(sbm.transportJakarta.find((r) => norm(r.kabKota) === uraian)?.besaran);
    case "TRANSPORT_KEGIATAN_PP":
      return ada(sbm.transportKegiatanPp);
    case "TAKSI_KEDUDUKAN":
      return ada(sbm.terminal[norm(provinsiKedudukan)]);
    case "TAKSI_TERMINAL":
      return ada(sbm.terminal[prov]);
    case "SEWA_RODA4":
      return ada(sbm.sewaKendaraan[prov]?.roda4);
    case "SEWA_RODA6":
      return ada(sbm.sewaKendaraan[prov]?.roda6BusSedang);
    case "SEWA_BUS_BESAR":
      return ada(sbm.sewaKendaraan[prov]?.busBesar);
    default:
      return TANPA_PAGU;
  }
}

/** Catatan informatif; undefined bila tidak perlu (tiket ditangani terpisah). */
export function catatanBiaya(sbm: Sbm, biaya: BiayaInput, provinsiKedudukan: string): string | undefined {
  if (biaya.jenis === "TIKET_PERGI" || biaya.jenis === "TIKET_KEMBALI") return undefined;
  const pagu = paguBiaya(sbm, biaya, provinsiKedudukan);
  if (!pagu.adaPagu) return "Tidak ada pagu di PMK: biaya riil, lampirkan bukti.";
  if (pagu.nilai === null) return "Tujuan/provinsi tidak ditemukan di tabel PMK (harga pasar/at cost).";
  if (biaya.tarif > pagu.nilai) {
    return `Tarif ${formatRp(biaya.tarif)} melebihi pagu PMK ${formatRp(pagu.nilai)} per satuan (dapat dilampaui bila riil; lampirkan bukti).`;
  }
  return `Tarif dalam pagu PMK ${formatRp(pagu.nilai)}.`;
}

/** Pagu tiket PP (Jakarta/kedudukan ke kota tujuan) menurut kelas; null bila rute tidak ada di tabel. */
export function paguTiket(sbm: Sbm, asal: string, tujuan: string, kelas: "Bisnis" | "Ekonomi"): number | null {
  const baris = sbm.tiketPp.find((r) => r.asal === norm(asal) && r.tujuan === norm(tujuan));
  if (!baris) return null;
  return kelas === "Bisnis" ? baris.bisnis : baris.ekonomi;
}

/**
 * Tarif uang saku rapat/pertemuan di luar kantor (Fullboard) per hari sesuai SBM PMK 32/2025.
 * @param status Status / golongan kepegawaian
 * @param luarKota default true (karena perjalanan dinas luar kota)
 */
export function tarifUangSakuFullboard(status: StatusKode | null | undefined, luarKota = true): number {
  if (luarKota) {
    switch (status) {
      case "PEJABAT_NEGARA_WAMEN":
        return 300_000;
      case "ESELON_I":
        return 250_000;
      case "ESELON_II":
        return 180_000;
      case "ESELON_III_GOL_IV":
      case "ESELON_IV_GOL_III_II_I":
      default:
        return 130_000;
    }
  } else {
    // Dalam kota
    switch (status) {
      case "PEJABAT_NEGARA_WAMEN":
        return 200_000;
      case "ESELON_I":
        return 170_000;
      case "ESELON_II":
        return 150_000;
      case "ESELON_III_GOL_IV":
      case "ESELON_IV_GOL_III_II_I":
      default:
        return 120_000;
    }
  }
}
