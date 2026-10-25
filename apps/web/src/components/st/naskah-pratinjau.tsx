import type { ReactNode } from 'react'
import { formatHariDenganTerbilang, formatRentangWaktuSt, type NaskahStPayload } from '@spjan/shared'

const FONT_ISI = "'Bookman Old Style', 'Bookman', 'URW Bookman L', 'Palatino Linotype', Georgia, serif"
const FONT_KOP = "'Figtree', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
const PENANDATANGAN_CONTOH = { nama: 'Dr. Marcus Octavianus Susatyo, S.Hut., M.P.', nip: '196810191998031001' }

/** Satu lembar kertas A4 pratinjau (margin dan font mengikuti naskah dinas). */
function Lembar({ ukuranTeks, children }: { ukuranTeks: string; children: ReactNode }) {
  return (
    <div
      className={`bg-white text-neutral-900 shadow-xl border border-neutral-300 p-6 sm:pt-[1.5cm] sm:pb-[2.5cm] sm:px-[2.0cm] ${ukuranTeks} leading-relaxed select-text overflow-x-auto`}
      style={{ fontFamily: FONT_ISI }}
    >
      {children}
    </div>
  )
}

/** Baris "label : isi" dengan isi berupa butir bernomor atau teks bebas. */
function BagianBerlabel({ label, className = '', children }: { label: string; className?: string; children: ReactNode }) {
  return (
    <div className={`flex gap-2 ${className}`}>
      <div className="w-24 shrink-0 flex justify-between font-normal">
        <span>{label}</span>
        <span>:</span>
      </div>
      <div className="flex-1 space-y-1">{children}</div>
    </div>
  )
}

/** Butir dengan penanda di kiri ("1.", "a."). */
function Butir({ penanda, children }: { penanda: string; children: ReactNode }) {
  return (
    <div className="flex gap-2">
      <span className="shrink-0">{penanda}</span>
      <span>{children}</span>
    </div>
  )
}

function BlokTandaTangan({ form, tanggal }: { form: NaskahStPayload; tanggal?: string }) {
  return (
    <div className="w-64 text-left space-y-0.5">
      {tanggal ? (
        <p>
          {form.tempatNaskah || 'Jakarta'}, {tanggal}
        </p>
      ) : null}
      <p>{form.penandatanganJabatan || 'Direktur,'}</p>
      <div className="w-[3cm] h-[3cm] my-1 border border-dashed border-neutral-300 rounded flex flex-col items-center justify-center text-neutral-400 font-mono text-[10px] leading-tight text-center bg-neutral-50/50">
        <span>{'${ttd_pengirim}'}</span>
        <span className="text-[9px] text-neutral-400 font-sans mt-0.5">(QR TTE 3×3 cm)</span>
      </div>
      <p className="font-semibold">{form.penandatanganNama || PENANDATANGAN_CONTOH.nama}</p>
      <p>NIP. {form.penandatanganNip || PENANDATANGAN_CONTOH.nip}</p>
    </div>
  )
}

function Kop() {
  return (
    <>
      <div className="flex items-center justify-between pb-2">
        <img
          src="/logo-kemenhut.png"
          alt="Logo Kementerian Kehutanan"
          className="w-[2.65cm] h-[2.65cm] object-contain shrink-0"
        />
        <div className="flex-1 text-center px-2" style={{ fontFamily: FONT_KOP }}>
          <p className="font-bold text-[14pt] tracking-wide leading-tight uppercase text-neutral-950">KEMENTERIAN KEHUTANAN</p>
          <p className="font-bold text-[13pt] tracking-wide leading-tight uppercase mt-1 text-neutral-900">
            DIREKTORAT JENDERAL PERHUTANAN SOSIAL
          </p>
          <p className="font-bold text-[12.5pt] tracking-wide leading-tight uppercase mt-1 text-neutral-900 whitespace-nowrap">
            DIREKTORAT PENGENDALIAN PERHUTANAN SOSIAL
          </p>
        </div>
        {/* Penyeimbang agar teks kop tepat di sumbu tengah kertas */}
        <div className="w-[2.65cm] shrink-0 hidden sm:block" aria-hidden="true" />
      </div>
      {/* Garis ganda pemisah kop */}
      <div className="space-y-[1.5px] mt-2 mb-5">
        <div className="h-[2.5px] bg-black" />
        <div className="h-[0.75px] bg-black" />
      </div>
    </>
  )
}

