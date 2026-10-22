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
/** Taksi bandara/kedudukan: uraian dicetak tanpa rincian "n kali @ tarif", langsung total. */
const TAKSI = new Set<JenisBiaya>(["TAKSI_KEDUDUKAN", "TAKSI_TERMINAL"]);

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
    case "TAKSI_KEDUDUKAN": {
      if (uraian) return uraian;
      if (kedudukan && norm(kedudukan) !== "JAKARTA") {
        return `Taksi dari tempat kedudukan - Bandara ${proper(kedudukan)} (PP)`;
      }
      return URAIAN_TAKSI_KEDUDUKAN;
    }
    case "TAKSI_TERMINAL": {
      if (uraian) return uraian;
      const targetEtape =
        (b.etapeIndex != null ? etape[b.etapeIndex] : undefined) ??
        etape.find((e) => norm(e.provinsi) === norm(b.provinsi ?? "")) ??
        etape[0];
      const rawLokasi = b.provinsi || targetEtape?.provinsi || targetEtape?.kota || "";
      if (rawLokasi) {
        const namaLokasi = proper(rawLokasi);
        return `Taksi/transport dari-ke bandara/terminal ${namaLokasi}`;
      }
      return LABEL_URAIAN.TAKSI_TERMINAL ?? b.jenis;
    }
    case "BBM_KENDARAAN":
    case "TOL_ETOLL": {
      if (uraian) return uraian;
      const i = b.etapeIndex ?? 0;
      const tujuan = etape[i]?.kota ?? "";
      const asal = i > 0 ? (etape[i - 1]?.kota ?? kedudukan) : kedudukan;
      return `${b.jenis === "BBM_KENDARAAN" ? "BBM" : "E-Toll"} dari ${asal} ke ${tujuan} PP`;
    }
    case "LAINNYA":
      return uraian || "Biaya lainnya";
    case "PENGINAPAN_LAIN":
      return uraian || "Biaya penginapan lainnya";
    case "UANG_HARIAN_LAIN":
      return uraian || "Uang harian lainnya";
    default: {
      const label = LABEL_URAIAN[b.jenis] ?? b.jenis;
      return uraian ? `${label} - ${uraian}` : label;
    }
  }
}

function barisTransport(b: BiayaInput, input: SpjInput, etape: EtapeInput[], sbm: Sbm): BarisBiaya | null {
  if (!(b.tarif > 0)) return null;
  const qty = b.qty && b.qty > 0 ? b.qty : 1;
  const satuanDefault = b.jenis === "PENGINAPAN_LAIN" ? "malam" : b.jenis === "UANG_HARIAN_LAIN" ? "hari" : SEWA.has(b.jenis) ? "hari" : "kali";
  const tampil = !TAKSI.has(b.jenis) && (qty > 1 || b.jenis === "PENGINAPAN_LAIN" || b.jenis === "UANG_HARIAN_LAIN" || ada(b.satuan));
  const catatan = catatanBiaya(sbm, b, input.provinsiKedudukan);
  const tanpaKeterangan = TAKSI.has(b.jenis);
  const ketInput = ada(b.keterangan) ? (b.keterangan as string).trim() : "";
  const keterangan = tanpaKeterangan
    ? (ketInput === KETERANGAN_DEFAULT ? "" : ketInput)
    : (ketInput || KETERANGAN_DEFAULT);
  return {
    uraian: uraianBiaya(b, input, etape),
    qty: tampil ? qty : null,
    satuan: tampil ? (ada(b.satuan) ? (b.satuan as string) : satuanDefault) : null,
    tarif: tampil ? b.tarif : null,
    jumlah: Math.round(qty * b.tarif),
    keterangan,
    ...(catatan ? { catatan } : {}),
  };
}

