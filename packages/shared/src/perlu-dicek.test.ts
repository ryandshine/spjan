import { describe, expect, it } from "vitest";

import { HasilEkstraksiHotelSchema } from "./hotel-ekstraksi.js";
import { gabungPerluDicek, labelKolom, pesanPerluDicek } from "./perlu-dicek.js";

const hotel = {
  namaHotel: "Hotel A",
  nomorInvoice: null,
  tamu: null,
  checkIn: "2026-11-01",
  checkOut: "2026-11-03",
  jumlahMalam: 2,
  tarifPerMalam: null,
  totalBiaya: 900000,
};

describe("perluDicek", () => {
  it("opsional: hasil lama tanpa perluDicek tetap valid", () => {
    expect(HasilEkstraksiHotelSchema.parse(hotel).perluDicek).toBeUndefined();
  });

  it("isian valid dipertahankan", () => {
    const p = [{ kolom: "totalBiaya", alasan: "angka terpotong" }];
    expect(HasilEkstraksiHotelSchema.parse({ ...hotel, perluDicek: p }).perluDicek).toEqual(p);
  });

  it("isian rusak diabaikan tanpa menggagalkan hasil utama", () => {
    const r = HasilEkstraksiHotelSchema.parse({ ...hotel, perluDicek: ["totalBiaya"] });
    expect(r.perluDicek).toBeUndefined();
    expect(r.totalBiaya).toBe(900000);
  });

  it("digabung dari beberapa potongan tanpa duplikat", () => {
    const a = { kolom: "tarif", alasan: "buram" };
    const b = { kolom: "tanggal", alasan: "tidak tertera" };
    expect(gabungPerluDicek([{ perluDicek: [a] }, { perluDicek: [a, b] }, {}, null])).toEqual([a, b]);
    expect(gabungPerluDicek([{}, { perluDicek: "x" }])).toBeUndefined();
  });
});

describe("pesanPerluDicek", () => {
  it("memakai label Indonesia, termasuk kolom bertingkat; kolom tak dikenal apa adanya", () => {
    expect(labelKolom("totalBiaya")).toBe("Total biaya");
    expect(labelKolom("pelaksana[2].nip")).toBe("Pelaksana ke-3, NIP");
    expect(labelKolom("kolomAneh")).toBe("kolomAneh");
    expect(pesanPerluDicek([{ kolom: "checkIn", alasan: "tanggal buram" }])).toEqual(["Perlu dicek: Check-in (tanggal buram)."]);
    expect(pesanPerluDicek(undefined)).toEqual([]);
  });
});
