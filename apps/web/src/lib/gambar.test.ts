import { describe, expect, it } from 'vitest'
import { hitungDimensiProporsional, standarkanNamaFoto } from './gambar.js'

describe('hitungDimensiProporsional', () => {
  it('tidak mengubah ukuran bila gambar di bawah batas maksimal', () => {
    const hasil = hitungDimensiProporsional(1200, 800, 2048)
    expect(hasil).toEqual({ lebar: 1200, tinggi: 800 })
  })

  it('mengecilkan gambar horizontal (lebar > tinggi) secara proporsional', () => {
    const hasil = hitungDimensiProporsional(4000, 3000, 2000)
    expect(hasil.lebar).toBe(2000)
    expect(hasil.tinggi).toBe(1500)
  })

  it('mengecilkan gambar vertikal (tinggi > lebar) secara proporsional', () => {
    const hasil = hitungDimensiProporsional(3000, 4500, 2000)
    expect(hasil.tinggi).toBe(2000)
    expect(hasil.lebar).toBe(1333)
  })

  it('menangani gambar persegi (lebar == tinggi)', () => {
    const hasil = hitungDimensiProporsional(3000, 3000, 1500)
    expect(hasil).toEqual({ lebar: 1500, tinggi: 1500 })
  })
})

describe('standarkanNamaFoto', () => {
  it('mengganti nama generik dengan prefix foto-YYYYMMDD-HHmmss.jpg', () => {
    const hasil = standarkanNamaFoto('image.jpg')
    expect(hasil).toMatch(/^foto-\d{8}-\d{6}\.jpg$/)

    const hasil2 = standarkanNamaFoto('IMG_20261005_120000.jpeg')
    expect(hasil2).toMatch(/^foto-\d{8}-\d{6}\.jpg$/)
  })

  it('mempertahankan nama deskriptif dan memastikan ekstensi .jpg', () => {
    const hasil = standarkanNamaFoto('kuitansi-hotel-alana.png')
    expect(hasil).toBe('kuitansi-hotel-alana.jpg')

    const hasil2 = standarkanNamaFoto('tiket-garuda-yia.jpeg')
    expect(hasil2).toBe('tiket-garuda-yia.jpg')
  })
})
