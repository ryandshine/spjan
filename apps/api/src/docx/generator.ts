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

function clearChildren(node: Element): void {
  while (node.firstChild) {
    node.removeChild(node.firstChild);
  }
}

/**
 * Membuat paragraf baru dengan mengkloning template paragraf asli
 * beserta seluruh w:pPr dan w:rPr dari run acuan agar font Bookman Old Style 11pt,
 * indentasi, spasi, dan tab stop tetap 100% identik dengan CONTOH SPT.docx.
 */
function createParagraphFromSample(doc: Document, pTemplate: Element, text: string): Element {
  const pNew = pTemplate.cloneNode(true) as Element;
  const pPr = pNew.getElementsByTagName("w:pPr")[0];

  const sampleR = pTemplate.getElementsByTagName("w:r")[0];
  const sampleRPr = sampleR?.getElementsByTagName("w:rPr")[0];

  clearChildren(pNew);
  if (pPr) {
    pNew.appendChild(pPr);
  }

  const rNew = doc.createElement("w:r");
  if (sampleRPr) {
    rNew.appendChild(sampleRPr.cloneNode(true));
  }
  const tNew = doc.createElement("w:t");
  tNew.setAttribute("xml:space", "preserve");
  tNew.textContent = text;
  rNew.appendChild(tNew);
  pNew.appendChild(rNew);

  return pNew;
}

/**
 * Memperbarui teks dalam paragraf yang ada dengan menjaga w:pPr dan w:rPr pertama,
 * serta membuang run ekstra hasil pemecahan pengetikan lama.
 */
