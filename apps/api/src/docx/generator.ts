import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import JSZip from "jszip";
import { DOMParser, XMLSerializer, type Element, type Document, type Node } from "@xmldom/xmldom";
import {
  formatHariDenganTerbilang,
  formatRentangWaktuSt,
  hitungLamaHariSt,
  tanggalIndonesia,
  type NaskahStDto,
  type NaskahStPayload,
} from "@spjan/shared";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Master template docx: assets/template-spt.docx (salinan CONTOH SPT.docx; hanya logo dan garis kop yang dipakai)
const TEMPLATE_PATH = path.resolve(__dirname, "../../assets/template-spt.docx");

const W_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";

// Geometri mengikuti ST.265 / CONTOH SPT (satuan dxa: 1 cm = 567).
// Halaman A4 11906 dxa; margin kiri 1,78 cm, kanan 2,0 cm, atas 1,0 cm, bawah 2,5 cm.
// Garis ganda kop: simetris terhadap lebar kertas. Jarak ke tepi kiri/kanan 0,99 cm (356235 EMU),
// sama dengan posisi kiri pada CONTOH SPT; template aslinya berhenti 0,21 cm dari tepi kanan.
const EMU_PER_DXA = 635;
const GARIS_JARAK_TEPI_EMU = 356235;
const GARIS_LEBAR_ASLI_EMU = 7127875;
const GARIS_LEBAR_EMU = 11906 * EMU_PER_DXA - 2 * GARIS_JARAK_TEPI_EMU;
const MARGIN_ATAS = 567;
const MARGIN_KANAN = 1134;
const MARGIN_BAWAH = 1418;
const MARGIN_KIRI = 1009;
const LEBAR_TEKS = 11906 - MARGIN_KIRI - MARGIN_KANAN; // 9763
const KOL_LABEL = 1417; // label "Menimbang" dst: 2,5 cm (titik dua jatuh di x = 4,28 cm)
const KOL_TITIK_DUA = 397; // 0,7 cm (isi mulai di x = 4,98 cm)
const KOL_ISI = LEBAR_TEKS - KOL_LABEL - KOL_TITIK_DUA;
const GANTUNG_BUTIR = 340; // 0,6 cm: lebar nomor "1." / "a." sebelum teks
const INDENT_TTD = 4536; // 8 cm dari margin kiri: blok tanda tangan mulai di x = 9,78 cm
const INDENT_KOP = 1706; // teks kop mulai di kanan logo (logo berakhir di x = 4,79 cm)
const INDENT_KOP_KANAN = -188; // teks kop boleh melewati margin kanan 0,33 cm, seperti CONTOH SPT
const TINGGI_BARIS_KOP = 328; // 16,4 pt: baris kop 14 pt (0,58 cm); lebar Figtree Bold 15 pt baris ketiga = 13,2 cm dari ruang 14,5 cm
const TINGGI_BARIS_KOP_3 = 376; // 18,8 pt: baris kop ketiga 15 pt (0,66 cm)
const SATU_BARIS = 258; // satu baris kosong Bookman 11 pt (0,455 cm)
const JARAK_KE_JUDUL = 771; // kop selesai di y = 2,82 cm, "SURAT TUGAS" mulai di y = 4,18 cm
const JARAK_RUANG_TTD = 774; // tiga baris untuk tanda tangan elektronik / basah

