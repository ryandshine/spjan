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
// Master template docx: assets/template-spt.docx (persis 100% dengan CONTOH SPT.docx)
const TEMPLATE_PATH = path.resolve(__dirname, "../../assets/template-spt.docx");

const W_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";

// Lebar area teks A4 dengan margin kiri/kanan 2 cm: 11906 - 2 x 1134 dxa.
const LEBAR_TEKS = 9638;
const KOL_LABEL = 1418; // 2,5 cm
const KOL_TITIK_DUA = 284; // 0,5 cm
const KOL_ISI = LEBAR_TEKS - KOL_LABEL - KOL_TITIK_DUA;
const GANTUNG_BUTIR = 425; // 0,75 cm: lebar nomor "1." / "a." sebelum teks
const INDENT_TTD = 4536; // 8 cm dari margin kiri

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
    `<w:spacing w:before="${o.sebelum ?? 0}" w:after="${o.sesudah ?? 0}" w:line="240" w:lineRule="auto"/>` +
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
  sesudahTerakhir = 100,
): string {
  return butir
    .map((teks, i) => {
      const nomor = gaya === "huruf" ? `${String.fromCharCode(97 + i)}.` : `${i + 1}.`;
      return butirXml(nomor, teks, {
        jc,
        sesudah: i === butir.length - 1 ? sesudahTerakhir : 20,
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

  const doc = new DOMParser().parseFromString(docXml, "text/xml");
  const body = doc.getElementsByTagName("w:body")[0];
  if (!body) {
    throw new Error("w:body tidak ditemukan pada document.xml");
  }

  const lamaHari = data.lamaHari || hitungLamaHariSt(data.tanggalMulai, data.tanggalSelesai);
  const rentangTanggal = formatRentangWaktuSt(data.tanggalMulai, data.tanggalSelesai);

  // Standar Kop Kementerian & Tata Naskah Dinas Resmi (PermenPANRB / Permen LHK):
  // Margin Simetris: Kiri 2.0 cm (1134 dxa), Kanan 2.0 cm (1134 dxa), Atas 1.5 cm (850 dxa), Bawah 2.5 cm (1418 dxa)
  // Posisi Garis Pembatas: Lebar 17.0 cm membentang simetris sama jaraknya dari kiri dan kanan kertas (2.0 cm)
  const pgMar = doc.getElementsByTagName("w:pgMar")[0];
  if (pgMar) {
    pgMar.setAttribute("w:top", "850");
    pgMar.setAttribute("w:right", "1134");
    pgMar.setAttribute("w:bottom", "1418");
    pgMar.setAttribute("w:left", "1134");
  }

  // 0. Font Kop Surat (P0, P1, P2): Menggunakan font Figtree, posisi Center murni (simetris sumbu tengah kertas x = 10.5 cm)
  const kopSizes = ["28", "26", "25"]; // P0: 14pt, P1: 13pt, P2: 12.5pt Figtree Bold
  for (let idx = 0; idx <= 2; idx++) {
    const pKop = body.childNodes[idx] as Element | undefined;
    if (pKop) {
      const pPr = pKop.getElementsByTagName("w:pPr")[0];
      if (pPr) {
        // Hapus indentasi manual agar teks benar-benar di titik tengah (center) kertas
        const ind = pPr.getElementsByTagName("w:ind")[0];
        if (ind) pPr.removeChild(ind);
        let jc = pPr.getElementsByTagName("w:jc")[0];
        if (!jc) {
          jc = doc.createElement("w:jc");
          pPr.appendChild(jc);
        }
        jc.setAttribute("w:val", "center");
      }
      const runs = pKop.getElementsByTagName("w:r");
      for (let rIdx = 0; rIdx < runs.length; rIdx++) {
        const r = runs[rIdx];
        if (!r) continue;
        if (r.getElementsByTagName("w:drawing").length > 0) continue;
        const rPr = r.getElementsByTagName("w:rPr")[0];
        if (rPr) {
          let rFonts = rPr.getElementsByTagName("w:rFonts")[0];
          if (!rFonts) {
            rFonts = doc.createElement("w:rFonts");
            rPr.appendChild(rFonts);
          }
          rFonts.setAttribute("w:ascii", "Figtree");
          rFonts.setAttribute("w:hAnsi", "Figtree");
          rFonts.setAttribute("w:cs", "Arial");

          let sz = rPr.getElementsByTagName("w:sz")[0];
          if (!sz) {
            sz = doc.createElement("w:sz");
            rPr.appendChild(sz);
          }
          sz.setAttribute("w:val", kopSizes[idx]!);
          let szCs = rPr.getElementsByTagName("w:szCs")[0];
          if (!szCs) {
            szCs = doc.createElement("w:szCs");
            rPr.appendChild(szCs);
          }
          szCs.setAttribute("w:val", kopSizes[idx]!);
        }
      }
    }
  }

  // Kop (logo, tiga baris instansi, garis pembatas) = 5 elemen pertama template dan dipertahankan.
  // Seluruh badan surat di bawahnya dibangun ulang: tabel label bertitik dua, indentasi gantung
  // sungguhan, dan blok tanda tangan tanpa paragraf kosong atau spasi pengisi.
  const sectPr = body.getElementsByTagName("w:sectPr")[0];
  const KOP_ELEMEN = 5;
  while (body.childNodes.length > KOP_ELEMEN) {
    const node = body.childNodes[KOP_ELEMEN];
    if (!node || node === sectPr) break;
    body.removeChild(node);
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
    paragrafXml(runXml("SURAT TUGAS", true), { jc: "center", sebelum: 240, tahanBersama: true }),
    paragrafXml(runXml(`Nomor: ${nomorTeks}`), { jc: "center", sesudah: 160, tahanBersama: true }),
    paragrafXml(runXml("DIREKTUR PENGENDALIAN PERHUTANAN SOSIAL,", true), {
      jc: "center",
      sesudah: 80,
      tahanBersama: true,
    }),
    tabelLabelXml([
      { label: "Menimbang", isi: daftarXml(menimbang, "huruf", "both") },
      { label: "Dasar", isi: daftarXml(dasar, "angka", "both") },
    ]),
    paragrafXml(runXml("MEMBERI TUGAS,"), { jc: "center", sebelum: 40, sesudah: 100, tahanBersama: true }),
    tabelLabelXml([
      { label: "Kepada", isi: daftarXml(kepada, "angka", "left") },
      { label: "Untuk", isi: daftarXml(untuk, "angka", "both", 0) },
    ]),
    // Blok tanda tangan: satu kesatuan (keepNext) bersama tembusan agar tidak terpisah antarhalaman.
    paragrafXml(runXml(tanggalTeks), { kiri: INDENT_TTD, sebelum: 200, tahanBersama: true }),
    paragrafXml(runXml(jabatanTtd), { kiri: INDENT_TTD, tahanBersama: true }),
    paragrafXml(runXml("${ttd_pengirim}"), {
      kiri: INDENT_TTD,
      sebelum: 480,
      sesudah: 480,
      tahanBersama: true,
    }),
    paragrafXml(runXml(data.penandatanganNama || ""), { kiri: INDENT_TTD, tahanBersama: true }),
    paragrafXml(runXml(data.penandatanganNip ? `NIP. ${data.penandatanganNip}` : ""), {
      kiri: INDENT_TTD,
      sesudah: 200,
      tahanBersama: tembusan.length > 0,
    }),
    ...(tembusan.length > 0
      ? [
          paragrafXml(runXml("Tembusan:"), { tahanBersama: true }),
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

  const fontXml = await zip.file("word/fontTable.xml")?.async("text");
  if (fontXml && !fontXml.includes('w:name="Figtree"')) {
    const fontEntry =
      '<w:font w:name="Figtree"><w:panose1 w:val="020B0604020202020204"/><w:family w:val="swiss"/><w:pitch w:val="variable"/></w:font></w:fonts>';
    const updatedFontXml = fontXml.replace("</w:fonts>", fontEntry);
    zip.file("word/fontTable.xml", updatedFontXml);
  }

  const generatedBuffer = await zip.generateAsync({ type: "nodebuffer" });
  return generatedBuffer;
}
