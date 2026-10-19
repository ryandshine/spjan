import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import JSZip from "jszip";
import { DOMParser, XMLSerializer, type Node, type Element, type Document } from "@xmldom/xmldom";
import {
  formatHariDenganTerbilang,
  formatRentangWaktuSt,
  hitungLamaHariSt,
  tanggalIndonesia,
  type NaskahStDto,
  type NaskahStPayload,
} from "@spjan/shared";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Master template docx: assets/template-spt.docx
const TEMPLATE_PATH = path.resolve(__dirname, "../../assets/template-spt.docx");

function clearChildren(node: Node): void {
  while (node.firstChild) {
    node.removeChild(node.firstChild);
  }
}

function cloneParagraphStructure(pTemplate: Element): Element {
  const pNew = pTemplate.cloneNode(true) as Element;
  // Remove all child elements except pPr
  const children = Array.from(pNew.childNodes);
  for (const c of children) {
    const node = c as Node;
    if (node.nodeName !== "w:pPr") {
      pNew.removeChild(node);
    }
  }
  return pNew;
}


function createTextRun(doc: Document, text: string, opts?: { bold?: boolean; font?: string; size?: string }): Element {
  const r = doc.createElement("w:r");
  const rPr = doc.createElement("w:rPr");

  const rFonts = doc.createElement("w:rFonts");
  rFonts.setAttribute("w:ascii", opts?.font || "Bookman Old Style");
  rFonts.setAttribute("w:hAnsi", opts?.font || "Bookman Old Style");
  rFonts.setAttribute("w:cs", "Arial");
  rPr.appendChild(rFonts);

  const sz = doc.createElement("w:sz");
  sz.setAttribute("w:val", opts?.size || "22");
  rPr.appendChild(sz);

  const szCs = doc.createElement("w:szCs");
  szCs.setAttribute("w:val", opts?.size || "22");
  rPr.appendChild(szCs);

  if (opts?.bold) {
    const b = doc.createElement("w:b");
    rPr.appendChild(b);
  }

  const lang = doc.createElement("w:lang");
  lang.setAttribute("w:val", "id-ID");
  rPr.appendChild(lang);

  r.appendChild(rPr);

  const t = doc.createElement("w:t");
  t.setAttribute("xml:space", "preserve");
  t.textContent = text;
  r.appendChild(t);

  return r;
}

