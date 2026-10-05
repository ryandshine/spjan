import {
  SBM_2026,
  hitungSpj,
  toSpjInput,
  type HasilSuratTugasDto,
  type PengaturanPayload,
  type SuratTugasDto,
  type SuratTugasPayload,
} from '@spjan/shared'

const KEG_BALI =
  'Pendampingan Audiensi terkait Rencana Pembongkaran Homestay pada areal kerja Persetujuan Pengelolaan Perhutanan Sosial di Kota Denpasar Provinsi Bali'
const KEG_YOGYA = 'Rapat Koordinasi Teknis Pengelolaan Perhutanan Sosial di KHDPK di Provinsi D.I. Yogyakarta'

export const PENGATURAN_CONTOH: PengaturanPayload = {
  kodeSatker: '693712',
  namaSatker: 'KANTOR PUSAT DIREKTORAT JENDERAL PERHUTANAN SOSIAL',
  dasarDipa: '23 Desember 2025, No. SP DIPA-143.07.1.693712/2026',
  kodeAkunDefault: '7288.QDD.001.052.A.524111',
  tahunAnggaran: 2026,
  ppkNama: 'Priyo Kusumedi, S.Hut., M.P.',
  ppkNip: 'NIP. 19740218 200212 1 003',
  bendaharaNama: 'Aisyah, S.E',
  bendaharaNip: 'NIP.19841126 200901 2 001',
  pjNama: 'Gunadi Firdaus, S.Hut., M.Si.',
  pjNip: 'NIP. 19780310 199703 1 001',
  pjJabatan: 'Kepala Sub Direktorat Pemantauan',
  pembuatDaftarNama: null,
  pembuatDaftarNip: null,
  kotaKedudukan: 'Jakarta',
  provinsiKedudukan: 'D.K.I. JAKARTA',
}

const tiket = (jenis: 'TIKET_PERGI' | 'TIKET_KEMBALI', tarif: number, etapeIndex: number | null = null) => ({
  jenis,
  provinsi: null,
  uraian: null,
  qty: null,
  satuan: null,
  tarif,
  keterangan: null,
  etapeIndex,
})

export const ST_CONTOH: SuratTugasPayload = {
  nomor: 'ST.226/PPS/PEMPS/PSL.04.02/B/09/2026',
  tanggal: '2026-09-08',
  tanggalSpj: '2026-09-21',
  kodeAkun: '7288.QDD.001.052.A.524111',
  catatan: '',
  pelaksana: [
    {
      pegawaiId: null,
      nama: 'Gunadi Firdaus, S.Hut., M.Si.',
      nip: '197803101997031001',
      jabatan: 'Kasubdit Pemantauan Perhutanan Sosial',
      status: 'ESELON_III_GOL_IV',
      noSpd: '401/SPD/PPS/2026',
      etape: [
        { provinsi: 'BALI', kota: 'Denpasar', kegiatan: KEG_BALI, berangkat: '2026-09-10', pulang: '2026-09-11', malamOverride: null, hotelNama: 'Hotel Bali', hotelTarif: 1_500_000, dinasJabatan: false, fullboardDates: [] },
        { provinsi: 'D.I. YOGYAKARTA', kota: 'Yogyakarta', kegiatan: KEG_YOGYA, berangkat: '2026-09-12', pulang: '2026-09-13', malamOverride: null, hotelNama: 'Hotel Yogya', hotelTarif: 1_000_000, dinasJabatan: false, fullboardDates: [] },
      ],
      biaya: [
        tiket('TIKET_PERGI', 1_500_000, 0),
        { jenis: 'TAKSI_KEDUDUKAN', provinsi: null, uraian: null, qty: null, satuan: null, tarif: 250_000, keterangan: null, etapeIndex: null },
        tiket('TIKET_PERGI', 1_200_000, 1),
        tiket('TIKET_KEMBALI', 1_900_000),
      ],
    },
    {
      pegawaiId: null,
      nama: 'R Resa Adam Gunawan, S.T.',
      nip: '199508222023211008',
      jabatan: 'Surveyor Pemetaan Ahli Pertama',
      status: 'ESELON_IV_GOL_III_II_I',
      noSpd: '403/SPD/PPS/2026',
      etape: [
        { provinsi: 'BALI', kota: 'Denpasar', kegiatan: KEG_BALI, berangkat: '2026-09-10', pulang: '2026-09-11', malamOverride: null, hotelNama: 'Kuto Paradiso Hotel', hotelTarif: 1_021_948, dinasJabatan: false, fullboardDates: [] },
      ],
      biaya: [
        tiket('TIKET_PERGI', 2_260_940),
        tiket('TIKET_KEMBALI', 2_223_091),
        { jenis: 'TAKSI_KEDUDUKAN', provinsi: null, uraian: null, qty: 2, satuan: null, tarif: 250_000, keterangan: null, etapeIndex: null },
        { jenis: 'TRANSPORT_DARAT', provinsi: 'BALI', uraian: 'Kab. Gianyar', qty: 2, satuan: null, tarif: 200_000, keterangan: null, etapeIndex: null, pengeluaranRiil: true },
      ],
    },
    {
      pegawaiId: null,
      nama: 'Dr. Marcus Octavianus Susatyo, S.Hut., M.P.',
      nip: '196810191998031001',
      jabatan: 'Direktur Pengendalian Perhutanan Sosial',
      status: 'ESELON_II',
      noSpd: '45/SPD/PPS/2026',
      etape: [
        { provinsi: 'SULAWESI UTARA', kota: 'Manado', kegiatan: 'Pelaksanaan Pemantauan Izin Perhutanan Sosial serta Koordinasi Kunjungan Kerja Menteri Kehutanan ke Kota Manado, Provinsi Sulawesi Utara', berangkat: '2026-04-07', pulang: '2026-04-10', malamOverride: null, hotelNama: 'Manado Quality Hotel', hotelTarif: 650_000, dinasJabatan: true, fullboardDates: [] },
      ],
      biaya: [tiket('TIKET_PERGI', 3_689_972), tiket('TIKET_KEMBALI', 4_189_812)],
    },
  ],
}

export function hasilContoh(st: SuratTugasPayload = ST_CONTOH, pengaturan: PengaturanPayload = PENGATURAN_CONTOH): HasilSuratTugasDto {
  const dto: SuratTugasDto = { ...st, id: 1, versiSbmId: 1, createdAt: '2026-10-04T00:00:00.000Z', updatedAt: '2026-10-04T00:00:00.000Z' }
  return { suratTugas: dto, pengaturan, hasil: hitungSpj(toSpjInput(st, pengaturan), SBM_2026) }
}
