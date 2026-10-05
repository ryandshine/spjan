export const BULAN = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
] as const;

/** Kunci pencarian: spasi dirapikan dan huruf besar. */
export function norm(s: string): string {
  return s.trim().replace(/\s+/g, " ").toUpperCase();
}

/** "D.I. YOGYAKARTA" -> "D.I. Yogyakarta". */
export function proper(s: string): string {
  return s
    .toLowerCase()
    .replace(/(^|[^\p{L}])(\p{L})/gu, (_m, p: string, c: string) => p + c.toUpperCase());
}

/** 1234567 -> "1.234.567" */
export function formatAngka(n: number): string {
  const sign = n < 0 ? "-" : "";
  const digits = String(Math.abs(Math.round(n)));
  return sign + digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

export function formatRp(n: number): string {
  return `Rp${formatAngka(n)}`;
}

export interface Tanggal {
  y: number;
  m: number;
  d: number;
}

export function parseTanggal(iso: string | null | undefined): Tanggal | null {
  if (!iso) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return null;
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  const t = new Date(Date.UTC(y, m - 1, d));
  if (t.getUTCFullYear() !== y || t.getUTCMonth() !== m - 1 || t.getUTCDate() !== d) return null;
  return { y, m, d };
}

/** Selisih hari kalender b - a. */
export function selisihHari(a: Tanggal, b: Tanggal): number {
  const ms = Date.UTC(b.y, b.m - 1, b.d) - Date.UTC(a.y, a.m - 1, a.d);
  return Math.round(ms / 86_400_000);
}

function namaBulan(m: number): string {
  return BULAN[m - 1] ?? "";
}

/** "8 September 2026"; string kosong bila tanggal tidak valid. */
export function tanggalIndonesia(iso: string | null | undefined): string {
  const t = parseTanggal(iso);
  return t ? `${t.d} ${namaBulan(t.m)} ${t.y}` : "";
}

/** Mengubah Tanggal menjadi string ISO "YYYY-MM-DD" */
export function toIsoTanggal(t: Tanggal): string {
  const mm = String(t.m).padStart(2, "0");
  const dd = String(t.d).padStart(2, "0");
  return `${t.y}-${mm}-${dd}`;
}

/** Menghasilkan daftar tanggal ISO berturut-turut dari tanggal a sampai b (inklusif). */
export function daftarHariIso(a: Tanggal, b: Tanggal): string[] {
  const list: string[] = [];
  const cur = new Date(Date.UTC(a.y, a.m - 1, a.d));
  const end = new Date(Date.UTC(b.y, b.m - 1, b.d));
  while (cur <= end) {
    const y = cur.getUTCFullYear();
    const m = cur.getUTCMonth() + 1;
    const d = cur.getUTCDate();
    list.push(toIsoTanggal({ y, m, d }));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return list;
}

/**
 * Format daftar tanggal menjadi frasa bahasa Indonesia yang rapi:
 * - 1 hari: "11 September 2026"
 * - Berurutan: "11 s.d. 12 September 2026"
 * - Terpisah: "10 dan 13 September 2026"
 * - Campuran: "10 s.d. 11 dan 13 September 2026"
 * - Lintas bulan: "30 September dan 2 Oktober 2026"
 */
export function formatDaftarTanggal(isoList: string[]): string {
  if (isoList.length === 0) return "";
  const sorted = [...new Set(isoList)].sort();
  const parsed = sorted.map(parseTanggal).filter((t): t is Tanggal => t !== null);
  if (parsed.length === 0) return "";

  const segments: Array<{ start: Tanggal; end: Tanggal }> = [];
  let curStart = parsed[0]!;
  let curEnd = parsed[0]!;

  for (let i = 1; i < parsed.length; i++) {
    const next = parsed[i]!;
    if (selisihHari(curEnd, next) === 1) {
      curEnd = next;
    } else {
      segments.push({ start: curStart, end: curEnd });
      curStart = next;
      curEnd = next;
    }
  }
  segments.push({ start: curStart, end: curEnd });

  const allSameMonthYear = segments.every(
    (s) =>
      s.start.y === segments[0]!.start.y &&
      s.start.m === segments[0]!.start.m &&
      s.end.m === segments[0]!.start.m &&
      s.end.y === segments[0]!.start.y
  );

  if (allSameMonthYear) {
    const m = segments[0]!.start.m;
    const y = segments[0]!.start.y;
    const segTexts = segments.map((s) => (s.start.d === s.end.d ? `${s.start.d}` : `${s.start.d} s.d. ${s.end.d}`));
    let joined = "";
    if (segTexts.length === 1) {
      joined = segTexts[0]!;
    } else if (segTexts.length === 2) {
      joined = `${segTexts[0]} dan ${segTexts[1]}`;
    } else {
      joined = `${segTexts.slice(0, -1).join(", ")} dan ${segTexts[segTexts.length - 1]}`;
    }
    return `${joined} ${namaBulan(m)} ${y}`;
  }

  const segTexts = segments.map((s) => {
    if (s.start.y === s.end.y && s.start.m === s.end.m && s.start.d === s.end.d) {
      return `${s.start.d} ${namaBulan(s.start.m)} ${s.start.y}`;
    }
    return rentangSptb(s.start, s.end);
  });

  if (segTexts.length === 1) return segTexts[0]!;
  if (segTexts.length === 2) return `${segTexts[0]} dan ${segTexts[1]}`;
  return `${segTexts.slice(0, -1).join(", ")} dan ${segTexts[segTexts.length - 1]}`;
}

/** Rentang untuk Rincian: "10-13 September 2026", "30 September - 2 Oktober 2026". */
export function rentangRincian(a: Tanggal, b: Tanggal): string {
  if (a.y === b.y && a.m === b.m && a.d === b.d) return `${a.d} ${namaBulan(a.m)} ${a.y}`;
  if (a.y === b.y && a.m === b.m) return `${a.d}-${b.d} ${namaBulan(b.m)} ${b.y}`;
  const tahunA = a.y === b.y ? "" : ` ${a.y}`;
  return `${a.d} ${namaBulan(a.m)}${tahunA} - ${b.d} ${namaBulan(b.m)} ${b.y}`;
}

/** Rentang untuk SPTB: "10 s.d. 13 September 2026", "30 September s.d. 2 Oktober 2026". */
export function rentangSptb(a: Tanggal, b: Tanggal): string {
  if (a.y === b.y && a.m === b.m && a.d === b.d) return `${a.d} ${namaBulan(a.m)} ${a.y}`;
  if (a.y === b.y && a.m === b.m) return `${a.d} s.d. ${b.d} ${namaBulan(b.m)} ${b.y}`;
  const tahunA = a.y === b.y ? "" : ` ${a.y}`;
  return `${a.d} ${namaBulan(a.m)}${tahunA} s.d. ${b.d} ${namaBulan(b.m)} ${b.y}`;
}

const SATUAN = ["", "satu", "dua", "tiga", "empat", "lima", "enam", "tujuh", "delapan", "sembilan", "sepuluh", "sebelas"];

function tigaDigit(n: number): string {
  const parts: string[] = [];
  const ratus = Math.floor(n / 100);
  const sisa = n % 100;
  if (ratus === 1) parts.push("seratus");
  else if (ratus > 1) parts.push(`${SATUAN[ratus]} ratus`);
  if (sisa > 0) {
    if (sisa < 12) parts.push(SATUAN[sisa] ?? "");
    else if (sisa < 20) parts.push(`${SATUAN[sisa - 10]} belas`);
    else {
      const puluh = Math.floor(sisa / 10);
      const satuan = sisa % 10;
      parts.push(`${SATUAN[puluh]} puluh`);
      if (satuan > 0) parts.push(SATUAN[satuan] ?? "");
    }
  }
  return parts.join(" ");
}

/** Angka bulat 0 .. < 10^12 dalam kata (huruf kecil): 1001000 -> "satu juta seribu". */
export function angkaKata(n: number): string {
  if (!Number.isInteger(n) || n < 0 || n >= 1_000_000_000_000) {
    throw new RangeError(`angkaKata: di luar jangkauan (${n})`);
  }
  if (n === 0) return "nol";
  const grup: Array<[number, string]> = [
    [1_000_000_000, "miliar"],
    [1_000_000, "juta"],
    [1_000, "ribu"],
    [1, ""],
  ];
  const parts: string[] = [];
  let sisa = n;
  for (const [nilai, nama] of grup) {
    const jumlah = Math.floor(sisa / nilai);
    sisa -= jumlah * nilai;
    if (jumlah === 0) continue;
    if (nama === "ribu" && jumlah === 1) parts.push("seribu");
    else parts.push(nama ? `${tigaDigit(jumlah)} ${nama}` : tigaDigit(jumlah));
  }
  return parts.join(" ");
}

function judul(s: string): string {
  return s
    .split(" ")
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(" ");
}

/** 4715000 -> "Empat Juta Tujuh Ratus Lima Belas Ribu Rupiah" */
export function terbilangRupiah(n: number): string {
  return `${judul(angkaKata(Math.round(n)))} Rupiah`;
}
