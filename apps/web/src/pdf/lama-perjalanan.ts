import { angkaKata, parseTanggal, selisihHari, tanggalIndonesia, type EtapePayload } from '@spjan/shared'

/**
 * Lama, tanggal berangkat, dan tanggal kembali untuk SPD. Berangkat dari tujuan pertama yang bertanggal;
 * kembali dari tanggal pulang (atau berangkat) terakhir yang valid, sehingga tujuan tambahan yang tanggalnya
 * belum diisi tidak mengosongkan hasilnya. Tanpa tanggal valid, semuanya "-".
 */
export function lamaPerjalanan(etape: Pick<EtapePayload, 'berangkat' | 'pulang'>[] = []): { lama: string; berangkat: string; kembali: string } {
  const awal = etape.map((x) => x.berangkat).find((t) => parseTanggal(t))
  const akhir = [...etape].reverse().map((x) => (parseTanggal(x.pulang) ? x.pulang : x.berangkat)).find((t) => parseTanggal(t))
  const a = parseTanggal(awal)
  const b = parseTanggal(akhir)
  if (!a || !b) return { lama: '-', berangkat: tanggalIndonesia(awal) || '-', kembali: tanggalIndonesia(akhir) || '-' }
  const durasi = selisihHari(a, b) + 1
  return {
    lama: durasi > 0 ? `${durasi} (${angkaKata(durasi)}) hari` : '-',
    berangkat: tanggalIndonesia(awal),
    kembali: tanggalIndonesia(akhir),
  }
}
