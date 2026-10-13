/* Supabase 연결 정보
 * 둘 다 브라우저에 공개되는 값이라 GitHub에 올려도 괜찮아요.
 * (publishable 키는 테이블에 직접 접근할 수 없고, 로그인 토큰을 확인하는 gift_* 함수만 부를 수 있어요.)
 * 절대 service_role / secret 키를 여기에 넣지 마세요.
 */
window.GIFT_CONFIG = {
  SUPABASE_URL: 'https://omdyyvqkxxigilxjysbz.supabase.co',
  SUPABASE_KEY: 'sb_publishable_g41wwhIMN19UchPheU9Vvg_lAHjnZNf'
};
