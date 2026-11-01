alter table etape
  add column if not exists kabupaten text[] not null default '{}';