function esc(teks: string): string {
  return teks.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function rPrXml(tebal: boolean): string {
  return (
    '<w:rPr><w:rFonts w:ascii="Bookman Old Style" w:hAnsi="Bookman Old Style" w:cs="Arial"/>' +
    (tebal ? "<w:b/>" : "") +
    '<w:sz w:val="22"/><w:szCs w:val="22"/><w:lang w:val="id-ID"/></w:rPr>'
  );
}

function runXml(teks: string, tebal = false): string {
  return `<w:r>${rPrXml(tebal)}<w:t xml:space="preserve">${esc(teks)}</w:t></w:r>`;
}

/** Baris kop: Figtree tebal (Permenhut 1/2025 Pasal 56 ayat 3), rata tengah di sebelah kanan logo. */
function kopParagrafXml(teks: string, ukuranPt: number, tinggiBaris: number, rapat = 0): string {
  const ukuran = ukuranPt * 2;
  return (
    `<w:p><w:pPr><w:keepNext/><w:spacing w:before="0" w:after="0" w:line="${tinggiBaris}" w:lineRule="exact"/>` +
    `<w:ind w:left="${INDENT_KOP}" w:right="${INDENT_KOP_KANAN}"/><w:jc w:val="center"/></w:pPr>` +
    '<w:r><w:rPr><w:rFonts w:ascii="Figtree" w:hAnsi="Figtree" w:cs="Figtree"/><w:b/>' +
    (rapat ? `<w:spacing w:val="${rapat}"/>` : "") +
    `<w:sz w:val="${ukuran}"/><w:szCs w:val="${ukuran}"/><w:lang w:val="id-ID"/></w:rPr>` +
    `<w:t xml:space="preserve">${esc(teks)}</w:t></w:r></w:p>`
  );
}

function tabXml(): string {
  return `<w:r>${rPrXml(false)}<w:tab/></w:r>`;
}

interface OpsiParagraf {
  jc?: "left" | "center" | "both";
  kiri?: number;
  gantung?: number;
  sebelum?: number;
  sesudah?: number;
  tahanBersama?: boolean;
}

function paragrafXml(isi: string, o: OpsiParagraf = {}): string {
  const ind =
    o.kiri || o.gantung
      ? `<w:ind w:left="${o.kiri ?? 0}"${o.gantung ? ` w:hanging="${o.gantung}"` : ""}/>`
      : "";
  return (
    "<w:p><w:pPr>" +
    (o.tahanBersama ? "<w:keepNext/><w:keepLines/>" : "<w:keepLines/>") +
    `<w:spacing w:before="${o.sebelum ?? 0}" w:after="${o.sesudah ?? 0}" w:line="${SATU_BARIS}" w:lineRule="exact"/>` +
    ind +
    `<w:jc w:val="${o.jc ?? "left"}"/>` +
    "</w:pPr>" +
    isi +
    "</w:p>"
  );
}

function butirXml(nomor: string, teks: string, o: OpsiParagraf = {}): string {
  return paragrafXml(runXml(nomor) + tabXml() + runXml(teks), {
    kiri: GANTUNG_BUTIR,
    gantung: GANTUNG_BUTIR,
    ...o,
  });
}

/** Daftar butir bernomor; jarak ke baris tabel berikutnya hanya setelah butir terakhir. */
function daftarXml(
  butir: string[],
  gaya: "angka" | "huruf",
  jc: "left" | "both",
  sesudahTerakhir = 0,
): string {
  return butir
    .map((teks, i) => {
      const nomor = gaya === "huruf" ? `${String.fromCharCode(97 + i)}.` : `${i + 1}.`;
      return butirXml(nomor, teks, {
        jc,
        sesudah: i === butir.length - 1 ? sesudahTerakhir : 0,
      });
    })
    .join("");
}

function selXml(lebar: number, isi: string): string {
  return `<w:tc><w:tcPr><w:tcW w:w="${lebar}" w:type="dxa"/></w:tcPr>${isi}</w:tc>`;
}

/** Tabel tanpa garis: label | titik dua | isi, lebar kolom tetap agar titik dua selalu sejajar. */
function tabelLabelXml(baris: Array<{ label: string; isi: string }>): string {
  const rows = baris
    .map(
      (b) =>
        "<w:tr><w:trPr><w:cantSplit/></w:trPr>" +
        selXml(KOL_LABEL, paragrafXml(runXml(b.label))) +
        selXml(KOL_TITIK_DUA, paragrafXml(runXml(":"))) +
        selXml(KOL_ISI, b.isi) +
        "</w:tr>",
    )
    .join("");
  return (
    "<w:tbl><w:tblPr>" +
    `<w:tblW w:w="${LEBAR_TEKS}" w:type="dxa"/><w:tblInd w:w="0" w:type="dxa"/>` +
    '<w:tblLayout w:type="fixed"/>' +
    '<w:tblCellMar><w:top w:w="0" w:type="dxa"/><w:left w:w="0" w:type="dxa"/><w:bottom w:w="0" w:type="dxa"/><w:right w:w="0" w:type="dxa"/></w:tblCellMar>' +
    "</w:tblPr>" +
    `<w:tblGrid><w:gridCol w:w="${KOL_LABEL}"/><w:gridCol w:w="${KOL_TITIK_DUA}"/><w:gridCol w:w="${KOL_ISI}"/></w:tblGrid>` +
    rows +
    "</w:tbl>"
  );
}

/** Daftar dengan tanda baca seragam: butir akhir "." dan sebelumnya ";" (menghindari campur aduk ketikan pengguna). */
function rapikanPenutup(daftar: string[]): string[] {
  const bersih = daftar.map((t) => t.trim().replace(/[;.]+$/, "")).filter(Boolean);
  return bersih.map((t, i) => (i === bersih.length - 1 ? `${t}.` : `${t};`));
}

function fragmenKeNode(doc: Document, xml: string): Node[] {
  const pembungkus = new DOMParser().parseFromString(
    `<w:body xmlns:w="${W_NS}">${xml}</w:body>`,
    "text/xml",
  );
  const hasil: Node[] = [];
  const anak = pembungkus.documentElement?.childNodes;
  for (let i = 0; anak && i < anak.length; i++) {
    const n = anak[i];
    if (n) hasil.push(doc.importNode(n, true));
  }
  return hasil;
}

export async function generateNaskahStDocx(data: NaskahStDto | NaskahStPayload): Promise<Buffer> {
  const templateBuf = await fs.readFile(TEMPLATE_PATH);
  const zip = await JSZip.loadAsync(templateBuf);
  const docXml = await zip.file("word/document.xml")?.async("text");
  if (!docXml) {
    throw new Error("word/document.xml tidak ditemukan pada template");
  }

  // Lebarkan/ciutkan garis di semua representasinya (DrawingML, path, dan fallback VML dalam pt).
  const lebarGarisPt = (GARIS_LEBAR_EMU / 12700).toFixed(2);
  const docXmlSimetris = docXml
    .split(String(GARIS_LEBAR_ASLI_EMU))
    .join(String(GARIS_LEBAR_EMU))
    .replace("width:561.25pt", `width:${lebarGarisPt}pt`);

  const doc = new DOMParser().parseFromString(docXmlSimetris, "text/xml");
  const body = doc.getElementsByTagName("w:body")[0];
  if (!body) {
    throw new Error("w:body tidak ditemukan pada document.xml");
  }

  const lamaHari = data.lamaHari || hitungLamaHariSt(data.tanggalMulai, data.tanggalSelesai);
  const rentangTanggal = formatRentangWaktuSt(data.tanggalMulai, data.tanggalSelesai);

  // Margin halaman mengikuti ST.265 / CONTOH SPT.
  const pgMar = doc.getElementsByTagName("w:pgMar")[0];
  if (pgMar) {
    pgMar.setAttribute("w:top", String(MARGIN_ATAS));
    pgMar.setAttribute("w:right", String(MARGIN_KANAN));
    pgMar.setAttribute("w:bottom", String(MARGIN_BAWAH));
    pgMar.setAttribute("w:left", String(MARGIN_KIRI));
  }

  // Ambil dua objek gambar kop dari template apa adanya: logo (2,80 cm di x = 1,99 cm) dan garis ganda
  // (selebar 19,8 cm di y = 3,71 cm). Semua paragraf lain dibangun ulang.
  const semuaParagraf = Array.from(body.childNodes).filter((n) => n.nodeName === "w:p") as Element[];
  const paragrafLogo = semuaParagraf.find((p) => p.getElementsByTagName("wp:anchor").length > 0);
  const paragrafGaris = semuaParagraf.find((p) => p.getElementsByTagName("mc:AlternateContent").length > 0);
  const runLogo = paragrafLogo?.getElementsByTagName("w:r")[0];
  const runGaris = paragrafGaris?.getElementsByTagName("w:r")[0];
  if (!runLogo || !runGaris) {
    throw new Error("Logo atau garis kop tidak ditemukan pada template");
  }
  const logo = runLogo.cloneNode(true) as Element;
  const garis = runGaris.cloneNode(true) as Element;
  // Garis hanya objek mengambang: tinggi barisnya dibuat 1 pt agar tidak menambah jarak vertikal.
  for (const rPr of Array.from(garis.getElementsByTagName("w:rPr"))) {
    for (const tag of ["w:sz", "w:szCs"]) {
      const el = rPr.getElementsByTagName(tag)[0];
      if (el) el.setAttribute("w:val", "2");
    }
  }

  const sectPr = body.getElementsByTagName("w:sectPr")[0];
  while (body.firstChild && body.firstChild !== sectPr) {
    body.removeChild(body.firstChild);
  }

  const [pKop1, pKop2, pKop3] = [
    kopParagrafXml("KEMENTERIAN KEHUTANAN", 14, TINGGI_BARIS_KOP),
    kopParagrafXml("DIREKTORAT JENDERAL PERHUTANAN SOSIAL", 14, TINGGI_BARIS_KOP),
    kopParagrafXml("DIREKTORAT PENGENDALIAN PERHUTANAN SOSIAL", 15, TINGGI_BARIS_KOP_3),
  ].map((x) => fragmenKeNode(doc, x)[0] as Element);
  pKop1!.insertBefore(logo, pKop1!.getElementsByTagName("w:r")[0] ?? null);
  const pGaris = fragmenKeNode(
    doc,
    '<w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="20" w:lineRule="exact"/></w:pPr></w:p>',
  )[0] as Element;
  pGaris.appendChild(garis);
  for (const node of [pKop1!, pKop2!, pKop3!, pGaris]) {
    body.insertBefore(node, sectPr ?? null);
  }

  const nomorTeks =
    data.modeNomor === "manual" && data.nomor && data.nomor !== "${nomor_naskah}"
      ? data.nomor
      : "${nomor_naskah}";
  const tanggalTeks =
    data.modeNomor === "manual" && data.tanggal
      ? `${data.tempatNaskah || "Jakarta"}, ${tanggalIndonesia(data.tanggal)}`
      : `${data.tempatNaskah || "Jakarta"}, \${tanggal_naskah}`;

  const maksud = (data.maksudTugas || "").trim() || "…";
  const lokasi = (data.lokasiTugas || "").trim() || "…";
  const pembebanan = data.pembebananAnggaran.endsWith(".")
    ? data.pembebananAnggaran
    : `${data.pembebananAnggaran}.`;
  const rawJab = (data.penandatanganJabatan || "Direktur,").trim();
  const jabatanTtd = rawJab.endsWith(",") ? rawJab : `${rawJab},`;

  const menimbang = [
    `bahwa dalam rangka ${maksud}, diperlukan untuk menugaskan personil;`,
    "bahwa sehubungan dengan poin a perlu diterbitkan Surat Tugas.",
  ];
  const dasar = rapikanPenutup([
    ...(data.dasarHukum || []),
    ...(data.dasarSpesifik ? [data.dasarSpesifik] : []),
  ]);
  const kepada = (data.pelaksana || []).map((pel) => {
    const jab = (pel.jabatan || "").trim().replace(/^\/\s*/, "");
    return jab ? `${pel.nama} / ${jab}` : pel.nama;
  });
  const untuk = [
    `Melaksanakan perjalanan dinas dalam rangka ${maksud} di ${lokasi};`,
    `Yang bersangkutan melaksanakan perintah tugas selama ${formatHariDenganTerbilang(lamaHari)} hari pada tanggal ${rentangTanggal};`,
    `Selambat-lambatnya ${formatHariDenganTerbilang(data.pelaporanHari || 5)} hari setelah melaksanakan tugas, membuat laporan tertulis kepada Direktur PPS;`,
    `Biaya dibebankan kepada ${pembebanan}`,
  ];
  const tembusan = rapikanPenutup(data.tembusan || []);

  const xml = [
    paragrafXml(runXml("SURAT TUGAS", true), { jc: "center", sebelum: JARAK_KE_JUDUL, tahanBersama: true }),
    paragrafXml(runXml(`Nomor: ${nomorTeks}`), { jc: "center", tahanBersama: true }),
    paragrafXml(runXml("DIREKTUR PENGENDALIAN PERHUTANAN SOSIAL,", true), {
      jc: "center",
      sebelum: SATU_BARIS,
      tahanBersama: true,
    }),
    tabelLabelXml([
      { label: "Menimbang", isi: daftarXml(menimbang, "huruf", "both") },
      { label: "Dasar", isi: daftarXml(dasar, "angka", "both") },
    ]),
    paragrafXml(runXml("MEMBERI TUGAS,"), { jc: "center", sebelum: 100, sesudah: 110, tahanBersama: true }),
    tabelLabelXml([
      { label: "Kepada", isi: daftarXml(kepada, "angka", "left") },
      { label: "Untuk", isi: daftarXml(untuk, "angka", "both", 0) },
    ]),
    // Blok tanda tangan: satu kesatuan (keepNext) bersama tembusan agar tidak terpisah antarhalaman.
    paragrafXml(runXml(tanggalTeks), { kiri: INDENT_TTD, sebelum: SATU_BARIS, tahanBersama: true }),
    paragrafXml(runXml(jabatanTtd), { kiri: INDENT_TTD, tahanBersama: true }),
    paragrafXml(runXml("${ttd_pengirim}"), {
      kiri: INDENT_TTD,
      sebelum: JARAK_RUANG_TTD,
      tahanBersama: true,
    }),
    paragrafXml(runXml(data.penandatanganNama || ""), {
      kiri: INDENT_TTD,
      sebelum: JARAK_RUANG_TTD,
      tahanBersama: true,
    }),
    paragrafXml(runXml(data.penandatanganNip ? `NIP. ${data.penandatanganNip}` : ""), {
      kiri: INDENT_TTD,
      tahanBersama: tembusan.length > 0,
    }),
    ...(tembusan.length > 0
      ? [
          paragrafXml(runXml("Tembusan:"), { sebelum: SATU_BARIS, tahanBersama: true }),
          ...tembusan.map((t, i) =>
            butirXml(`${i + 1}.`, t, { tahanBersama: i < tembusan.length - 1 }),
          ),
        ]
      : []),
  ].join("");

  for (const node of fragmenKeNode(doc, xml)) {
    body.insertBefore(node, sectPr ?? null);
  }

  const newXml = new XMLSerializer().serializeToString(doc);
  zip.file("word/document.xml", newXml);

  // Daftarkan Figtree agar Word tahu famili cadangannya (sans-serif) bila font belum terpasang.
  const fontXml = await zip.file("word/fontTable.xml")?.async("text");
  if (fontXml && !fontXml.includes('w:name="Figtree"')) {
    const entri =
      '<w:font w:name="Figtree"><w:panose1 w:val="00000000000000000000"/><w:family w:val="swiss"/><w:pitch w:val="variable"/></w:font></w:fonts>';
    zip.file("word/fontTable.xml", fontXml.replace("</w:fonts>", entri));
  }

  const generatedBuffer = await zip.generateAsync({ type: "nodebuffer" });
  return generatedBuffer;
}
