-- Up Migration
-- Pangkat/golongan teks bebas (mis. "Penata Muda - III/a", "Ahli Pertama - IX"), tampil pada butir 3a SPD.
alter table pegawai add column pangkat_golongan text not null default '';
alter table pelaksana add column pangkat_golongan text not null default '';

-- Isi awal dari daftar pegawai Direktorat (berdasarkan NIP); pegawai tanpa pangkat/golongan dibiarkan kosong.
update pegawai p set pangkat_golongan = d.pg
from (values
  ('196810191998031001', 'Pembina Utama Muda - IV/c'),
  ('198703052010122006', 'Penata Tingkat I - III/d'),
  ('198411262009012001', 'Penata - III/c'),
  ('197402182002121003', 'Pembina Tingkat I - IV/b'),
  ('196910201993032003', 'Pembina - IV/a'),
  ('196803271997032001', 'Pembina Tingkat I - IV/b'),
  ('198004012008011001', 'Pembina - IV/a'),
  ('199709102022031013', 'Penata Muda - III/a'),
  ('198505282015022001', 'Penata Muda Tingkat I - III/b'),
  ('197803101997031001', 'Pembina - IV/a'),
  ('197003181994032003', 'Pembina Tingkat I - IV/b'),
  ('197010251998031001', 'Pembina - IV/a'),
  ('198209122010122003', 'Penata Muda Tingkat I - III/b'),
  ('199008122020121004', 'Penata Muda - III/a'),
  ('199301282018012001', 'Penata Muda Tingkat I - III/b'),
  ('199403052022031007', 'Penata Muda - III/a'),
  ('199209022024212061', 'Ahli Pertama - IX'),
  ('199609212023212033', 'Ahli Pertama - IX'),
  ('199410212023212031', 'Ahli Pertama - IX'),
  ('199004082024212049', 'Ahli Pertama - IX'),
  ('198401162023212022', 'Ahli Pertama - IX'),
  ('199207222023212049', 'Ahli Pertama - IX'),
  ('199708152024211009', 'Ahli Pertama - IX'),
  ('199510272023212040', 'Ahli Pertama - IX'),
  ('199711132024212035', 'Ahli Pertama - IX'),
  ('198404212023211020', 'Ahli Pertama - IX'),
  ('199508222023211008', 'Ahli Pertama - IX')
) as d (nip, pg)
where p.nip = d.nip;

-- Down Migration
alter table pelaksana drop column if exists pangkat_golongan;
alter table pegawai drop column if exists pangkat_golongan;
