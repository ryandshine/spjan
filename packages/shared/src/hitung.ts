import { catatanBiaya, paguTiket, tarifUangSakuFullboard } from "./pagu.js";
import {
  angkaKata,
  daftarHariIso,
  formatDaftarTanggal,
  formatRp,
  norm,
  parseTanggal,
  proper,
  rentangRincian,
  rentangSptb,
  selisihHari,
  tanggalIndonesia,
  terbilangRupiah,
} from "./teks.js";
import type {
  BarisBiaya,
  BiayaInput,
  EtapeInput,
  JenisBiaya,
  PelaksanaHasil,
  PelaksanaInput,
  Peringatan,
  Sbm,
  SpjHasil,
  SpjInput,
} from "./types.js";

const KETERANGAN_DEFAULT = "Bukti terlampir";
const URAIAN_TAKSI_KEDUDUKAN = "Taksi dari tempat kedudukan - Bandara Soekarno Hatta (PP)";

const SEWA = new Set<JenisBiaya>(["SEWA_RODA4", "SEWA_RODA6", "SEWA_BUS_BESAR"]);

const LABEL_URAIAN: Partial<Record<JenisBiaya, string>> = {
  TRANSPORT_DARAT: "Transport darat ibukota ke kab/kota",
  TRANSPORT_JAKARTA_SEKITAR: "Transport Jakarta ke kota sekitar",
  TRANSPORT_KEGIATAN_PP: "Transport kegiatan dalam kab/kota PP",
  TAKSI_TERMINAL: "Taksi/transport dari-ke bandara/terminal",
  SEWA_RODA4: "Sewa kendaraan roda 4 per hari",
  SEWA_RODA6: "Sewa kendaraan roda 6/bus sedang per hari",
  SEWA_BUS_BESAR: "Sewa kendaraan bus besar per hari",
  AIRPORT_TAX_BAGASI: "Airport tax / bagasi / retribusi",
  KERETA_BUS_LAIN: "Kereta api / bus / lainnya",
};

export function normalkanUraianTiket(uraian: string): string {
  if (!uraian) return uraian;
  return uraian.replace(
    /^Tiket\s+(?:Garuda(?:\s+Indonesia)?|AirAsia(?:\s+Indonesia)?|Lion(?:\s+Air)?|Batik(?:\s+Air)?|Citilink|Super\s+Air\s+Jet|Sriwijaya(?:\s+Air)?|Wings\s+Air|Pelita\s+Air|Nam\s+Air|TransNusa)\b/i,
    "Tiket Pesawat",
  );
}

function ada(s: string | null | undefined): boolean {
  return !!s && s.trim() !== "";
}

function uraianBiaya(b: BiayaInput, input: SpjInput, etape: EtapeInput[]): string {
  const uraian = (b.uraian ?? "").trim();
  const kedudukan = input.kotaKedudukan;
  switch (b.jenis) {
    case "TIKET_PERGI": {
      if (uraian) return normalkanUraianTiket(uraian);
      const i = b.etapeIndex ?? 0;
      const tujuan = etape[i]?.kota ?? "";
      const asal = i > 0 ? (etape[i - 1]?.kota ?? kedudukan) : kedudukan;
      return `Tiket Pesawat ${asal} ke ${tujuan}`;
    }
    case "TIKET_KEMBALI": {
      if (uraian) return normalkanUraianTiket(uraian);
      const i = b.etapeIndex ?? etape.length - 1;
      return `Tiket Pesawat ${etape[i]?.kota ?? ""} ke ${kedudukan}`;
    }
    case "TAKSI_KEDUDUKAN":
      return uraian || URAIAN_TAKSI_KEDUDUKAN;
    case "LAINNYA":
      return uraian || "Biaya lainnya";
    default: {
      const label = LABEL_URAIAN[b.jenis] ?? b.jenis;
      return uraian ? `${label} - ${uraian}` : label;
    }
  }
}

