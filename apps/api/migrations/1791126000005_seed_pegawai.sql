-- Up Migration
insert into pegawai (nama, nip, jabatan, status_kode, aktif) values
  ('Dr. Marcus Octavianus Susatyo, S.Hut., M.P.', '196810191998031001', 'Direktur Pengendalian Perhutanan Sosial', 'ESELON_II', true),
  ('Dieta Arbaranny Koeswara, S.Hut., M.Si.', '198703052010122006', 'Kepala Subbag Tata Usaha', 'ESELON_IV_GOL_III_II_I', true),
  ('Aisyah, S.E.', '198411262009012001', 'Analis Pengelolaan Keuangan APBN Ahli Muda', 'ESELON_IV_GOL_III_II_I', true),
  ('Susanti, S.E.', '199209022024212061', 'Analis Sumber Daya Manusia Aparatur Ahli Pertama', 'ESELON_IV_GOL_III_II_I', true),
  ('Nurdesri Wahyu Ningtyas, S.E.', '199609212023212033', 'Pengelola Pengadaan Barang/Jasa Ahli Pertama', 'ESELON_IV_GOL_III_II_I', true),
  ('Suci Lestari, S.E.', '199410212023212031', 'Perencana Ahli Pertama', 'ESELON_IV_GOL_III_II_I', true),
  ('Aprilia Rahma Wijayani, S.E.', '199004082024212049', 'Arsiparis Ahli Pertama', 'ESELON_IV_GOL_III_II_I', true),
  ('Kurwin', '198604242025211093', 'Operator Layanan Operasional', 'ESELON_IV_GOL_III_II_I', true),
  ('Agus Rahman', '198108172025211086', 'Operator Layanan Operasional', 'ESELON_IV_GOL_III_II_I', true),
  ('Priyo Kusumedi, S.Hut.,M.P.', '197402182002121003', 'Kepala Sub Direktorat Pelembagaan Perhutanan Sosial', 'ESELON_III_GOL_IV', true),
  ('Ir. Christina Matakupan, M.Si.', '196910201993032003', 'Penyuluh Kehutanan Ahli Madya', 'ESELON_III_GOL_IV', true),
  ('Umirusyanawati, S.E.,MAP.', '196803271997032001', 'Analis Sumber Daya Manusia Aparatur Ahli Madya', 'ESELON_III_GOL_IV', true),
  ('Bona Sapril Sinaga, S.Hut.,M.Si.', '198004012008011001', 'Analis Pemberdayaan Masyarakat', 'ESELON_III_GOL_IV', true),
  ('Dwiki Faiz Sarvianto, S.KPm.', '199709102022031013', 'Analis Pemberdayaan Masyarakat', 'ESELON_IV_GOL_III_II_I', true),
  ('Kun Esti Maharani, S.Ant', '198505282015022001', 'Penyuluh Kehutanan Ahli Pertama', 'ESELON_IV_GOL_III_II_I', true),
  ('Veronica Irma Dwi Susanti, S.T.', '198401162023212022', 'Pranata Komputer Ahli Pertama', 'ESELON_IV_GOL_III_II_I', true),
  ('Annisa Kusumawardhani Yulinda, S.E.', '199207222023212049', 'Analis Kebijakan Ahli Pertama', 'ESELON_IV_GOL_III_II_I', true),
  ('Aulia Rahman, S.E.', '199708152024211009', 'Analis Kebijakan Ahli Pertama', 'ESELON_IV_GOL_III_II_I', true),
  ('Febby Octavia, SKM.', '199510272023212040', 'Arsiparis Ahli Pertama', 'ESELON_IV_GOL_III_II_I', true),
  ('Gunadi Firdaus, S.Hut., M.Si.', '197803101997031001', 'Kepala Sub Direktorat Pemantauan Perhutanan Sosial', 'ESELON_III_GOL_IV', true),
  ('Lusi Ardiputri, S.P., M.P.', '197003181994032003', 'Analis Kebijakan Ahli Madya', 'ESELON_III_GOL_IV', true),
  ('Irwan Hermawan, S.Hut., M.Si.', '197010251998031001', 'Pengendali Ekosistem Hutan Ahli Muda', 'ESELON_III_GOL_IV', true),
  ('Rossi Margareth Tampubolon, S.Si', '198209122010122003', 'Pengendali Ekosistem Hutan Ahli Muda', 'ESELON_IV_GOL_III_II_I', true),
  ('Riki Haryanto, S.E.', '199008122020121004', 'Pengelola Pengadaan Barang/Jasa Ahli Pertama', 'ESELON_IV_GOL_III_II_I', true),
  ('Reni Dyah Anom Mulati, S.Hut.', '199301282018012001', 'Pengendali Ekosistem Hutan Ahli Pertama', 'ESELON_IV_GOL_III_II_I', true),
  ('Redho Darma Satria Fz, S.Hut.', '199403052022031007', 'Analis Persiapan Lahan', 'ESELON_IV_GOL_III_II_I', true),
  ('Muhammad Febriansyah', '199902122022031006', 'Pengendali Ekosistem Hutan Pemula', 'ESELON_IV_GOL_III_II_I', true),
  ('Regita Mulyawati, S.H.', '199711132024212035', 'Analis Kebijakan Ahli Pertama', 'ESELON_IV_GOL_III_II_I', true),
  ('Riandi Eko Priantoro, SKom', '198404212023211020', 'Pranata Komputer Ahli Pertama', 'ESELON_IV_GOL_III_II_I', true),
  ('R. Resa Adam Gunawan, S.T', '199508222023211008', 'Surveyor Pemetaan Ahli Pertama', 'ESELON_IV_GOL_III_II_I', true)
on conflict (nip) do update set
  nama = excluded.nama,
  jabatan = excluded.jabatan,
  status_kode = excluded.status_kode,
  aktif = true,
  updated_at = now();

-- Down Migration
-- intentionally keep pegawai data on rollback or delete where nip in (...)
