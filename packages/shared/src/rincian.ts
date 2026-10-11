import type { PelaksanaHasil } from "./types.js";

type TotalPelaksana = Pick<PelaksanaHasil, "totalTransport" | "totalUangHarian" | "totalRepresentasi" | "totalPenginapan" | "totalPengeluaranRiil">;

/** Rincian biaya seluruh pelaksana per komponen; pengeluaran riil hanya muncul bila ada. */
export function rincianTotal(pelaksana: ReadonlyArray<TotalPelaksana>): Array<{ label: string; nilai: number }> {
  const jumlah = (ambil: (p: TotalPelaksana) => number) => pelaksana.reduce((n, p) => n + ambil(p), 0);
  const baris = [
    { label: "Transport", nilai: jumlah((p) => p.totalTransport) },
    { label: "Penginapan", nilai: jumlah((p) => p.totalPenginapan) },
    { label: "Uang harian", nilai: jumlah((p) => p.totalUangHarian) },
    { label: "Representasi", nilai: jumlah((p) => p.totalRepresentasi) },
  ];
  const riil = jumlah((p) => p.totalPengeluaranRiil);
  return riil > 0 ? [...baris, { label: "Pengeluaran riil", nilai: riil }] : baris;
}