function barisTransport(b: BiayaInput, input: SpjInput, etape: EtapeInput[], sbm: Sbm): BarisBiaya | null {
  if (!(b.tarif > 0)) return null;
  const qty = b.qty && b.qty > 0 ? b.qty : 1;
  const tampil = qty > 1;
  const satuanDefault = SEWA.has(b.jenis) ? "hari" : "kali";
  const catatan = catatanBiaya(sbm, b, input.provinsiKedudukan);
  const keteranganDefault = b.jenis === "TAKSI_KEDUDUKAN" ? "" : KETERANGAN_DEFAULT;
  return {
    uraian: uraianBiaya(b, input, etape),
    qty: tampil ? qty : null,
    satuan: tampil ? ada(b.satuan) ? (b.satuan as string) : satuanDefault : null,
    tarif: tampil ? b.tarif : null,
    jumlah: Math.round(qty * b.tarif),
    keterangan: ada(b.keterangan) ? (b.keterangan as string) : keteranganDefault,
    ...(catatan ? { catatan } : {}),
  };
}

interface HasilEtape {
  uangHarian?: BarisBiaya[];
  representasi?: BarisBiaya;
  penginapan?: BarisBiaya;
  peringatan: Peringatan[];
  uraianSptb?: string;
}

/** Membersihkan awalan kegiatan agar tidak terjadi pengulangan "dalam rangka" atau "perjalanan dinas". */
export function bersihkanKegiatanUraian(kegiatan: string): string {
  let bersih = kegiatan.trim();
  bersih = bersih.replace(/^(?:melaksanakan\s+)?(?:tugas\s+|kegiatan\s+)?perjalanan\s+dinas\s+(?:dalam\s+rangka\s+)?/i, "");
  bersih = bersih.replace(/^(?:melaksanakan\s+)?(?:kegiatan\s+)?dalam\s+rangka\s+/i, "");
  bersih = bersih.trim();
  if (bersih.length > 0) {
    bersih = bersih.charAt(0).toUpperCase() + bersih.slice(1);
  }
  return bersih || kegiatan.trim();
}

