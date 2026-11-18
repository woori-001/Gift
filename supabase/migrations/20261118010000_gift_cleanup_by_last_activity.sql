-- 자동 정리 기준을 '정산예정일 30일 경과' → '마지막 작업 후 30일 동안 손대지 않음' 으로 바꿈
-- (지난 회차를 새로 검수할 때 바로 닫혀버리던 문제)
create or replace function private.gift_cleanup() returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.gift_work set status = 'closed', closed_by = '자동 정리(30일 미사용)', closed_at = now()
   where status = 'open' and updated_at < now() - interval '30 days';
  update public.gift_work_files f set data = '[]'::jsonb, cols = '[]'::jsonb, removed_at = coalesce(f.removed_at, now())
   where (f.removed_at is not null or exists (select 1 from public.gift_work w where w.id = f.work_id and w.status = 'closed'))
     and (f.data <> '[]'::jsonb or f.cols <> '[]'::jsonb);
end $$;
revoke all on function private.gift_cleanup() from public, anon, authenticated;
