/* ===== 정산 검수 엔진 (브라우저/노드 공용) ===== */
var Engine = (function () {
  var DED = ['사은품', '물류', '쿠폰', '선납', '할인탭', '미비서류', '기타'];
  var ALIAS = { '인수처': '협력점', '사은품 지급처': '사은품지급처', '금액': '현금', '상태': '개통상태' };
  var NUM_FIELDS = ['약정금액'].concat(DED.map(function (d) { return '차감내역_' + d; }), ['수납', '번들수수료', '동판수수료', '정산금액', '현금']);

  function s(v) { return v == null ? '' : String(v).replace(/ /g, ' ').trim(); }
  function num(v) {
    if (typeof v === 'number') return v;
    var t = s(v).replace(/[,\s원]/g, '');
    if (t === '' || t === '-') return 0;
    var n = Number(t); return isNaN(n) ? 0 : n;
  }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function date(v) {
    if (v == null || v === '') return '';
    if (v instanceof Date) return v.getFullYear() + '-' + pad(v.getMonth() + 1) + '-' + pad(v.getDate());
    if (typeof v === 'number' && v > 20000 && v < 80000) {
      var d = new Date(Math.round((v - 25569) * 86400000));
      return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate());
    }
    var t = s(v), m = t.match(/(\d{4})[-.\/](\d{1,2})[-.\/](\d{1,2})/);
    if (m) return m[1] + '-' + pad(+m[2]) + '-' + pad(+m[3]);
    m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})/);
    if (m) return '20' + m[3] + '-' + pad(+m[1]) + '-' + pad(+m[2]);
    return t;
  }
  function normPartner(p) {
    return s(p).replace(/\(휴\)/g, '').replace(/[★☆■□◆◇●○◎▲△▼▽◀▶♠♣♥♡\s]/g, '');
  }
  // 가입서비스: '(★상품권,문자)z!652.../02-...' 처럼 앞뒤에 붙는 괄호 메모·기호·공백은 떼고 비교
  function normSvc(v) {
    // 괄호 메모, 한글 메모(후첨부·선약·합 등), 기호·공백·하이픈을 떼고 번호만 남김
    return s(v).replace(/[\(\[\{【<][^\)\]\}】>]*[\)\]\}】>]/g, '').replace(/[가-힣ㄱ-ㅎㅏ-ㅣ]/g, '').replace(/[★☆\s\-]/g, '').toUpperCase();
  }
  // '/'·','로 나뉜 번호 조각 (z!65252735872 / 02-040-2907)
  function svcTokens(v) { return normSvc(v).split(/[\/,|]/).filter(function (x) { return x.length >= 6; }); }
  function nameMatch(a, b) {
    a = s(a).replace(/\s+/g, ''); b = s(b).replace(/\s+/g, '');
    if (a === b) return true;
    if (a.length !== b.length) return false;
    for (var i = 0; i < a.length; i++) {
      if (a[i] !== b[i] && a[i] !== '*' && b[i] !== '*') return false;
    }
    return true;
  }

  // 느슨한 이름 비교: 괄호·'/메모'를 떼고, '*' 하나가 여러 글자를 대신해도 같은 사람으로 봄
  function cleanName(n) { return s(n).replace(/\([^)]*\)/g, '').replace(/\/.*$/, '').replace(/[\s.]/g, ''); }
  function nameLoose(a, b) {
    a = cleanName(a); b = cleanName(b);
    if (!a || !b) return false;
    if (nameMatch(a, b)) return true;
    var am = a.indexOf('*') >= 0, bm = b.indexOf('*') >= 0;
    if (am && bm) return a[0] === b[0] && a[a.length - 1] === b[b.length - 1];
    if (!am && !bm) return false;
    var pat = am ? a : b, plain = am ? b : a;
    var re = new RegExp('^' + pat.split(/\*+/).map(function (x) { return x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }).join('.+') + '$');
    return re.test(plain);
  }

  /* ---- HTML 표(.xls로 저장된 어드민 엑셀) → 2차원 배열 (rowspan/colspan 반영) ---- */
  function decodeEntities(t) {
    return t.replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>')
      .replace(/&quot;/gi, '"').replace(/&#39;/gi, "'").replace(/&#(\d+);/g, function (_, n) { return String.fromCharCode(+n); });
  }
  function htmlToGrid(html) {
    var grid = [], rows = html.split(/<tr[\s>]/i).slice(1);
    rows.forEach(function (rowHtml, r) {
      rowHtml = rowHtml.split(/<\/tr>/i)[0];
      grid[r] = grid[r] || [];
      var re = /<(td|th)([^>]*)>([\s\S]*?)<\/\1>/gi, m, c = 0;
      while ((m = re.exec(rowHtml))) {
        while (grid[r][c] !== undefined) c++;
        var attrs = m[2], rs = +(attrs.match(/rowspan\s*=\s*['"]?(\d+)/i) || [0, 1])[1],
          cs = +(attrs.match(/colspan\s*=\s*['"]?(\d+)/i) || [0, 1])[1];
        var val = decodeEntities(m[3].replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, '')).trim();
        for (var i = 0; i < rs; i++) for (var j = 0; j < cs; j++) {
          grid[r + i] = grid[r + i] || [];
          grid[r + i][c + j] = (i === 0 && j === 0) ? val : { span: val, fromRow: i > 0 };
        }
        c += cs;
      }
    });
    return grid.map(function (row) { var o = []; for (var i = 0; i < row.length; i++) o[i] = row[i] === undefined ? '' : row[i]; return o; });
  }

  /* ---- 2차원 배열 → 레코드 (헤더 2줄 처리) ---- */
  function gridToRecords(grid) {
    var cell = function (v) { return v && typeof v === 'object' ? v : { val: s(v) }; };
    var h0 = -1;
    for (var r = 0; r < Math.min(grid.length, 10); r++) {
      var vals = grid[r].map(function (v) { return typeof v === 'object' && v ? v.span : s(v); });
      if (vals.indexOf('고객명') >= 0 && (vals.indexOf('정산종류') >= 0 || vals.indexOf('정산금액') >= 0)) { h0 = r; break; }
    }
    if (h0 < 0) throw new Error('헤더(고객명·정산종류)를 찾지 못했어요');
    var top = grid[h0], sub = grid[h0 + 1] || [];
    var subVals = sub.map(function (v) { return typeof v === 'object' && v ? '' : s(v); });
    var hasSub = subVals.indexOf('물류') >= 0 || subVals.indexOf('쿠폰') >= 0;
    var width = Math.max(top.length, sub.length), names = [], last = '';
    for (var i = 0; i < width; i++) {
      var t = top[i]; t = typeof t === 'object' && t ? t.span : s(t);
      if (t) last = t; else t = last;
      var u = hasSub ? subVals[i] : '';
      var name = (u && u !== t) ? t + '_' + u : t;
      name = ALIAS[name] || name;
      names.push(name);
    }
    var out = [];
    for (var r2 = h0 + (hasSub ? 2 : 1); r2 < grid.length; r2++) {
      var row = grid[r2], rec = {};
      for (var k = 0; k < names.length; k++) {
        var v = row[k]; if (v && typeof v === 'object') v = v.span;
        if (names[k] && !(names[k] in rec)) rec[names[k]] = v == null ? '' : v;
      }
      if (!/^\d+$/.test(s(rec['No']))) continue; // 합계행 등 제외
      out.push(normalize(rec));
    }
    return out;
  }

  function normalize(rec) {
    var o = {};
    for (var k in rec) o[k] = rec[k];
    o.정산종류 = s(rec.정산종류) || '일반';
    o.고객명 = s(rec.고객명);
    o.가입서비스 = s(rec.가입서비스);
    o.상품명 = s(rec.상품명); o.상품옵션 = s(rec.상품옵션);
    o.협력점 = s(rec.협력점); o.유치자 = s(rec.유치자);
    o.개통일 = date(rec.개통일); o.접수일 = date(rec.접수일);
    o.정산예정일 = date(rec.정산예정일); o.정산완료일 = date(rec.정산완료일);
    o.지급완료 = date(rec.지급완료); o.지급예정 = date(rec.지급예정);
    o.사은품지급처 = s(rec.사은품지급처); o.사은품 = s(rec.사은품); o.개통상태 = s(rec.개통상태);
    NUM_FIELDS.forEach(function (f) { o[f] = num(rec[f]); });
    o._partner = normPartner(o.협력점);
    return o;
  }

  function paidByUs(r) { return /웨이브넷/.test(r.사은품지급처) ? r.현금 : 0; }
  function keyOf(r) { return [r.정산종류, normSvc(r.가입서비스), r.상품명, r.상품옵션, r.개통일].join('|'); }
  function key2Of(r) { return [r.정산종류, normSvc(r.가입서비스), r.상품명].join('|'); }
  function diffScore(a, b) {
    var n = 0; NUM_FIELDS.forEach(function (f) { if (a[f] !== b[f]) n++; });
    return n * 1e12 + Math.abs(a.정산금액 - b.정산금액);
  }

  function matchPass(stmtRows, rawRows, keyFn, allowPartnerFallback, tag, nameFn) {
    nameFn = nameFn || nameMatch;
    var idx = {};
    rawRows.forEach(function (r) { if (r._used) return; var k = keyFn(r); (idx[k] = idx[k] || []).push(r); });
    var pairs = [];
    stmtRows.forEach(function (st) {
      if (st._used) return;
      var cands = (idx[keyFn(st)] || []).filter(function (r) { return !r._used; });
      var byName = cands.filter(function (r) { return nameFn(r.고객명, st.고객명); });
      var note = tag;
      // 이름이 안 맞을 때 협력점만으로 잇는 건, 가입서비스 번호가 제대로 있을 때만 (번호가 비면 다른 고객끼리 엮일 수 있음)
      if (!byName.length && allowPartnerFallback && normSvc(st.가입서비스).length >= 6) {
        byName = cands.filter(function (r) { return r._partner === st._partner; });
        if (byName.length) note = (note ? note + ', ' : '') + '고객명 다름';
      }
      if (!byName.length) return;
      byName.sort(function (a, b) { return diffScore(a, st) - diffScore(b, st); });
      var r = byName[0]; r._used = st._used = true;
      pairs.push({ raw: r, st: st, note: note || '' });
    });
    return pairs;
  }

  // 마지막 단계: 가입서비스만 다르고 협력점·정산구분·상품·옵션·개통일이 같으며 이름도 같은 건 (SKB 번호 끝자리 변경 등)
  function sameItemKey(r) { return [r._partner, r.정산종류, r.상품명, r.상품옵션, r.개통일].join('|'); }

  // 가입서비스 번호 조각이 하나라도 같고, 정산구분·상품명이 같으며, 이름(느슨하게)이나 협력점이 같으면 같은 건
  function tokenPass(stmtRows, rawRows) {
    var idx = {};
    rawRows.forEach(function (r) {
      if (r._used) return;
      svcTokens(r.가입서비스).forEach(function (tk) { var k = r.정산종류 + '|' + r.상품명 + '|' + tk; (idx[k] = idx[k] || []).push(r); });
    });
    var pairs = [];
    stmtRows.forEach(function (st) {
      if (st._used) return;
      var seen = [], cands = [];
      svcTokens(st.가입서비스).forEach(function (tk) {
        (idx[st.정산종류 + '|' + st.상품명 + '|' + tk] || []).forEach(function (r) { if (!r._used && seen.indexOf(r) < 0) { seen.push(r); cands.push(r); } });
      });
      cands = cands.filter(function (r) { return nameLoose(r.고객명, st.고객명) || r._partner === st._partner; });
      if (!cands.length) return;
      cands.sort(function (a, b) {
        var sa = (a.상품옵션 === st.상품옵션 ? 0 : 1) + (a.개통일 === st.개통일 ? 0 : 1), sb = (b.상품옵션 === st.상품옵션 ? 0 : 1) + (b.개통일 === st.개통일 ? 0 : 1);
        return sa - sb || diffScore(a, st) - diffScore(b, st);
      });
      var r = cands[0]; r._used = st._used = true;
      pairs.push({ raw: r, st: st, note: '가입서비스 표기 다름' });
    });
    return pairs;
  }

  // 자점(직영): 협력점명이 '1.시흥영업팀'처럼 번호+점으로 시작하면 검수 대상에서 뺌
  function isOwnBranch(p) { return /^\d+\s*\./.test(normPartner(p)); }

  function run(rawRowsAll, stmtRowsAll) {
    var own = {}, ownRaw = 0, ownSt = 0;
    var rawRows = rawRowsAll.filter(function (r) { if (isOwnBranch(r.협력점)) { own[r._partner] = (own[r._partner] || 0) + 1; ownRaw++; return false; } return true; });
    var stmtRows = stmtRowsAll.filter(function (r) { if (isOwnBranch(r.협력점)) { own[r._partner] = own[r._partner] || 0; ownSt++; return false; } return true; });
    var excluded = { partners: Object.keys(own).sort(), raw: ownRaw, stmt: ownSt };
    rawRows.forEach(function (r) { r._used = false; });
    stmtRows.forEach(function (r) { r._used = false; });
    var pairs = matchPass(stmtRows, rawRows, keyOf, true, '')
      .concat(matchPass(stmtRows, rawRows, key2Of, false, '개통일·상품옵션 변경', nameLoose))
      .concat(tokenPass(stmtRows, rawRows))
      .concat(matchPass(stmtRows, rawRows, sameItemKey, false, '가입서비스 번호 다름', nameLoose));

    var undeducted = [], changed = [];
    pairs.forEach(function (p) {
      var r = p.raw, st = p.st;
      var paid = paidByUs(r);
      var expected = r.정산종류 === '일반' ? Math.max(paid, r.차감내역_사은품) : r.차감내역_사은품;
      var gap = expected - st.차감내역_사은품;
      var reasons = [];
      if (gap > 0) {
        if (/웨이브넷/.test(r.사은품지급처) && !/웨이브넷/.test(st.사은품지급처))
          reasons.push('지급처 변경: ' + (st.사은품지급처 || '미입력') + ' → ' + r.사은품지급처);
        else if (st.현금 === 0 && r.현금 > 0) reasons.push('정산 후 사은품 금액 입력');
        else if (st.현금 < r.현금) reasons.push('정산 후 사은품 증액');
        else reasons.push('정산 당시 지급 정보 있었으나 미차감');
        if (r.차감내역_사은품 < paid) reasons.push('현재 로우도 미차감');
        undeducted.push({ raw: r, st: st, paid: paid, stDed: st.차감내역_사은품, rawDed: r.차감내역_사은품, gap: gap, reason: reasons.join(' / '), note: p.note });
      }
      var diffs = [];
      NUM_FIELDS.forEach(function (f) {
        if (f === '현금' || f === '차감내역_사은품') return;
        if (r[f] !== st[f]) diffs.push({ f: f, a: st[f], b: r[f] });
      });
      if (r.차감내역_사은품 < st.차감내역_사은품) diffs.push({ f: '차감내역_사은품', a: st.차감내역_사은품, b: r.차감내역_사은품, over: true });
      // 사은품 차감 차이만으로 설명되는 정산금액 변동은 제외
      var only = diffs.length === 1 && diffs[0].f === '정산금액' && (st.정산금액 - r.정산금액) === (r.차감내역_사은품 - st.차감내역_사은품);
      if (diffs.length && !only) changed.push({ raw: r, st: st, diffs: diffs, note: p.note, delta: r.정산금액 - st.정산금액 });
      else if (p.note && !gap) changed.push({ raw: r, st: st, diffs: [], note: p.note, delta: r.정산금액 - st.정산금액 });
    });

    // 누락은 올린 정산서의 정산예정일(회차)에 해당하는 로우만 판단. 다른 회차 로우는 따로 셈
    var stDates = {}; stmtRows.forEach(function (r) { if (r.정산예정일) stDates[r.정산예정일] = 1; });
    var hasDates = Object.keys(stDates).length > 0, otherRound = { count: 0, dates: {} };
    var missing = rawRows.filter(function (r) {
      if (r._used) return false;
      if (hasDates && r.정산예정일 && !stDates[r.정산예정일]) { otherRound.count++; otherRound.dates[r.정산예정일] = (otherRound.dates[r.정산예정일] || 0) + 1; return false; }
      return true;
    }).map(function (r) {
      return { raw: r, paid: paidByUs(r) };
    });
    var stmtOnly = stmtRows.filter(function (r) { return !r._used; }).map(function (st) { return { st: st }; });

    // 확인 필요: 현재 로우 자체 이상
    var checks = [];
    rawRows.forEach(function (r) {
      if (/유치자/.test(r.사은품지급처) && r.현금 > 0) checks.push({ raw: r, why: '지급처는 유치자지급인데 금액 ' + r.현금.toLocaleString() + '원 입력' });
      if (r.정산종류 === '일반' && paidByUs(r) > r.차감내역_사은품) checks.push({ raw: r, why: '웨이브넷 지급 ' + paidByUs(r).toLocaleString() + '원인데 현재 로우 사은품 차감 ' + r.차감내역_사은품.toLocaleString() + '원' });
    });
    var seen = {};
    rawRows.forEach(function (r) {
      var k = [keyOf(r), r.고객명, NUM_FIELDS.map(function (f) { return r[f]; }).join(',')].join('#');
      if (seen[k]) checks.push({ raw: r, why: '같은 정산구분으로 모든 금액이 같은 행이 2줄 이상 (' + r.정산종류 + ')' });
      seen[k] = 1;
    });

    // 협력점 요약
    var parts = {};
    function P(r) {
      var k = r._partner || '(협력점 없음)';
      return parts[k] = parts[k] || { key: k, name: r.협력점, raw: 0, stmt: 0, und: 0, undAmt: 0, miss: 0, missPaid: 0, only: 0, chg: 0 };
    }
    rawRows.forEach(function (r) { var p = P(r); p.raw++; p.name = r.협력점; });
    stmtRows.forEach(function (r) { var p = P(r); p.stmt++; if (!p.name) p.name = r.협력점; });
    undeducted.forEach(function (u) { var p = P(u.raw); p.und++; p.undAmt += u.gap; });
    missing.forEach(function (m) { var p = P(m.raw); p.miss++; if (m.paid > 0 && m.raw.정산종류 === '일반') p.missPaid++; });
    stmtOnly.forEach(function (m) { P(m.st).only++; });
    changed.forEach(function (c) { P(c.raw).chg++; });
    var partners = Object.keys(parts).map(function (k) { return parts[k]; })
      .sort(function (a, b) { return b.undAmt - a.undAmt || b.miss - a.miss || a.name.localeCompare(b.name); });

    return { otherRound: otherRound, roundDates: Object.keys(stDates).sort(), excluded: excluded, rawCount: rawRows.length, stmtCount: stmtRows.length, pairs: pairs, undeducted: undeducted, missing: missing, stmtOnly: stmtOnly, changed: changed, checks: checks, partners: partners };
  }

  return { htmlToGrid: htmlToGrid, gridToRecords: gridToRecords, run: run, paidByUs: paidByUs, normPartner: normPartner, isOwnBranch: isOwnBranch, nameMatch: nameMatch, nameLoose: nameLoose, normSvc: normSvc, DED: DED };
})();
if (typeof module !== 'undefined') module.exports = Engine;