function hitungEtape(e: EtapeInput, i: number, p: PelaksanaInput, sbm: Sbm): HasilEtape {
  const peringatan: Peringatan[] = [];
  const nomor = `Etape ${i + 1}`;
  const a = parseTanggal(e.berangkat);
  const b = parseTanggal(e.pulang);
  if (!ada(e.provinsi) || !ada(e.kota) || !a || !b) {
    peringatan.push({ kode: "DATA_BELUM_LENGKAP", pesan: `${nomor}: provinsi, kota, dan tanggal wajib diisi.`, etape: i });
    return { peringatan };
  }
  const hari = selisihHari(a, b) + 1;
  if (hari < 1) {
    peringatan.push({ kode: "TANGGAL_SALAH", pesan: `${nomor}: tanggal pulang lebih awal dari berangkat.`, etape: i });
    return { peringatan };
  }
  const prov = norm(e.provinsi);
  const tarifHarian = sbm.uangHarian[prov]?.luarKota;
  if (tarifHarian === undefined) {
    peringatan.push({ kode: "DATA_BELUM_LENGKAP", pesan: `${nomor}: provinsi "${e.provinsi}" tidak ada di tabel SBM.`, etape: i });
    return { peringatan };
  }

  const listHari = daftarHariIso(a, b);
  const tglFullboard = (e.fullboardDates ?? []).filter((tgl) => listHari.includes(tgl));
  const tglBiasa = listHari.filter((tgl) => !tglFullboard.includes(tgl));
  const semuaFullboard = tglFullboard.length >= hari;

  const malam = e.malamOverride != null ? e.malamOverride : semuaFullboard ? 0 : Math.max(hari - 1, 0);
  const rincian = rentangRincian(a, b);
  const cfg = p.status ? sbm.statusKonfigurasi[p.status] : undefined;
  const hasil: HasilEtape = { peringatan };

  hasil.uangHarian = [];
  if (tglFullboard.length === 0) {
    hasil.uangHarian.push({
      uraian: "selama :",
      qty: hari,
      satuan: "hari",
      tarif: tarifHarian,
      jumlah: hari * tarifHarian,
      keterangan: `Lumpsum/Prov. ${proper(e.provinsi)} Tanggal ${rincian}`,
    });
  } else {
    if (tglBiasa.length > 0) {
      hasil.uangHarian.push({
        uraian: "selama :",
        qty: tglBiasa.length,
        satuan: "hari",
        tarif: tarifHarian,
        jumlah: tglBiasa.length * tarifHarian,
        keterangan: `Lumpsum/Prov. ${proper(e.provinsi)} Tanggal ${formatDaftarTanggal(tglBiasa)}`,
      });
    }
    const tarifSaku = tarifUangSakuFullboard(p.status, true);
    hasil.uangHarian.push({
      uraian: "Uang saku fullboard :",
      qty: tglFullboard.length,
      satuan: "hari",
      tarif: tarifSaku,
      jumlah: tglFullboard.length * tarifSaku,
      keterangan: `Kegiatan Fullboard Tanggal ${formatDaftarTanggal(tglFullboard)}`,
    });
  }

  if (cfg && cfg.barisRepresentasi > 0 && e.dinasJabatan) {
    const tarifRep = sbm.representasi[cfg.barisRepresentasi - 1]?.luarKota;
    if (tarifRep !== undefined) {
      hasil.representasi = {
        uraian: "Representasi selama :",
        qty: hari,
        satuan: "hari",
        tarif: tarifRep,
        jumlah: hari * tarifRep,
        keterangan: `Uang representasi, Tanggal ${rincian}`,
      };
    }
  }

  const tarifHotel = e.hotelTarif ?? 0;
  if (malam > 0) {
    if (!(tarifHotel > 0)) {
      peringatan.push({ kode: "TARIF_HOTEL_KOSONG", pesan: `${nomor}: tarif hotel belum diisi (${malam} malam).`, etape: i });
    } else {
      hasil.penginapan = {
        uraian: (e.hotelNama ?? "").trim(),
        qty: malam,
        satuan: "malam",
        tarif: tarifHotel,
        jumlah: malam * tarifHotel,
        keterangan: `Tanggal ${rincian}, Bukti terlampir`,
      };
      const batas = cfg ? sbm.penginapan[prov]?.[cfg.kolomHotel - 1] : undefined;
      if (batas !== undefined && tarifHotel > batas) {
        peringatan.push({
          kode: "HOTEL_MELEBIHI_BATAS",
          pesan: `${nomor}: tarif hotel ${formatRp(tarifHotel)} melebihi batas SBM ${formatRp(batas)}.`,
          etape: i,
        });
      }
    }
  }

  const kata = hari <= 99 ? ` (${angkaKata(hari)})` : "";
  hasil.uraianSptb = `${bersihkanKegiatanUraian(e.kegiatan)} selama ${hari}${kata} hari pada tanggal ${rentangSptb(a, b)}`;
  return hasil;
}

function jumlah(baris: BarisBiaya[]): number {
  return baris.reduce((s, r) => s + r.jumlah, 0);
}

