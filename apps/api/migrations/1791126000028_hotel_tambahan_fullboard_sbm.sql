alter table etape
  add column if not exists hotel_tambahan jsonb not null default '[]'::jsonb;

-- Tarif uang harian fullboard pindah ke data SBM (PMK 32/2025 Lampiran 31.2); versi lama yang tersimpan ikut dilengkapi.
update sbm_versi
   set data = jsonb_set(data, '{uangHarianFullboard}', '130000'::jsonb)
 where not (data ? 'uangHarianFullboard');