function updateParagraphSingleRun(doc: Document, pNode: Element, newText: string): void {
  const runs = pNode.getElementsByTagName("w:r");
  if (runs.length === 0) {
    const r = doc.createElement("w:r");
    const t = doc.createElement("w:t");
    t.setAttribute("xml:space", "preserve");
    t.textContent = newText;
    r.appendChild(t);
    pNode.appendChild(r);
    return;
  }

  const firstRun = runs[0];
  if (!firstRun) return;

  let t = firstRun.getElementsByTagName("w:t")[0];
  if (!t) {
    t = doc.createElement("w:t");
    t.setAttribute("xml:space", "preserve");
    firstRun.appendChild(t);
  }
  t.textContent = newText;

  for (let i = runs.length - 1; i >= 1; i--) {
    const r = runs[i];
    if (r && r.parentNode === pNode) {
      pNode.removeChild(r);
    }
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
        ? data.nomor
        : "${nomor_naskah}";
    const runs7 = p7.getElementsByTagName("w:r");
    if (runs7.length >= 5 && runs7[0] && runs7[2]) {
      const t0 = runs7[0].getElementsByTagName("w:t")[0];
      if (t0) t0.textContent = "  Nomor: ";
      const t2 = runs7[2].getElementsByTagName("w:t")[0];
      if (t2) t2.textContent = nomorTeks;
      if (runs7[4]?.parentNode === p7) p7.removeChild(runs7[4]);
      if (runs7[3]?.parentNode === p7) p7.removeChild(runs7[3]);
      if (runs7[1]?.parentNode === p7) p7.removeChild(runs7[1]);
    } else {
      updateParagraphSingleRun(doc, p7, `  Nomor: ${nomorTeks}`);
    }
  }
  // Catatan: jika modeNomor === "srikandi", P7 dibiarkan 100% utuh dengan '${nomor_naskah}'

  // 2. Pemberi Tugas (P9 di body)
  // Sesuai CONTOH SPT.docx, P9 adalah "                       DIREKTUR PENGENDALIAN PERHUTANAN SOSIAL,"
  // dengan gaya Heading3, spasi karakter w:val="110", dan ind right="188". Dibiarkan utuh 100%.

  const tables = doc.getElementsByTagName("w:tbl");
  const tblMenimbang = tables[0];
  const tblIsi = tables[1];

  // 3. Menimbang (Tbl 0, Row 0, Cell 1)
  if (tblMenimbang) {
    const tr0 = tblMenimbang.getElementsByTagName("w:tr")[0];
    const tc1 = tr0?.getElementsByTagName("w:tc")[1];
    if (tc1) {
      const pList = tc1.getElementsByTagName("w:p");
      const p0 = pList[0];
      if (p0 && data.maksudTugas) {
        updateParagraphSingleRun(
          doc,
          p0,
          `bahwa dalam rangka ${data.maksudTugas}, diperlukan untuk menugaskan  personil;`,
        );
      }
      // pList[1] adalah poin b: "bahwa sehubungan dengan poin a perlu diterbitkan Surat Tugas." -> dibiarkan utuh
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
        const daftarDasar = [
          ...(data.dasarHukum || []),
          ...(data.dasarSpesifik ? [data.dasarSpesifik] : []),
        ].filter(Boolean);

        const tcPr = cellDasar.getElementsByTagName("w:tcPr")[0];
        clearChildren(cellDasar);
        if (tcPr) cellDasar.appendChild(tcPr);

        for (const item of daftarDasar) {
          const p = createParagraphFromSample(doc, pSample, item);
          cellDasar.appendChild(p);
        }
      }
    }

    // Row 1: "MEMBERI TUGAS," -> 100% dibiarkan utuh

    // Row 2: Kepada
    const rowKepada = rows[2];
    const cellKepada = rowKepada?.getElementsByTagName("w:tc")[1];
    if (cellKepada) {
      const existingPs = cellKepada.getElementsByTagName("w:p");
      const pSample0 = existingPs[0];
      const pSample1 = existingPs[1] || pSample0;

      if (pSample0) {
        const tcPr = cellKepada.getElementsByTagName("w:tcPr")[0];
        clearChildren(cellKepada);
        if (tcPr) cellKepada.appendChild(tcPr);

        const pelaksanaList = data.pelaksana || [];
        pelaksanaList.forEach((pel, idx) => {
          const pSample = idx === 0 ? pSample0 : (pSample1 || pSample0);
          const rawJabatan = (pel.jabatan || "").trim();
          const jabatanStr = rawJabatan
            ? rawJabatan.startsWith("/")
              ? ` ${rawJabatan}`
              : `/ ${rawJabatan}`
            : "";
          const teks = `${idx + 1}. ${pel.nama}${jabatanStr}`;
          const p = createParagraphFromSample(doc, pSample, teks);
          cellKepada.appendChild(p);
        });
      }
    }

    // Row 3: Untuk
    const rowUntuk = rows[3];
    const cellUntuk = rowUntuk?.getElementsByTagName("w:tc")[1];
    if (cellUntuk) {
      const existingPs = cellUntuk.getElementsByTagName("w:p");
      const pembebanan = data.pembebananAnggaran.endsWith(".")
        ? data.pembebananAnggaran
        : `${data.pembebananAnggaran}.`;

      const butirUntuk = [
        `Melaksanakan perjalanan dinas dalam rangka ${data.maksudTugas} di ${data.lokasiTugas};`,
        `Yang bersangkutan melaksanakan perintah tugas selama ${formatHariDenganTerbilang(lamaHari)} hari pada tanggal ${rentangTanggal};`,
        `Selambat-lambatnya ${formatHariDenganTerbilang(data.pelaporanHari || 5)} hari setelah melaksanakan tugas, membuat laporan tertulis kepada Direktur PPS;`,
        `Biaya dibebankan kepada ${pembebanan}`,
      ];

      if (existingPs.length >= 4) {
        for (let i = 0; i < 4; i++) {
          const pTarget = existingPs[i];
          const bText = butirUntuk[i];
          if (pTarget && bText) {
            updateParagraphSingleRun(doc, pTarget, bText);
          }
        }
      } else if (existingPs.length > 0 && existingPs[0]) {
        const pSample = existingPs[0];
        const tcPr = cellUntuk.getElementsByTagName("w:tcPr")[0];
        clearChildren(cellUntuk);
        if (tcPr) cellUntuk.appendChild(tcPr);

        for (const b of butirUntuk) {
          const p = createParagraphFromSample(doc, pSample, b);
          cellUntuk.appendChild(p);
        }
      }
    }
  }

  // 5. Tempat & Tanggal Naskah (P13 di body)
  const p13 = body.childNodes[13] as Element | undefined;
  if (p13 && data.modeNomor === "manual" && data.tanggal) {
    const runs13 = p13.getElementsByTagName("w:r");
    if (runs13.length >= 2 && runs13[0] && runs13[1]) {
      const tempat = data.tempatNaskah || "Jakarta";
      const t0 = runs13[0].getElementsByTagName("w:t")[0];
      const t1 = runs13[1].getElementsByTagName("w:t")[0];
      if (t0) t0.textContent = ` ${tempat}, `;
      if (t1) t1.textContent = tanggalIndonesia(data.tanggal);
    } else {
      updateParagraphSingleRun(
        doc,
        p13,
        ` ${data.tempatNaskah || "Jakarta"}, ${tanggalIndonesia(data.tanggal)}`,
      );
    }
  }
  // Catatan: jika mode SRIKANDI, P13 dibiarkan utuh dengan ' Jakarta, ${tanggal_naskah}'

  // 6. Jabatan Penandatangan (P14 di body)
  // Menjaga ke-5 tab stops / tab runs asli agar perataan tanda tangan tidak bergeser
  const p14 = body.childNodes[14] as Element | undefined;
  if (p14) {
    const runs14 = p14.getElementsByTagName("w:r");
    const lastRun14 = runs14[runs14.length - 1];
    if (lastRun14) {
      let t = lastRun14.getElementsByTagName("w:t")[0];
      if (!t) {
        t = doc.createElement("w:t");
        t.setAttribute("xml:space", "preserve");
        lastRun14.appendChild(t);
      }
      const rawJab = (data.penandatanganJabatan || "Direktur,").trim();
      const formattedJab = rawJab.endsWith(",") ? rawJab : `${rawJab},`;
      t.textContent = `        ${formattedJab}`;
    }
  }

  // P15, P16, P17: Baris kosong dengan tab stops -> 100% dibiarkan utuh
  // P18: SRIKANDI placeholder '${ttd_pengirim}' beserta 5 tabs -> 100% dibiarkan utuh
  // P19, P20, P21: Baris kosong dengan tab stops -> 100% dibiarkan utuh

  // 7. Nama Pejabat Penandatangan (P22 di body)
  const p22 = body.childNodes[22] as Element | undefined;
  if (p22) {
    const runs22 = p22.getElementsByTagName("w:r");
    if (runs22.length >= 2 && runs22[1]) {
      const t1 = runs22[1].getElementsByTagName("w:t")[0];
      if (t1 && data.penandatanganNama) {
        t1.textContent = data.penandatanganNama;
      }
    } else if (data.penandatanganNama) {
      updateParagraphSingleRun(doc, p22, ` ${data.penandatanganNama}`);
    }
  }

  // 8. NIP Pejabat Penandatangan (P23 di body)
  const p23 = body.childNodes[23] as Element | undefined;
  if (p23) {
    const runs23 = p23.getElementsByTagName("w:r");
    if (runs23.length >= 3 && runs23[2]) {
      const t2 = runs23[2].getElementsByTagName("w:t")[0];
      if (t2) {
        t2.textContent = data.penandatanganNip
          ? ` NIP. ${data.penandatanganNip}`
          : "";
      }
    } else if (data.penandatanganNip) {
      updateParagraphSingleRun(doc, p23, `   NIP. ${data.penandatanganNip}`);
    }
  }

  // 9. Tembusan (P25, P26, P27...)
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
    const pSampleTembusan = body.childNodes[idxTembusan + 1] as Element | undefined;

    if (pSampleTembusan) {
      const sampleClone = pSampleTembusan.cloneNode(true) as Element;

      // Hapus butir tembusan lama
      while (
        body.childNodes[idxTembusan + 1] &&
        body.childNodes[idxTembusan + 1]?.nodeName === "w:p"
      ) {
        body.removeChild(body.childNodes[idxTembusan + 1]!);
      }

      const tembusanList = (data.tembusan || []).filter(Boolean);
      const insertRef: Node | null = pTembusanHeader.nextSibling;
      for (let i = 0; i < tembusanList.length; i++) {
        const item = tembusanList[i];
        if (!item) continue;
        let t = item.trim();
        const isLast = i === tembusanList.length - 1;
        t = t.replace(/[;.]+$/, "");
        t = isLast ? `${t}.` : `${t};`;

        const p = createParagraphFromSample(doc, sampleClone, t);
        body.insertBefore(p, insertRef);
      }
    }
  }

  const newXml = new XMLSerializer().serializeToString(doc);
  zip.file("word/document.xml", newXml);

  const generatedBuffer = await zip.generateAsync({ type: "nodebuffer" });
  return generatedBuffer;
}