function hitungPelaksana(p: PelaksanaInput, input: SpjInput, sbm: Sbm): PelaksanaHasil {
  const peringatan: Peringatan[] = [];
  const catatan: string[] = [];
  if (!p.status) peringatan.push({ kode: "STATUS_PEGAWAI_KOSONG", pesan: "Status/golongan pegawai belum dipilih." });
  if (!ada(p.nip)) peringatan.push({ kode: "NIP_KOSONG", pesan: "NIP belum diisi." });
  if (!ada(p.noSpd)) peringatan.push({ kode: "NO_SPD_KOSONG", pesan: "Nomor SPD belum diisi." });

  const uangHarian: BarisBiaya[] = [];
  const representasi: BarisBiaya[] = [];
  const penginapan: BarisBiaya[] = [];
  const segmen: string[] = [];
  p.etape.forEach((e, i) => {
    const h = hitungEtape(e, i, p, sbm);
    peringatan.push(...h.peringatan);
    if (h.uangHarian) uangHarian.push(...h.uangHarian);
    if (h.representasi) representasi.push(h.representasi);
    if (h.penginapan) penginapan.push(h.penginapan);
    if (h.uraianSptb) segmen.push(h.uraianSptb);
  });

  const transport: BarisBiaya[] = [];
  const pengeluaranRiil: BarisBiaya[] = [];
  for (const b of p.biaya) {
    const baris = barisTransport(b, input, p.etape, sbm);
    if (baris) {
      transport.push(baris);
      if (b.pengeluaranRiil) {
        pengeluaranRiil.push(baris);
      }
    }
  }

  const cfg = p.status ? sbm.statusKonfigurasi[p.status] : undefined;
  if (cfg) {
    catatan.push(`Kelas tiket: ${cfg.kelasTiket}.`);
    if (cfg.barisRepresentasi > 0 && !p.etape.some((e) => e.dinasJabatan)) {
      catatan.push("Berhak uang representasi: tandai dinas jabatan bila perjalanan dinas jabatan.");
    }
    if (p.etape.length === 1 && p.etape[0]) {
      const tiket = p.biaya
        .filter((b) => b.jenis === "TIKET_PERGI" || b.jenis === "TIKET_KEMBALI")
        .reduce((s, b) => s + Math.round((b.qty && b.qty > 0 ? b.qty : 1) * b.tarif), 0);
      if (tiket > 0) {
        const pagu = paguTiket(sbm, input.kotaKedudukan, p.etape[0].kota, cfg.kelasTiket);
        if (pagu === null) catatan.push("Rute tiket tidak ada di tabel SBM (biaya riil).");
        else if (tiket > pagu) {
          catatan.push(`Tiket PP ${formatRp(tiket)} melebihi pagu SBM ${formatRp(pagu)} (biaya riil, lampirkan bukti).`);
        } else catatan.push(`Tiket PP dalam pagu SBM ${formatRp(pagu)}.`);
      }
    }
  }

  const totalTransport = jumlah(transport);
  const totalUangHarian = jumlah(uangHarian);
  const totalRepresentasi = jumlah(representasi);
  const totalPenginapan = jumlah(penginapan);
  const totalPengeluaranRiil = jumlah(pengeluaranRiil);
  const total = totalTransport + totalUangHarian + totalRepresentasi + totalPenginapan;
  const uraianSptb =
    segmen.length > 0
      ? `Biaya Perjalanan dinas dalam rangka ${segmen.join(" dan ")} sesuai Surat Tugas Nomor: ${input.nomorSt} tanggal ${tanggalIndonesia(input.tanggalSt)} sesuai dengan rincian terlampir.`
      : "";

  const kotaUnik: string[] = [];
  if (input.kotaKedudukan) kotaUnik.push(input.kotaKedudukan);
  for (const e of p.etape) {
    if (e.kota && kotaUnik[kotaUnik.length - 1] !== e.kota) {
      kotaUnik.push(e.kota);
    }
  }
  const rute = kotaUnik.length > 0 ? kotaUnik.join(" - ") : "-";

  return {
    nama: p.nama,
    nip: p.nip,
    jabatan: p.jabatan,
    status: p.status,
    noSpd: (p.noSpd ?? "").trim(),
    tanggalSpd: p.tanggalSpd ?? null,
    teksTanggalSpd: p.tanggalSpd ? tanggalIndonesia(p.tanggalSpd) : "",
    rute,
    transport,
    uangHarian,
    representasi,
    penginapan,
    pengeluaranRiil,
    totalTransport,
    totalUangHarian,
    totalRepresentasi,
    totalPenginapan,
    totalPengeluaranRiil,
    terbilangPengeluaranRiil: totalPengeluaranRiil > 0 ? terbilangRupiah(totalPengeluaranRiil) : "Nol Rupiah",
    total,
    terbilang: terbilangRupiah(total),
    uraianSptb,
    peringatan,
    catatan,
  };
}

export function hitungSpj(input: SpjInput, sbm: Sbm): SpjHasil {
  const pelaksana = input.pelaksana.map((p) => hitungPelaksana(p, input, sbm));
  const total = pelaksana.reduce((s, p) => s + p.total, 0);
  return {
    pelaksana,
    total,
    terbilang: terbilangRupiah(total),
    teksTanggalSt: tanggalIndonesia(input.tanggalSt),
    teksTanggalSpj: tanggalIndonesia(input.tanggalSpj),
  };
}
