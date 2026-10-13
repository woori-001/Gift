-- 사은품 차감 검수(gift_*) 테이블
-- 계정·세션은 private 스키마, 검수 결과는 public 스키마. 모든 테이블 RLS 켬(정책 없음 = 직접 접근 전부 거부)
create schema if not exists private;

create table if not exists private.gift_accounts (
  id            text primary key,
  name          text not null default '',
  pw_hash       text not null,
  role          text not null default 'user' check (role in ('admin','user')),
  enabled       boolean not null default true,
  must_change   boolean not null default false,
  created_at    timestamptz not null default now(),
  last_login_at timestamptz
);

create table if not exists private.gift_sessions (
  token_hash  text primary key,
  account_id  text not null references private.gift_accounts(id) on delete cascade,
  expires_at  timestamptz not null
);
create index if not exists gift_sessions_account_idx on private.gift_sessions(account_id);

create table if not exists private.gift_login_attempts (
  id          bigint generated always as identity primary key,
  ip          text,
  account_id  text,
  ok          boolean not null,
  at          timestamptz not null default now()
);
create index if not exists gift_login_attempts_ip_at_idx on private.gift_login_attempts(ip, at);

create table if not exists public.gift_runs (
  id            uuid primary key default gen_random_uuid(),
  settle_date   date,
  raw_file      text not null default '',
  stmt_files    int  not null default 0,
  raw_rows      int  not null default 0,
  stmt_rows     int  not null default 0,
  matched       int  not null default 0,
  und_count     int  not null default 0,
  und_amount    bigint not null default 0,
  miss_count    int  not null default 0,
  miss_paid     int  not null default 0,
  only_count    int  not null default 0,
  chg_count     int  not null default 0,
  chk_count     int  not null default 0,
  partners      jsonb not null default '[]'::jsonb,
  memo          text not null default '',
  created_by    text not null,
  created_at    timestamptz not null default now()
);
create index if not exists gift_runs_settle_date_idx on public.gift_runs(settle_date desc, created_at desc);

create table if not exists public.gift_findings (
  id          bigint generated always as identity primary key,
  run_id      uuid not null references public.gift_runs(id) on delete cascade,
  kind        text not null check (kind in ('und','miss','only','chg','chk')),
  partner     text not null default '',
  settle_type text not null default '',
  cust_name   text not null default '',
  svc         text not null default '',
  product     text not null default '',
  open_date   text not null default '',
  amount      bigint not null default 0,
  detail      jsonb not null default '{}'::jsonb
);
create index if not exists gift_findings_run_kind_idx on public.gift_findings(run_id, kind);
create index if not exists gift_findings_partner_idx on public.gift_findings(partner);

alter table private.gift_accounts       enable row level security;
alter table private.gift_sessions       enable row level security;
alter table private.gift_login_attempts enable row level security;
alter table public.gift_runs            enable row level security;
alter table public.gift_findings        enable row level security;
