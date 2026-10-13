-- 브라우저 키(anon/authenticated)의 테이블 직접 접근 권한 회수. 접근은 gift_* RPC로만
revoke all on private.gift_accounts, private.gift_sessions, private.gift_login_attempts from anon, authenticated, public;
revoke all on public.gift_runs, public.gift_findings from anon, authenticated;
