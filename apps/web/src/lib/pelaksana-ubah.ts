import {
  biayaKosong,
  cocokkanKotaJakartaSekitar,
  isKotaJabodetabek,
  norm,
  provinsiDariKotaJabodetabek,
  ringkasEtape,
  tarifTerminal,
  type BiayaPayload,
  type EtapePayload,
  type JenisBiaya,
  type PelaksanaPayload,
  type Sbm,
  type StatusKode,
} from '@spjan/shared'

/**
 * Perubahan data pelaksana yang dipakai kartu pelaksana. Semuanya fungsi murni (bentuk lama -> bentuk baru)
 * supaya aturan turunan antara tujuan dan biaya (Jakarta-sekitarnya, taksi, tiket) mudah diuji.
 */

/** Ubah satu tujuan; bila kotanya berubah, biaya transport Jakarta-sekitarnya milik tujuan itu ikut diisi dari tabel SBM. */
export function ubahEtape(x: PelaksanaPayload, i: number, patch: Partial<EtapePayload>, sbm: Sbm): PelaksanaPayload {
  const etape = x.etape.map((e, j) => (j === i ? { ...e, ...patch } : e))
  let biaya = x.biaya

  if (patch.kota) {
    const cocok = cocokkanKotaJakartaSekitar(patch.kota, sbm.transportJakarta)
    if (cocok) {
      biaya = biaya.map((b) =>
        b.jenis === 'TRANSPORT_JAKARTA_SEKITAR' && (b.etapeIndex == null || b.etapeIndex === i)
          ? { ...b, uraian: cocok.kabKota, tarif: cocok.besaran, qty: b.qty ?? 2 }
          : b,
      )
    }
  }

  return { ...x, etape, biaya }
}

/** Ubah satu baris biaya; transport Jakarta-sekitarnya menandai tujuannya sebagai dalam kota dan mengisi kota/provinsi yang kosong. */
export function ubahBiaya(x: PelaksanaPayload, i: number, patch: Partial<BiayaPayload>): PelaksanaPayload {
  let etape = x.etape
  const baru = { ...x.biaya[i], ...patch }

  if (baru.jenis === 'TRANSPORT_JAKARTA_SEKITAR') {
    const idx = baru.etapeIndex ?? 0
    const target = etape[idx]
    if (target) {
      const patchE: Partial<EtapePayload> = {}
      // Dalam kota > 8 jam hanya untuk perjalanan sehari; beberapa hari tetap luar kota.
      if (!target.dalamKota8Jam && ringkasEtape(target).hari === 1) {
        patchE.dalamKota8Jam = true
        patchE.malamOverride = 0
      }
      if (baru.uraian) {
        if (!target.kota || isKotaJabodetabek(target.kota)) patchE.kota = baru.uraian
        if (!target.provinsi) {
          const prov = provinsiDariKotaJabodetabek(baru.uraian)
          if (prov) patchE.provinsi = prov
        }
      }
      if (Object.keys(patchE).length > 0) etape = etape.map((e, j) => (j === idx ? { ...e, ...patchE } : e))
    }
  }

  return { ...x, etape, biaya: x.biaya.map((b, j) => (j === i ? { ...b, ...patch } : b)) }
}

/** Hapus satu tujuan; biaya yang menunjuk tujuan itu dilepas, yang menunjuk tujuan sesudahnya digeser. */
export function hapusEtape(x: PelaksanaPayload, i: number): PelaksanaPayload {
  return {
    ...x,
    etape: x.etape.filter((_, j) => j !== i),
    biaya: x.biaya.map((b) => (b.etapeIndex != null && b.etapeIndex >= i ? { ...b, etapeIndex: b.etapeIndex === i ? null : b.etapeIndex - 1 } : b)),
  }
}

/** Tambah transport Jakarta-sekitarnya (PP); tujuan pertama ditandai dalam kota (satu hari: tanpa menginap). */
export function tambahTransportJakartaSekitar(x: PelaksanaPayload, sbm: Sbm): PelaksanaPayload {
  const cocok = cocokkanKotaJakartaSekitar(x.etape[0]?.kota, sbm.transportJakarta)
  let etape = x.etape
  const pertama = etape[0]
  if (pertama && !pertama.dalamKota8Jam && ringkasEtape(pertama).hari === 1) {
    etape = etape.map((e, j) => (j === 0 ? { ...e, dalamKota8Jam: true, malamOverride: 0 } : e))
  }

  const baru: BiayaPayload = {
    ...biayaKosong('TRANSPORT_JAKARTA_SEKITAR'),
    uraian: cocok ? cocok.kabKota : null,
    tarif: cocok ? cocok.besaran : 0,
    qty: 2,
    keterangan: 'Bukti terlampir',
  }
  return { ...x, etape, biaya: [...x.biaya, baru] }
}

/** Baris biaya per tujuan (tiket pergi, BBM, E-Toll); ditautkan ke tujuan berikutnya yang belum punya biaya jenis ini. */
export function biayaPerTujuan(x: PelaksanaPayload, jenis: JenisBiaya): BiayaPayload {
  const sudah = x.biaya.filter((b) => b.jenis === jenis).length
  return { ...biayaKosong(jenis), etapeIndex: sudah < x.etape.length ? sudah : null }
}

/** Baris taksi dari tempat kedudukan ke terminal, tarif dari provinsi kedudukan. */
export function biayaTaksiKedudukan(provinsiKedudukan: string | null | undefined, sbm: Sbm): BiayaPayload {
  const tarif = provinsiKedudukan ? (tarifTerminal(sbm, provinsiKedudukan) ?? 0) : 0
  return { ...biayaKosong('TAKSI_KEDUDUKAN'), tarif, qty: 1 }
}

/** Baris taksi dari terminal ke kota tujuan; memilih tujuan berikutnya yang belum punya taksi, tarif dari provinsinya. */
export function biayaTaksiTerminal(x: PelaksanaPayload, sbm: Sbm): BiayaPayload {
  const sudah = x.biaya.filter((b) => b.jenis === 'TAKSI_TERMINAL').length
  const etapeIdx = sudah < x.etape.length ? sudah : 0
  const target = (sudah < x.etape.length && x.etape[sudah]?.provinsi ? x.etape[sudah] : undefined) ?? x.etape.find((e) => e.provinsi) ?? x.etape[0]
  const provinsi = target?.provinsi || null
  const tarif = provinsi ? (tarifTerminal(sbm, provinsi) ?? 0) : 0
  return { ...biayaKosong('TAKSI_TERMINAL'), etapeIndex: etapeIdx, provinsi, tarif, qty: 2, keterangan: null }
}

/** Batas tarif hotel per malam (SBM) untuk tujuan ini menurut status pelaksana, atau null bila belum bisa ditentukan. */
export function batasHotelEtape(e: EtapePayload, status: StatusKode | null | undefined, sbm: Sbm): number | null {
  const cfg = status ? sbm.statusKonfigurasi[status] : undefined
  if (!cfg) return null
  return sbm.penginapan[norm(e.provinsi)]?.[cfg.kolomHotel - 1] ?? null
}
