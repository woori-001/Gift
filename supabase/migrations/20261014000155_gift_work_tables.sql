-- 작업 중인 회차(이어하기) : 올린 파일을 회차별로 서버에 보관
create table if not exists public.gift_work (
  id           uuid primary key default gen_random_uuid(),
  settle_date  date not null,
  status       text not null default 'open' check (status in ('open','closed')),
  memo         text not null default '',
  created_by   text not null,
  created_at   timestamptz not null default now(),
  updated_by   text not null,
  updated_at   timestamptz not null default now(),
  closed_by    text,
  closed_at    timestamptz
);
create unique index if not exists gift_work_open_uq on public.gift_work(settle_date) where status = 'open';

create table if not exists public.gift_work_files (
  id           bigint generated always as identity primary key,
  work_id      uuid not null references public.gift_work(id) on delete cascade,
  kind         text not null check (kind in ('raw','stmt')),
  file_name    text not null,
  partner      text not null default '',
  settle_date  date,
  row_count    int not null default 0,
  cols         jsonb not null default '[]'::jsonb,
  data         jsonb not null default '[]'::jsonb,
  uploaded_by  text not null,
  uploaded_at  timestamptz not null default now(),
  removed_at   timestamptz,
  unique (work_id, kind, file_name)
);
create index if not exists gift_work_files_work_idx on public.gift_work_files(work_id) where removed_at is null;

alter table public.gift_work       enable row level security;
alter table public.gift_work_files enable row level security;
revoke all on public.gift_work, public.gift_work_files from anon, authenticated;
