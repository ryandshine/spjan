import { norm, provinsiDariKotaJabodetabek, type Sbm } from '@spjan/shared'

/**
 * Saran kota tujuan: ibukota provinsi terpilih (tabel SBM hanya memuat tarif dari ibukota ke kab/kota, jadi ibukota sendiri tidak muncul
 * sebagai baris; namanya dipakai apa adanya agar cocok dengan tabel tiket), lalu kab/kota provinsi itu menurut SBM (transport ibukota-kab).
 * Tanpa provinsi, daftar Jakarta-sekitarnya.
 */
export function saranKota(sbm: Sbm | undefined, provinsi: string): string[] {
  if (!sbm) return []
  if (!provinsi) return sbm.transportJakarta.map((t) => t.kabKota)
  const kunci = norm(provinsi)
  const baris = sbm.transportIbukota.filter((r) => r.provinsi === kunci)
  const ibukota = [...new Set(baris.map((r) => r.ibukota))]
  if (kunci === 'D.K.I. JAKARTA') ibukota.push('Jakarta')
  const dariJakarta = sbm.transportJakarta.filter((t) => norm(provinsiDariKotaJabodetabek(t.kabKota) ?? '') === kunci).map((t) => t.kabKota)
  const lainnya = [...new Set([...baris.map((r) => r.kabKota), ...dariJakarta])].filter((k) => !ibukota.includes(k)).sort((a, b) => a.localeCompare(b, 'id'))
  return [...ibukota, ...lainnya]
}

/** Pesan peringatan bila kota terisi tetapi tidak ada dalam daftar saran provinsinya; undefined bila wajar (kosong, atau daftar tidak tersedia). */
export function peringatanKotaKedudukan(sbm: Sbm | undefined, provinsi: string, kota: string | null | undefined): string | undefined {
  const nama = norm(kota ?? '')
  if (!nama || !provinsi) return undefined
  const daftar = saranKota(sbm, provinsi)
  if (daftar.length === 0 || daftar.some((k) => norm(k) === nama)) return undefined
  return 'Kota tidak ada dalam daftar provinsi ini; pastikan benar.'
}