interface HasilEtape {
  uangHarian?: BarisBiaya[];
  representasi?: BarisBiaya;
  penginapan?: BarisBiaya | BarisBiaya[];
  hotel30Persen?: boolean;
  peringatan: Peringatan[];
  uraianSptb?: string;
  tanpaUangHarianJumlah?: number;
  uangHarian60Jumlah?: number;
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
  const tarifLuarKota = sbm.uangHarian[prov]?.luarKota;
  const tarifDalamKota = sbm.uangHarian[prov]?.dalamKota8Jam;
  // Dalam kota > 8 jam hanya untuk perjalanan sehari (tanpa menginap); lebih dari satu hari selalu uang harian luar kota.
  const dalamKota = !!e.dalamKota8Jam && hari === 1;
  const tarifHarian = dalamKota ? tarifDalamKota : tarifLuarKota;
  if (tarifHarian === undefined) {
    peringatan.push({
      kode: "DATA_BELUM_LENGKAP",
      pesan: `${nomor}: tarif uang harian ${dalamKota ? "dalam kota" : "luar kota"} untuk provinsi "${e.provinsi}" tidak ada di tabel SBM.`,
      etape: i,
    });
    return { peringatan };
  }

  const listHari = daftarHariIso(a, b);
  const tglTanpaUangHarian = (e.tanpaUangHarianDates ?? []).filter((tgl) => listHari.includes(tgl));
  const tglAktif = listHari.filter((tgl) => !tglTanpaUangHarian.includes(tgl));
  const tglFullboard = (e.fullboardDates ?? []).filter((tgl) => tglAktif.includes(tgl));
  const tglSisaBiasa = tglAktif.filter((tgl) => !tglFullboard.includes(tgl));
  const tglUangHarian60 = (e.uangHarian60Dates ?? []).filter((tgl) => tglSisaBiasa.includes(tgl));
  const tglBiasa = tglSisaBiasa.filter((tgl) => !tglUangHarian60.includes(tgl));
  const semuaFullboard = tglFullboard.length >= hari;

  const malam = e.malamOverride != null ? e.malamOverride : semuaFullboard ? 0 : Math.max(hari - 1, 0);
  const rincian = rentangRincian(a, b);
  const cfg = p.status ? sbm.statusKonfigurasi[p.status] : undefined;
  const hasil: HasilEtape = { peringatan };
  if (tglTanpaUangHarian.length > 0) {
    hasil.tanpaUangHarianJumlah = tglTanpaUangHarian.length;
  }
  if (tglUangHarian60.length > 0) {
    hasil.uangHarian60Jumlah = tglUangHarian60.length;
  }

  const ketHarian = dalamKota
    ? `Dalam kota (> 8 jam)/Prov. ${proper(e.provinsi)} Tanggal ${rincian}`
    : `Lumpsum/Prov. ${proper(e.provinsi)} Tanggal ${rincian}`;