function Lampiran({ form, nomor, tanggal }: { form: NaskahStPayload; nomor: string; tanggal: string }) {
  const sel = 'border border-neutral-800 px-2 py-1'
  return (
    <Lembar ukuranTeks="text-[11.5px]">
      <p className="text-center">-2-</p>
      <div className="mt-3 ml-auto w-64 space-y-0">
        <p>Lampiran Surat Tugas</p>
        <p>Nomor &nbsp;&nbsp;&nbsp;: {nomor}</p>
        <p>Tanggal : {tanggal}</p>
      </div>
      <p className="mt-4 mb-3 text-center font-bold">DAFTAR PELAKSANA TUGAS</p>
      <table className="w-full border-collapse text-[11px]">
        <thead>
          <tr>
            <th className={`w-10 ${sel}`}>NO</th>
            <th className={sel}>NAMA/NIP</th>
            <th className={sel}>JABATAN</th>
          </tr>
        </thead>
        <tbody>
          {form.pelaksana.map((p, i) => (
            <tr key={i}>
              <td className={`${sel} text-center align-top`}>{i + 1}.</td>
              <td className={`${sel} align-top`}>
                <p>{p.nama}</p>
                <p>NIP. {p.nip?.trim() || '-'}</p>
              </td>
              <td className={`${sel} align-top`}>{(p.jabatan || '').trim().replace(/^\/\s*/, '')}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-4 flex justify-end">
        <BlokTandaTangan form={form} />
      </div>
    </Lembar>
  )
}

/** Pratinjau langsung naskah surat tugas (halaman 1, dan lampiran bila pelaksana lebih dari 3). */
export function NaskahPratinjau({
  form,
  nomor,
  tanggal,
  lamaHari,
  lampiran,
}: {
  form: NaskahStPayload
  nomor: string
  tanggal: string
  lamaHari: number
  lampiran: boolean
}) {
  const rentang = formatRentangWaktuSt(form.tanggalMulai, form.tanggalSelesai)
  const maksud = form.maksudTugas || '...'
  const pembebanan = form.pembebananAnggaran.endsWith('.') ? form.pembebananAnggaran : `${form.pembebananAnggaran}.`

  return (
    <>
      <Lembar ukuranTeks="text-[11.5pt]">
        <Kop />

        <div className="text-center mb-5">
          <p className="font-bold tracking-widest text-[12pt] uppercase">SURAT TUGAS</p>
          <p className="text-[11pt] mt-0.5">Nomor: {nomor}</p>
        </div>

        <div className="text-center font-bold text-[11pt] tracking-[0.1em] mb-5 uppercase">
          DIREKTUR PENGENDALIAN PERHUTANAN SOSIAL,
        </div>

        <div className="space-y-2.5 text-[11.5px] leading-relaxed text-justify">
          <BagianBerlabel label="Menimbang" className="mb-3">
            <Butir penanda="a.">bahwa dalam rangka {maksud}, diperlukan untuk menugaskan personil;</Butir>
            <Butir penanda="b.">bahwa sehubungan dengan poin a perlu diterbitkan Surat Tugas.</Butir>
          </BagianBerlabel>

          <BagianBerlabel label="Dasar">
            {form.dasarHukum.map((d, i) => (
              <Butir key={i} penanda={`${i + 1}.`}>
                {d}
              </Butir>
            ))}
            {form.dasarSpesifik ? <Butir penanda={`${form.dasarHukum.length + 1}.`}>{form.dasarSpesifik}</Butir> : null}
          </BagianBerlabel>

          <div className="text-center font-bold tracking-widest text-[12px] py-2">MEMBERI TUGAS,</div>

          <BagianBerlabel label="Kepada" className="mb-3">
            {form.pelaksana.length === 0 ? (
              <p className="italic text-neutral-400">(Belum ada pelaksana yang dipilih)</p>
            ) : lampiran ? (
              <p>DAFTAR TERLAMPIR</p>
            ) : (
              form.pelaksana.map((p, i) => (
                <Butir key={i} penanda={`${i + 1}.`}>
                  {p.nama}
                  {p.jabatan ? ` / ${p.jabatan}` : ''}
                </Butir>
              ))
            )}
          </BagianBerlabel>

          <BagianBerlabel label="Untuk">
            <Butir penanda="1.">
              Melaksanakan perjalanan dinas dalam rangka {maksud} di {form.lokasiTugas || '...'};
            </Butir>
            <Butir penanda="2.">
              Yang bersangkutan melaksanakan perintah tugas selama <strong>{formatHariDenganTerbilang(lamaHari)} hari</strong>{' '}
              pada tanggal <strong>{rentang}</strong>;
            </Butir>
            <Butir penanda="3.">
              Selambat-lambatnya {formatHariDenganTerbilang(form.pelaporanHari || 5)} hari setelah melaksanakan tugas, membuat
              laporan tertulis kepada Direktur PPS;
            </Butir>
            <Butir penanda="4.">Biaya dibebankan kepada {pembebanan}</Butir>
          </BagianBerlabel>
        </div>

        <div className="mt-6 flex justify-end text-[11.5px]">
          <BlokTandaTangan form={form} tanggal={tanggal} />
        </div>

        {form.tembusan.length > 0 ? (
          <div className="mt-5 pt-2 text-[11.5px] space-y-0.5">
            <p className="font-normal">Tembusan:</p>
            <div className="space-y-0.5">
              {form.tembusan.map((t, i) => (
                <Butir key={i} penanda={`${i + 1}.`}>
                  {t}
                </Butir>
              ))}
            </div>
          </div>
        ) : null}
      </Lembar>

      {lampiran ? <Lampiran form={form} nomor={nomor} tanggal={tanggal} /> : null}
    </>
  )
}
