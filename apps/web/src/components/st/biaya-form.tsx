import { RotateCcwIcon, SparklesIcon, Trash2Icon } from "lucide-react";
import {
  JENIS_BIAYA,
  JENIS_LABEL,
  jenisButuhEtape,
  jenisButuhProvinsi,
  jenisButuhUraian,
  tarifTerminal,
  type BarisBiaya,
  type BiayaPayload,
  type JenisBiaya,
  type Sbm,
} from "@spjan/shared";

import { RupiahInput } from "@/components/st/rupiah-input";
import { Input } from "@/components/ui/input";
import { TextareaOtomatis } from "@/components/ui/textarea-otomatis";
import { Select } from "@/components/ui/select";
import { rupiah } from "@/lib/format";
import { cn } from "@/lib/utils";

const SEL_KECIL = "h-8 w-full py-0 text-xs";
const TEKS_KECIL = "min-h-8 py-1 text-xs";

/** Satu baris tabel Transportasi: jenis + pagu, qty, tarif, subtotal, keterangan, DPR, hapus. Dipakai di dalam <tbody>. */
export function BiayaBaris({
  biaya,
  etapeJumlah,
  etapeLabel,
  provinsi,
  provinsiKedudukan,
  baris,
  sbm,
  onUbah,
  onHapus,
}: {
  biaya: BiayaPayload;
  etapeJumlah: number;
  etapeLabel: (indeks: number) => string;
  provinsi: string[];
  provinsiKedudukan?: string | null;
  /** Baris hasil hitung untuk biaya ini (null/undefined bila tarif 0). */
  baris: BarisBiaya | null | undefined;
  sbm?: Sbm;
  onUbah: (patch: Partial<BiayaPayload>) => void;
  onHapus: () => void;
}) {
  const perluProvinsi = jenisButuhProvinsi(biaya.jenis);
  const perluEtape = jenisButuhEtape(biaya.jenis) && etapeJumlah > 1;
  const perluUraian =
    jenisButuhUraian(biaya.jenis) ||
    !!biaya.uraian ||
    biaya.jenis === "TAKSI_TERMINAL";
  const namaProvinsiPagu =
    biaya.jenis === "TAKSI_KEDUDUKAN"
      ? provinsiKedudukan
      : biaya.jenis === "TAKSI_TERMINAL"
        ? biaya.provinsi
        : null;
  const tarifTidakAda =
    !!sbm &&
    !!namaProvinsiPagu &&
    !biaya.tarif &&
    tarifTerminal(sbm, namaProvinsiPagu) === undefined;
  // Taksi bandara dan taksi kedudukan: tarif otomatis dari SBM provinsi bila ada.
  const tarifSbm =
    sbm &&
    namaProvinsiPagu &&
    (biaya.jenis === "TAKSI_KEDUDUKAN" || biaya.jenis === "TAKSI_TERMINAL")
      ? tarifTerminal(sbm, namaProvinsiPagu)
      : undefined;
  const tarifSbmJakarta =
    biaya.jenis === "TRANSPORT_JAKARTA_SEKITAR" && biaya.uraian
      ? sbm?.transportJakarta.find((t) => t.kabKota === biaya.uraian)?.besaran
      : undefined;
  const pagu = tarifSbm ?? tarifSbmJakarta;
  const uraianLabel =
    biaya.jenis === "TRANSPORT_DARAT" ||
    biaya.jenis === "TRANSPORT_JAKARTA_SEKITAR"
      ? "Kab/kota tujuan (persis PMK)"
      : biaya.jenis === "TIKET_PERGI" || biaya.jenis === "TIKET_KEMBALI"
        ? "Uraian tiket"
        : biaya.jenis === "TAKSI_TERMINAL"
          ? "Uraian (opsional)"
          : "Uraian";
  const subtotal =
    baris?.jumlah ?? (biaya.tarif ? (biaya.qty ?? 1) * biaya.tarif : 0);
  const tarifKosong = !biaya.tarif;
  const tarifMengikutiSbm = tarifSbm !== undefined && biaya.tarif === tarifSbm;

  return (
    <tr
      className={cn(
        "align-top border-t border-slate-200 first:border-t-0 dark:border-slate-800",
        tarifKosong && "bg-amber-50/30 dark:bg-amber-500/5",
      )}
    >
      <td className="p-2">
        <div className="grid gap-1.5">
          <Select
            aria-label="Jenis biaya"
            className={SEL_KECIL}
            value={biaya.jenis}
            onChange={(e) => {
              const j = e.target.value as JenisBiaya;
              const isJkt = j === "TRANSPORT_JAKARTA_SEKITAR";
              const isTerminal = j === "TAKSI_TERMINAL";
              let tarifPatch: number | undefined = undefined;
              if (
                j === "TAKSI_KEDUDUKAN" &&
                !biaya.tarif &&
                provinsiKedudukan &&
                sbm
              ) {
                tarifPatch = tarifTerminal(sbm, provinsiKedudukan);
              } else if (
                j === "TAKSI_TERMINAL" &&
                !biaya.tarif &&
                biaya.provinsi &&
                sbm
              ) {
                tarifPatch = tarifTerminal(sbm, biaya.provinsi);
              }
              onUbah({
                jenis: j,
                ...(isJkt && !biaya.qty ? { qty: 2 } : {}),
                ...(isTerminal && !biaya.qty ? { qty: 2 } : {}),
                ...(tarifPatch ? { tarif: tarifPatch } : {}),
              });
            }}
          >
            {JENIS_BIAYA.map((j) => (
              <option key={j} value={j}>
                {JENIS_LABEL[j]}
              </option>
            ))}
          </Select>
          {perluEtape ? (
            <Select
              aria-label="Untuk tujuan"
              className={SEL_KECIL}
              value={biaya.etapeIndex ?? ""}
              onChange={(e) =>
                onUbah({
                  etapeIndex:
                    e.target.value === "" ? null : Number(e.target.value),
                })
              }
            >
              <option value="">
                {biaya.jenis === "TIKET_PERGI"
                  ? "Tujuan 1 (otomatis)"
                  : "Tujuan terakhir (otomatis)"}
              </option>
              {Array.from({ length: etapeJumlah }, (_, i) => (
                <option key={i} value={i}>
                  {etapeLabel(i)}
                </option>
              ))}
            </Select>
          ) : null}
          {perluProvinsi ? (
            <Select
              aria-label="Provinsi (untuk pagu)"
              className={SEL_KECIL}
              value={biaya.provinsi ?? ""}
              onChange={(e) => {
                const pVal = e.target.value || null;
                const tarifAuto =
                  biaya.jenis === "TAKSI_TERMINAL" &&
                  pVal &&
                  sbm &&
                  !biaya.tarif
                    ? tarifTerminal(sbm, pVal)
                    : undefined;
                onUbah({
                  provinsi: pVal,
                  ...(tarifAuto ? { tarif: tarifAuto } : {}),
                });
              }}
            >
              <option value="">- pilih provinsi -</option>
              {provinsi.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </Select>
          ) : null}
          {biaya.jenis === "TRANSPORT_JAKARTA_SEKITAR" ? (
            <Select
              aria-label="Kab/kota sekitar Jakarta"
              className={SEL_KECIL}
              value={biaya.uraian ?? ""}
              onChange={(e) => {
                const kota = e.target.value;
                const barisSbm = sbm?.transportJakarta.find(
                  (t) => t.kabKota === kota,
                );
                onUbah({
                  uraian: kota || null,
                  ...(barisSbm ? { tarif: barisSbm.besaran } : {}),
                  ...(!biaya.qty ? { qty: 2 } : {}),
                });
              }}
            >
              <option value="">- pilih kota sekitar -</option>
              {(sbm?.transportJakarta ?? []).map((t) => (
                <option key={t.kabKota} value={t.kabKota}>
                  {t.kabKota} ({rupiah(t.besaran)})
                </option>
              ))}
            </Select>
          ) : null}
          {pagu !== undefined ? (
            <p className="text-xs text-muted-foreground tabular-nums">
              Pagu SBM: {rupiah(pagu)}
            </p>
          ) : null}
          {tarifTidakAda ? (
            <p className="text-xs text-amber-600 dark:text-amber-500">
              Tarif taksi {namaProvinsiPagu} belum ada di SBM (PMK 32/2025); isi
              manual sesuai bukti.
            </p>
          ) : null}
          {baris?.catatan ? (
            <p className="text-xs text-muted-foreground">{baris.catatan}</p>
          ) : null}
        </div>
      </td>
      <td className="p-2">
        <Input
          aria-label="Jumlah"
          className="h-8 px-1 text-center text-xs"
          type="number"
          min={1}
          placeholder="1"
          value={biaya.qty ?? ""}
          onChange={(e) =>
            onUbah({
              qty: e.target.value === "" ? null : Number(e.target.value),
            })
          }
        />
      </td>
      <td className="p-2">
        <div className="relative">
          <RupiahInput
            awalan
            aria-label="Tarif satuan (Rp)"
            className={cn("h-8 text-xs", tarifSbm !== undefined && "pr-7")}
            nolKosong
            value={biaya.tarif}
            onChange={(v) => onUbah({ tarif: v ?? 0 })}
          />
          {tarifSbm !== undefined ? (
            tarifMengikutiSbm ? (
              <span
                title="Terisi otomatis dari SBM"
                className="absolute inset-y-0 right-2 flex items-center text-muted-foreground/60"
              >
                <SparklesIcon className="size-3.5" aria-hidden />
              </span>
            ) : (
              <button
                type="button"
                title="Kembali ke tarif SBM"
                aria-label="Kembali ke tarif SBM"
                onClick={() => onUbah({ tarif: tarifSbm })}
                className="absolute inset-y-0 right-1.5 flex items-center rounded px-0.5 text-muted-foreground hover:text-primary focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
              >
                <RotateCcwIcon className="size-3.5" aria-hidden />
              </button>
            )
          ) : null}
        </div>
        {tarifKosong ? (
          <p className="mt-1 text-[11px] leading-tight text-amber-700 dark:text-amber-500">
            Belum ada tarif (tidak dicetak)
          </p>
        ) : null}
      </td>
      <td
        className="p-2 text-right font-mono text-sm font-medium tabular-nums"
        title={baris ? `Tercetak: ${baris.uraian}` : undefined}
      >
        <span className="inline-block pt-1">{rupiah(subtotal)}</span>
      </td>
      <td className="p-2">
        <div className="grid gap-1.5">
          {perluUraian && biaya.jenis !== "TRANSPORT_JAKARTA_SEKITAR" ? (
            <TextareaOtomatis
              aria-label={uraianLabel}
              className={TEKS_KECIL}
              placeholder={
                biaya.jenis === "TAKSI_TERMINAL"
                  ? "Otomatis: taksi dari-ke bandara/terminal"
                  : uraianLabel
              }
              value={biaya.uraian ?? ""}
              onChange={(e) => onUbah({ uraian: e.target.value || null })}
            />
          ) : null}
          <TextareaOtomatis
            aria-label="Keterangan"
            className={TEKS_KECIL}
            placeholder={
              biaya.jenis === "TAKSI_KEDUDUKAN" ||
              biaya.jenis === "TAKSI_TERMINAL"
                ? "Keterangan"
                : "Tanggal / no. tiket / bukti"
            }
            value={biaya.keterangan ?? ""}
            onChange={(e) => onUbah({ keterangan: e.target.value || null })}
          />
        </div>
      </td>
      <td className="p-2 text-center">
        <input
          type="checkbox"
          title="Tanpa kuitansi resmi (DPR)"
          aria-label="Tanpa kuitansi resmi (dicatat di DPR)"
          checked={!!biaya.pengeluaranRiil}
          onChange={(e) => onUbah({ pengeluaranRiil: e.target.checked })}
          className="mt-2 size-4 rounded border-border text-primary focus:ring-primary"
        />
      </td>
      <td className="p-2 text-center">
        <button
          type="button"
          onClick={onHapus}
          title="Hapus biaya"
          aria-label="Hapus biaya"
          className="rounded p-1.5 text-red-600 transition-colors hover:bg-red-50 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none dark:text-red-400 dark:hover:bg-red-950/40"
        >
          <Trash2Icon className="size-4" aria-hidden />
        </button>
      </td>
    </tr>
  );
}

/** Baris judul kelompok dalam tabel biaya, dengan subtotal kelompok di kanan. */
export function BarisKelompok({ judul, subtotal, catatan }: { judul: string; subtotal: number; catatan?: string }) {
  return (
    <tr className="border-t border-slate-200 bg-slate-50/70 first:border-t-0 dark:border-slate-800 dark:bg-slate-900/40">
      <th colSpan={3} scope="colgroup" className="px-2 py-1.5 text-left text-xs font-semibold text-slate-700 dark:text-slate-300">
        {judul}
        {catatan ? <span className="ml-2 font-normal text-muted-foreground">{catatan}</span> : null}
      </th>
      <td className="px-2 py-1.5 text-right font-mono text-xs font-semibold tabular-nums">{rupiah(subtotal)}</td>
      <td colSpan={3} />
    </tr>
  )
}

/** Baris hasil hitung otomatis (uang harian, penginapan): hanya baca. */
export function BarisHitung({ baris }: { baris: BarisBiaya }) {
  return (
    <tr className="align-top border-t border-slate-200 dark:border-slate-800">
      <td className="p-2 text-xs">
        <p>{baris.uraian}</p>
        {baris.catatan ? <p className="mt-0.5 text-muted-foreground">{baris.catatan}</p> : null}
      </td>
      <td className="p-2 text-center text-xs tabular-nums">{baris.qty ? `${baris.qty}${baris.satuan ? ` ${baris.satuan}` : ''}` : '-'}</td>
      <td className="p-2 text-right text-xs tabular-nums">{baris.tarif ? rupiah(baris.tarif) : '-'}</td>
      <td className="p-2 text-right font-mono text-sm font-medium tabular-nums">{rupiah(baris.jumlah)}</td>
      <td colSpan={3} className="p-2 text-xs text-muted-foreground">
        {baris.keterangan}
      </td>
    </tr>
  )
}