  hasil.uangHarian = [];
  if (tglFullboard.length === 0 && tglTanpaUangHarian.length === 0 && tglUangHarian60.length === 0) {
    hasil.uangHarian.push({
      uraian: "selama :",
      qty: hari,
      satuan: "hari",
      tarif: tarifHarian,
      jumlah: hari * tarifHarian,
      keterangan: ketHarian,
    });
  } else {
    if (tglBiasa.length > 0) {
      hasil.uangHarian.push({
        uraian: "selama :",
        qty: tglBiasa.length,
        satuan: "hari",
        tarif: tarifHarian,
        jumlah: tglBiasa.length * tarifHarian,
        keterangan: dalamKota
          ? `Dalam kota (> 8 jam)/Prov. ${proper(e.provinsi)} Tanggal ${formatDaftarTanggal(tglBiasa)}`
          : `Lumpsum/Prov. ${proper(e.provinsi)} Tanggal ${formatDaftarTanggal(tglBiasa)}`,
      });
    }
    if (tglUangHarian60.length > 0) {
      const tarif60 = Math.round(tarifHarian * 0.6);
      hasil.uangHarian.push({
        uraian: "selama (60%) :",
        qty: tglUangHarian60.length,
        satuan: "hari",
        tarif: tarif60,
        jumlah: tglUangHarian60.length * tarif60,
        keterangan: dalamKota
          ? `Dalam kota (60%)/Prov. ${proper(e.provinsi)} Tanggal ${formatDaftarTanggal(tglUangHarian60)}`
          : `Lumpsum (60%)/Prov. ${proper(e.provinsi)} Tanggal ${formatDaftarTanggal(tglUangHarian60)}`,
      });
    }
    if (tglFullboard.length > 0) {
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

  const batas = cfg ? sbm.penginapan[prov]?.[cfg.kolomHotel - 1] : undefined;
  const tarif30 = batas !== undefined ? Math.round(batas * 0.3) : 0;
  const listMalam = listHari.slice(0, Math.max(0, malam));
  const tglHotel30 = (e.hotel30Dates ?? []).filter((tgl) => listMalam.includes(tgl));
  const hasHotel30Dates = (e.hotel30Dates ?? []).length > 0;
  const isSemua30 = hasHotel30Dates ? tglHotel30.length >= malam : !!e.hotel30Persen;
  const isSebagian30 = hasHotel30Dates && tglHotel30.length > 0 && tglHotel30.length < malam;
  const malam30 = isSemua30 ? malam : isSebagian30 ? tglHotel30.length : 0;
  const malamHotel = malam - malam30;
  const tglHotel = listMalam.filter((tgl) => !tglHotel30.includes(tgl));

  if (malam > 0) {
    if (malam30 > 0 && malamHotel === 0) {
      // Semua malam 30% SBM
      const tarifEfektif30 = e.hotelTarif && e.hotelTarif > 0 ? e.hotelTarif : tarif30;
      if (tarifEfektif30 <= 0) {
        peringatan.push({
          kode: "TARIF_HOTEL_KOSONG",
          pesan: `${nomor}: tarif penginapan 30% belum dapat dihitung (provinsi tidak ditemukan di SBM).`,
          etape: i,
        });
      } else {
        hasil.hotel30Persen = true;
        const namaTampil = (e.hotelNama ?? "").trim() || "Biaya Penginapan 30% SBM";
        hasil.penginapan = {
          uraian: namaTampil,
          qty: malam,
          satuan: "malam",
          tarif: tarifEfektif30,
          jumlah: malam * tarifEfektif30,
          keterangan: `Tanggal ${rincian}, Tanpa fasilitas hotel (DPR)`,
        };
      }
    } else if (malam30 === 0 && malamHotel > 0) {
      // Semua malam hotel riil
      const tarifHotel = e.hotelTarif ?? 0;
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
        if (batas !== undefined && tarifHotel > batas) {
          peringatan.push({
            kode: "HOTEL_MELEBIHI_BATAS",
            pesan: `${nomor}: tarif hotel ${formatRp(tarifHotel)} melebihi batas SBM ${formatRp(batas)}.`,
            etape: i,
          });
        }
      }
    } else if (malam30 > 0 && malamHotel > 0) {
      // Sebagian malam 30% SBM dan sebagian malam hotel riil
      hasil.hotel30Persen = true;
      const daftarPgn: BarisBiaya[] = [];
      const tarifHotel = e.hotelTarif ?? 0;
      if (!(tarifHotel > 0)) {
        peringatan.push({ kode: "TARIF_HOTEL_KOSONG", pesan: `${nomor}: tarif hotel belum diisi (${malamHotel} malam).`, etape: i });
      } else {
        daftarPgn.push({
          uraian: (e.hotelNama ?? "").trim() || "Penginapan / Hotel",
          qty: malamHotel,
          satuan: "malam",
          tarif: tarifHotel,
          jumlah: malamHotel * tarifHotel,
          keterangan: `Tanggal ${formatDaftarTanggal(tglHotel)}, Bukti terlampir`,
        });
        if (batas !== undefined && tarifHotel > batas) {
          peringatan.push({
            kode: "HOTEL_MELEBIHI_BATAS",
            pesan: `${nomor}: tarif hotel ${formatRp(tarifHotel)} melebihi batas SBM ${formatRp(batas)}.`,
            etape: i,
          });
        }
      }

      if (tarif30 <= 0) {
        peringatan.push({
          kode: "TARIF_HOTEL_KOSONG",
          pesan: `${nomor}: tarif penginapan 30% belum dapat dihitung (provinsi tidak ditemukan di SBM).`,
          etape: i,
        });
      } else {
        daftarPgn.push({
          uraian: "Biaya Penginapan 30% SBM",
          qty: malam30,
          satuan: "malam",
          tarif: tarif30,
          jumlah: malam30 * tarif30,
          keterangan: `Tanggal ${formatDaftarTanggal(tglHotel30)}, Tanpa fasilitas hotel (DPR)`,
        });
      }
      hasil.penginapan = daftarPgn;
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
  const pengeluaranRiil: BarisBiaya[] = [];
  const segmen: string[] = [];
  p.etape.forEach((e, i) => {
    const h = hitungEtape(e, i, p, sbm);
    peringatan.push(...h.peringatan);
    if (h.uangHarian) uangHarian.push(...h.uangHarian);
    if (h.representasi) representasi.push(h.representasi);
    if (h.penginapan) {
      const listPgn = Array.isArray(h.penginapan) ? h.penginapan : [h.penginapan];
      for (const pgn of listPgn) {
        penginapan.push(pgn);
        if (pgn.keterangan?.includes("Tanpa fasilitas hotel") || (h.hotel30Persen && !Array.isArray(h.penginapan))) {
          pengeluaranRiil.push({
            uraian: `Biaya penginapan 30% (tanpa fasilitas hotel) di ${e.kota || proper(e.provinsi)}`,
            qty: pgn.qty,
            satuan: pgn.satuan,
            tarif: pgn.tarif,
            jumlah: pgn.jumlah,
            keterangan: pgn.keterangan,
          });
        }
      }
    }
    if (h.tanpaUangHarianJumlah && h.tanpaUangHarianJumlah > 0) {
      const pref = p.etape.length > 1 ? `Tujuan ${i + 1}: ` : "";
      catatan.push(`${pref}${h.tanpaUangHarianJumlah} hari uang harian tidak dibebankan ke SPJ (ditanggung pihak lain).`);
    }
    if (h.uangHarian60Jumlah && h.uangHarian60Jumlah > 0) {
      const pref = p.etape.length > 1 ? `Tujuan ${i + 1}: ` : "";
      catatan.push(`${pref}${h.uangHarian60Jumlah} hari uang harian dibayarkan 60%.`);
    }
    if (h.uraianSptb) segmen.push(h.uraianSptb);
  });

function urutanBiayaTransport(jenis: JenisBiaya): number {
  switch (jenis) {
    case "TIKET_PERGI":
      return 10;
    case "TIKET_KEMBALI":
      return 20;
    case "TAKSI_KEDUDUKAN":
      return 30;
    case "TAKSI_TERMINAL":
      return 40;
    case "TRANSPORT_DARAT":
      return 50;
    case "TRANSPORT_JAKARTA_SEKITAR":
      return 51;
    case "TRANSPORT_KEGIATAN_PP":
      return 52;
    case "BBM_KENDARAAN":
      return 53;
    case "TOL_ETOLL":
      return 54;
    case "SEWA_RODA4":
    case "SEWA_RODA6":
    case "SEWA_BUS_BESAR":
      return 60;
    case "AIRPORT_TAX_BAGASI":
      return 65;
    case "KERETA_BUS_LAIN":
      return 70;
    case "LAINNYA":
      return 80;
    default:
      return 90;
  }
}

  const transport: BarisBiaya[] = [];
  const biayaUrut = [...p.biaya].sort((a, b) => {
    const ua = urutanBiayaTransport(a.jenis);
    const ub = urutanBiayaTransport(b.jenis);
    if (ua !== ub) return ua - ub;
    return (a.etapeIndex ?? 0) - (b.etapeIndex ?? 0);
  });

  for (const b of biayaUrut) {
    const baris = barisTransport(b, input, p.etape, sbm);
    if (baris) {
      if (b.jenis === "PENGINAPAN_LAIN") {
        penginapan.push(baris);
      } else if (b.jenis === "UANG_HARIAN_LAIN") {
        uangHarian.push(baris);
      } else {
        transport.push(baris);
      }
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
