// 검수 엔진 단위 테스트 (가상 데이터만 사용). 실행: node --test test/
const test = require('node:test');
const assert = require('node:assert');
const Engine = require('../js/engine.js');

const DED = ['사은품', '물류', '쿠폰', '선납', '할인탭', '미비서류', '기타'];
function row(o) {
  const r = { No: '1', 정산종류: '일반', 고객명: '', 가입서비스: '', 상품명: '', 상품옵션: '', 협력점: '', 개통일: '2026-01-07',
    약정금액: 0, 번들수수료: 0, 동판수수료: 0, 수납: 0, 정산예정일: '2026-01-16', 사은품지급처: '사은품없음', 현금: 0 };
  DED.forEach(d => { r['차감내역_' + d] = 0; });
  Object.assign(r, o);
  r.정산금액 = r.약정금액 - DED.reduce((a, d) => a + r['차감내역_' + d], 0) + r.번들수수료 + r.동판수수료;
  return r;
}
const toRecords = arr => arr.map((r, i) => Engine.gridToRecords([Object.keys(r), Object.keys(r).map(k => r[k])].map((x, j) => j ? x.map((v, k) => k === 0 ? String(i + 1) : v) : x))[0]);

test('정산 후 웨이브넷 지급으로 바뀐 건은 미차감으로 잡는다', () => {
  const st = toRecords([row({ 고객명: '한가람', 가입서비스: 'z!1', 상품명: 'KT_인터넷', 상품옵션: '슬림', 협력점: '★가상○', 약정금액: 450000, 사은품지급처: '유치자지급' })]);
  const raw = toRecords([row({ 고객명: '한*람', 가입서비스: 'z!1', 상품명: 'KT_인터넷', 상품옵션: '슬림', 협력점: '★(휴)가상○', 약정금액: 450000,
    사은품지급처: '웨이브넷 지급', 현금: 400000, 차감내역_사은품: 400000 })]);
  const res = Engine.run(raw, st);
  assert.strictEqual(res.pairs.length, 1, '마스킹 이름·(휴) 협력점명이 달라도 매칭');
  assert.strictEqual(res.undeducted.length, 1);
  assert.strictEqual(res.undeducted[0].gap, 400000);
  assert.match(res.undeducted[0].reason, /지급처 변경/);
  assert.strictEqual(res.changed.length, 0, '사은품 차감만으로 생긴 정산금액 차이는 금액 변동에 넣지 않음');
});

test('정산서에 없는 건은 누락, 로우에 없는 건은 정산서에만', () => {
  const st = toRecords([row({ 고객명: '문나래', 가입서비스: 'z!9', 상품명: 'KT_TV', 협력점: '★가상○', 약정금액: 100000 })]);
  const raw = toRecords([row({ 고객명: '고*별', 가입서비스: 'z!8', 상품명: 'KT_인터넷', 협력점: '★가상○', 약정금액: 300000, 사은품지급처: '웨이브넷 지급', 현금: 200000, 차감내역_사은품: 200000 })]);
  const res = Engine.run(raw, st);
  assert.strictEqual(res.missing.length, 1);
  assert.strictEqual(res.missing[0].paid, 200000);
  assert.strictEqual(res.stmtOnly.length, 1);
});

test('같은 내용의 일반/추가/환수는 정산구분으로 구분해서 매칭', () => {
  const base = { 고객명: '서하늘', 가입서비스: '02-1', 상품명: 'SKT_인터넷', 상품옵션: '기가', 협력점: '★예시○', 약정금액: 100000 };
  const st = toRecords([row(base)]);
  const raw = toRecords([row({ ...base, 고객명: '서*늘' }), row({ ...base, 고객명: '서*늘', 정산종류: '추가', 약정금액: 50000 })]);
  const res = Engine.run(raw, st);
  assert.strictEqual(res.pairs.length, 1);
  assert.strictEqual(res.missing.length, 1);
  assert.strictEqual(res.missing[0].raw.정산종류, '추가');
});

test('정산서(HTML .xls) 헤더 2줄과 합계행을 처리', () => {
  const html = '<table><tr><th rowspan="2">No</th><th rowspan="2">정산종류</th><th rowspan="2">고객명</th><th rowspan="2">인수처</th><th colspan="2">차감내역</th><th rowspan="2">정산금액</th><th rowspan="2">금액</th></tr>' +
    '<tr><th>사은품</th><th>물류</th></tr>' +
    '<tr><td>1</td><td>일반 </td><td>홍길동</td><td>★가상○</td><td>400,000</td><td>0</td><td>150,000</td><td>400000</td></tr>' +
    '<tr><td>현재 화면 정산 합계</td><td></td><td></td><td></td><td>400,000</td><td>0</td><td>150,000</td><td></td></tr></table>';
  const recs = Engine.gridToRecords(Engine.htmlToGrid(html));
  assert.strictEqual(recs.length, 1);
  assert.strictEqual(recs[0].차감내역_사은품, 400000);
  assert.strictEqual(recs[0].협력점, '★가상○');
  assert.strictEqual(recs[0].현금, 400000);
  assert.strictEqual(recs[0]._partner, '가상');
});
