alter table etape
  add column if not exists fullboard_dates text[] not null default '{}';