function setParagraphTextOnly(doc: Document, pNode: Element, newText: string): void {
  const tNodes = pNode.getElementsByTagName("w:t");
  if (tNodes.length > 0 && tNodes[0]) {
    tNodes[0].textContent = newText;
    // Hapus sisa tNodes jika ada lebih dari satu run dalam paragraf
    for (let i = tNodes.length - 1; i >= 1; i--) {
      const el = tNodes[i];
      if (el && el.parentNode) {
        el.parentNode.removeChild(el);
      }
    }
  } else {
    pNode.appendChild(createTextRun(doc, newText));
  }
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

  // 1. Nomor Surat (P7 di body)
  const p7 = body.childNodes[7] as Element | undefined;
  if (p7) {
    const nomorTeks =
      data.modeNomor === "manual" && data.nomor && data.nomor !== "${nomor_naskah}"
        ? `Nomor: ${data.nomor}`
        : "Nomor: ${nomor_naskah}";
    setParagraphTextOnly(doc, p7, nomorTeks);
  }

  // 2. Jabatan Pemberi Tugas (P9 di body)
  const p9 = body.childNodes[9] as Element | undefined;
  if (p9 && data.penandatanganJabatan) {
    const jabatanAtas =
      data.penandatanganJabatan.toUpperCase().trim().replace(/,+$/, "") + ",";
    setParagraphTextOnly(doc, p9, jabatanAtas);
  }

  const tables = doc.getElementsByTagName("w:tbl");
  const tblMenimbang = tables[0];
  const tblIsi = tables[1];

  // 3. Menimbang (Tbl 0, Row 0, Cell 1)
  if (tblMenimbang) {
    const tr0 = tblMenimbang.getElementsByTagName("w:tr")[0];
    const tc1 = tr0?.getElementsByTagName("w:tc")[1];
    if (tc1) {
      const pList = tc1.getElementsByTagName("w:p");
      const pTemplateA = pList[0];
      const pTemplateB = pList[1];
      if (pTemplateA && pTemplateB) {
        setParagraphTextOnly(
          doc,
          pTemplateA,
          `bahwa dalam rangka ${data.maksudTugas}, diperlukan untuk menugaskan personil;`,
        );
        setParagraphTextOnly(
          doc,
          pTemplateB,
          "bahwa sehubungan dengan poin a perlu diterbitkan Surat Tugas.",
        );
      }
    }
  }

  // 4. Dasar, Kepada, Untuk (Tbl 1)
  if (tblIsi) {
    const rows = tblIsi.getElementsByTagName("w:tr");

    // Row 0: Dasar
    const rowDasar = rows[0];
    const cellDasar = rowDasar?.getElementsByTagName("w:tc")[1];
    if (cellDasar) {
      const pSample = cellDasar.getElementsByTagName("w:p")[0];
      if (pSample) {
        const pTemplate = cloneParagraphStructure(pSample);
        const tcPr = cellDasar.getElementsByTagName("w:tcPr")[0];
        clearChildren(cellDasar);
        if (tcPr) cellDasar.appendChild(tcPr);

        const daftarDasar = [
          ...(data.dasarHukum || []),
          ...(data.dasarSpesifik ? [data.dasarSpesifik] : []),
        ].filter(Boolean);

        for (const item of daftarDasar) {
          const p = pTemplate.cloneNode(true) as Element;
          p.appendChild(createTextRun(doc, item));
          cellDasar.appendChild(p);
        }
      }
    }

    // Row 2: Kepada
    const rowKepada = rows[2];
    const cellKepada = rowKepada?.getElementsByTagName("w:tc")[1];
    if (cellKepada) {
      const pSample = cellKepada.getElementsByTagName("w:p")[0];
      if (pSample) {
        const pTemplate = cloneParagraphStructure(pSample);
        const tcPr = cellKepada.getElementsByTagName("w:tcPr")[0];
        clearChildren(cellKepada);
        if (tcPr) cellKepada.appendChild(tcPr);

        (data.pelaksana || []).forEach((pel, idx) => {
          const p = pTemplate.cloneNode(true) as Element;
          const jabatanStr = pel.jabatan ? `/ ${pel.jabatan}` : "";
          p.appendChild(createTextRun(doc, `${idx + 1}. ${pel.nama}${jabatanStr}`));
          cellKepada.appendChild(p);
        });
      }
    }

    // Row 3: Untuk
    const rowUntuk = rows[3];
    const cellUntuk = rowUntuk?.getElementsByTagName("w:tc")[1];
    if (cellUntuk) {
      const pSample = cellUntuk.getElementsByTagName("w:p")[0];
      if (pSample) {
        const pTemplate = cloneParagraphStructure(pSample);
        const tcPr = cellUntuk.getElementsByTagName("w:tcPr")[0];
        clearChildren(cellUntuk);
        if (tcPr) cellUntuk.appendChild(tcPr);

        const butirUntuk = [
          `Melaksanakan perjalanan dinas dalam rangka ${data.maksudTugas} di ${data.lokasiTugas};`,
          `Yang bersangkutan melaksanakan perintah tugas selama ${formatHariDenganTerbilang(lamaHari)} hari pada tanggal ${rentangTanggal};`,
          `Selambat-lambatnya ${formatHariDenganTerbilang(data.pelaporanHari || 5)} hari setelah melaksanakan tugas, membuat laporan tertulis kepada Direktur PPS;`,
          `Biaya dibebankan kepada ${data.pembebananAnggaran.endsWith(".") ? data.pembebananAnggaran : data.pembebananAnggaran + "."}`,
        ];

        for (const b of butirUntuk) {
          const p = pTemplate.cloneNode(true) as Element;
          p.appendChild(createTextRun(doc, b));
          cellUntuk.appendChild(p);
        }
      }
    }
  }

  // 5. Tempat & Tanggal (P13 di body)
  const p13 = body.childNodes[13] as Element | undefined;
  if (p13) {
    const tempat = data.tempatNaskah || "Jakarta";
    const tanggalTeks =
      data.modeNomor === "manual" && data.tanggal
        ? tanggalIndonesia(data.tanggal)
        : "${tanggal_naskah}";
    setParagraphTextOnly(doc, p13, ` ${tempat}, ${tanggalTeks}`);
  }

  // 6. Jabatan Penandatangan (P14 di body)
  const p14 = body.childNodes[14] as Element | undefined;
  if (p14) {
    const jabatan = data.penandatanganJabatan || "Direktur,";
    setParagraphTextOnly(doc, p14, `        ${jabatan}`);
  }

  // 7. Nama Pejabat (P22 di body)
  const p22 = body.childNodes[22] as Element | undefined;
  if (p22) {
    setParagraphTextOnly(doc, p22, ` ${data.penandatanganNama}`);
  }

  // 8. NIP Pejabat (P23 di body)
  const p23 = body.childNodes[23] as Element | undefined;
  if (p23) {
    const nipTeks = data.penandatanganNip
      ? ` NIP. ${data.penandatanganNip}`
      : "";
    setParagraphTextOnly(doc, p23, nipTeks);
  }

  // 9. Tembusan
  // Cari node p "Tembusan:" (biasanya P25)
  let idxTembusan = -1;
  for (let i = 0; i < body.childNodes.length; i++) {
    const node = body.childNodes[i];
    if (node?.nodeName === "w:p" && node.textContent?.trim().startsWith("Tembusan:")) {
      idxTembusan = i;
      break;
    }
  }

  if (idxTembusan !== -1) {
    const pTembusanHeader = body.childNodes[idxTembusan] as Element;
    // Cari template paragraf item tembusan (node setelah P25)
    const pSampleTembusan = body.childNodes[idxTembusan + 1] as Element | undefined;
    const pTemplateTembusan = pSampleTembusan ? cloneParagraphStructure(pSampleTembusan) : null;

    // Hapus paragraf-paragraf tembusan lama sampai sebelum sectPr
    while (
      body.childNodes[idxTembusan + 1] &&
      body.childNodes[idxTembusan + 1]?.nodeName === "w:p"
    ) {
      body.removeChild(body.childNodes[idxTembusan + 1]!);
    }

    if (pTemplateTembusan) {
      let insertRef: Node | null = pTembusanHeader.nextSibling;
      for (const t of data.tembusan || []) {
        const p = pTemplateTembusan.cloneNode(true) as Element;
        p.appendChild(createTextRun(doc, t.endsWith(";") || t.endsWith(".") ? t : `${t};`));
        body.insertBefore(p, insertRef);
      }
    }
  }

  const newXml = new XMLSerializer().serializeToString(doc);
  zip.file("word/document.xml", newXml);

  const generatedBuffer = await zip.generateAsync({ type: "nodebuffer" });
  return generatedBuffer;
}
