(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var won = function (n) { return (n || 0).toLocaleString('ko-KR'); };
  var esc = function (t) { return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  function mask(n) { n = String(n || ''); if (n.indexOf('*') >= 0 || n.length < 2) return n; return n[0] + '*' + n.slice(2); }

  var state = {
    user: null,
    raw: null, rawName: '', stmts: [],
    res: null, mode: 'live',          // live | demo | saved
    savedRun: null, savedId: null,    // 저장된 기록을 보는 중이면 그 정보
    tab: 'partners', q: '', partner: '', type: '', noSt: false, paidOnly: false, sort: null, limit: 300
  };

  /* ═════════════ 인증 ═════════════ */
  function show(view) {
    $('authView').hidden = view !== 'login';
    $('mustChangeView').hidden = view !== 'mustChange';
    $('appView').hidden = view !== 'app';
  }
  function onAuthLost(err) {
    state.user = null; show('login');
    $('loginErr').textContent = (err && err.message) || '다시 로그인해 주세요.';
  }
  function handleErr(el) {
    return function (err) {
      if (err && err.auth) return onAuthLost(err);
      if (el) { el.textContent = err.message; el.className = el.className.replace(/\bok\b/, '') + ' err'; }
    };
  }
  function enterApp(user) {
    state.user = user;
    $('whoName').textContent = user.name;
    $('navAccounts').hidden = user.role !== 'admin';
    show('app');
  }

  $('loginForm').addEventListener('submit', function (e) {
    e.preventDefault();
    $('loginErr').textContent = ''; $('loginBtn').disabled = true;
    Api.login($('loginId').value.trim(), $('loginPw').value).then(function (r) {
      $('loginPw').value = '';
      state.user = r.user;
      if (r.mustChange) { show('mustChange'); $('mcOld').focus(); }
      else enterApp(r.user);
    }).catch(function (err) { $('loginErr').textContent = err.message; })
      .then(function () { $('loginBtn').disabled = false; });
  });

  $('mustChangeForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var err = $('mcErr'); err.textContent = '';
    if ($('mcNew').value !== $('mcNew2').value) { err.textContent = '새 비밀번호 두 칸이 서로 달라요.'; return; }
    Api.changePassword($('mcOld').value, $('mcNew').value).then(function () {
      ['mcOld', 'mcNew', 'mcNew2'].forEach(function (id) { $(id).value = ''; });
      return Api.me();
    }).then(enterApp).catch(function (e2) { if (e2.auth) return onAuthLost(e2); err.textContent = e2.message; });
  });

  $('navLogout').addEventListener('click', function () {
    Api.logout().then(function () { state.user = null; show('login'); $('loginErr').textContent = ''; });
  });

  function boot() {
    if (!Api.hasToken()) return show('login');
    Api.me().then(function (u) {
      if (u.mustChange) { state.user = u; show('mustChange'); } else enterApp(u);
    }).catch(function (err) { onAuthLost(err.auth ? { message: '' } : err); });
  }

  /* ═════════════ 화면 전환 ═════════════ */
  function go(view) {
    $('checkView').hidden = view !== 'check';
    $('historyView').hidden = view !== 'history';
    $('result').hidden = !(view === 'check' && state.res);
    $('navCheck').setAttribute('aria-current', view === 'check');
    $('navHistory').setAttribute('aria-current', view === 'history');
    if (view === 'history') loadHistory();
  }
  $('navCheck').addEventListener('click', function () { go('check'); });
  $('navHistory').addEventListener('click', function () { go('history'); });

  /* ═════════════ 파일 읽기 ═════════════ */
  function decodeText(buf) {
    var b = new Uint8Array(buf);
    if (b[0] === 0xFF && b[1] === 0xFE) return new TextDecoder('utf-16le').decode(buf);
    if (b[0] === 0xFE && b[1] === 0xFF) return new TextDecoder('utf-16be').decode(buf);
    var head = new TextDecoder('utf-8').decode(b.slice(0, 400));
    if (/<(table|html|style|tr|meta)/i.test(head)) {
      var t = new TextDecoder('utf-8').decode(buf);
      if ((t.match(/�/g) || []).length > 20) { try { t = new TextDecoder('euc-kr').decode(buf); } catch (e) {} }
      return t;
    }
    return null;
  }
  function readFile(file) {
    return file.arrayBuffer().then(function (buf) {
      var text = decodeText(buf);
      if (text) return Engine.gridToRecords(Engine.htmlToGrid(text));
      if (typeof XLSX === 'undefined') throw new Error('엑셀 해석 라이브러리를 불러오지 못했어요. 인터넷 연결을 확인하세요.');
      var wb = XLSX.read(buf, { type: 'array', cellDates: true });
      var ws = wb.Sheets[wb.SheetNames[0]];
      return Engine.gridToRecords(XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: '' }));
    });
  }
  function bindDrop(zone, input, onFiles) {
    zone.addEventListener('click', function (e) { if (e.target.closest('button')) return; input.click(); });
    zone.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); } });
    input.addEventListener('change', function () { onFiles([].slice.call(input.files)); input.value = ''; });
    ['dragenter', 'dragover'].forEach(function (ev) { zone.addEventListener(ev, function (e) { e.preventDefault(); zone.classList.add('over'); }); });
    ['dragleave', 'drop'].forEach(function (ev) { zone.addEventListener(ev, function (e) { e.preventDefault(); zone.classList.remove('over'); }); });
    zone.addEventListener('drop', function (e) { onFiles([].slice.call(e.dataTransfer.files)); });
  }

  bindDrop($('dropRaw'), $('fileRaw'), function (files) {
    if (!files.length) return;
    leaveSpecialMode();
    var f = files[0];
    $('rawHint').textContent = '읽는 중…';
    readFile(f).then(function (rows) {
      state.raw = rows; state.rawName = f.name;
      $('dropRaw').classList.add('filled');
      $('rawTitle').textContent = f.name;
      $('rawHint').textContent = rows.length.toLocaleString() + '건 · 정산예정일 ' + summarizeDates(rows);
      refreshRun();
    }).catch(function (err) {
      state.raw = null; $('rawTitle').textContent = f.name;
      $('rawHint').innerHTML = '<span style="color:var(--danger)">읽지 못했어요: ' + esc(err.message) + '</span>';
      refreshRun();
    });
  });

  bindDrop($('dropSt'), $('fileSt'), function (files) {
    if (!files.length) return;
    leaveSpecialMode();
    $('stHint').textContent = files.length + '개 읽는 중…';
    Promise.all(files.map(function (f) {
      return readFile(f).then(function (rows) { return { name: f.name, rows: rows }; }, function (err) { return { name: f.name, rows: [], error: err.message }; });
    })).then(function (list) {
      list.forEach(function (item) {
        state.stmts = state.stmts.filter(function (s) { return s.name !== item.name; });
        state.stmts.push(item);
      });
      renderStList(); refreshRun();
    });
  });

  function summarizeDates(rows) {
    var c = {}; rows.forEach(function (r) { var d = r.정산예정일 || '없음'; c[d] = (c[d] || 0) + 1; });
    var ks = Object.keys(c).sort(function (a, b) { return c[b] - c[a]; });
    return ks.slice(0, 2).join(', ') + (ks.length > 2 ? ' 외 ' + (ks.length - 2) + '개' : '');
  }
  function renderStList() {
    var ok = state.stmts.filter(function (s) { return !s.error; });
    var rows = ok.reduce(function (a, s) { return a + s.rows.length; }, 0);
    var errs = state.stmts.filter(function (s) { return s.error; });
    $('dropSt').classList.toggle('filled', state.stmts.length > 0);
    $('stTitle').textContent = state.stmts.length ? ok.length + '개 파일 · ' + rows.toLocaleString() + '건' : '협력점별 정산내역서 여러 개';
    $('stHint').textContent = state.stmts.length ? (errs.length ? '읽지 못한 파일 ' + errs.length + '개가 있어요.' : '더 넣으면 이어서 쌓여요. 같은 이름 파일은 바꿔 넣어요.') : '같은 회차 파일을 한 번에 모두 선택하세요. 추가로 넣으면 이어서 쌓여요.';
    var box = $('stList'); box.hidden = !state.stmts.length;
    box.innerHTML = errs.map(function (s) { return '<span class="chip err" title="' + esc(s.error) + '">' + esc(s.name) + ' · ' + esc(s.error) + '</span>'; }).join('') +
      ok.map(function (s) { var p = s.rows[0] ? s.rows[0].협력점 : '빈 파일'; return '<span class="chip" title="' + esc(s.name) + '">' + esc(p) + ' ' + s.rows.length + '</span>'; }).join('');
  }
  function refreshRun() { $('runBtn').disabled = !(state.raw && state.stmts.some(function (s) { return !s.error; })); }

  function resetInputs() {
    state.raw = null; state.stmts = [];
    $('dropRaw').classList.remove('filled'); $('rawTitle').textContent = '전체정산관리 엑셀 1개'; $('rawHint').textContent = '정산예정일로 받은 파일을 끌어다 놓거나 눌러서 선택하세요.';
    renderStList(); refreshRun();
  }
  function clearResult() {
    state.res = null; state.mode = 'live'; state.savedRun = null; state.savedId = null;
    $('result').hidden = true; $('intro').hidden = false; $('notices').innerHTML = '';
    $('demoBanner').hidden = true; $('viewingBanner').hidden = true; $('saveBar').hidden = true;
  }
  // 예시나 저장 기록을 보다가 새 파일을 넣으면 그 화면을 걷어냄
  function leaveSpecialMode() {
    if (state.mode === 'demo') { resetInputs(); clearResult(); }
    else if (state.mode === 'saved') { clearResult(); }
  }

  $('resetBtn').addEventListener('click', function () { resetInputs(); clearResult(); });
  $('runBtn').addEventListener('click', runCheck);

  /* ═════════════ 검수 실행 ═════════════ */
  function runCheck() {
    var stRows = [];
    state.stmts.forEach(function (s) { if (!s.error) s.rows.forEach(function (r) { r._file = s.name; stRows.push(r); }); });
    var raw = state.raw.map(function (r) { var o = {}; for (var k in r) o[k] = r[k]; return o; });
    var res = Engine.run(raw, stRows);
    var dates = {}; raw.forEach(function (r) { if (r.정산예정일) dates[r.정산예정일] = (dates[r.정산예정일] || 0) + 1; });
    var settleDate = Object.keys(dates).sort(function (a, b) { return dates[b] - dates[a]; })[0] || '';
    res.meta = { settleDate: settleDate, rawFile: state.rawName, stmtFiles: state.stmts.filter(function (s) { return !s.error; }).length,
      rawRows: raw.length, stmtRows: stRows.length, matched: res.pairs.length };
    res.saveable = state.mode !== 'demo';
    state.res = res;
    resetView();
    notices(raw, stRows);
    fillPartnerSel();
    $('intro').hidden = true; $('result').hidden = false;
    $('viewingBanner').hidden = true;
    $('saveBar').hidden = !res.saveable;
    $('saveState').textContent = ''; $('saveState').className = 'state'; $('saveBtn').disabled = false; $('saveMemo').value = '';
    state.tab = res.undeducted.length ? 'und' : 'partners';
    renderAll();
  }
  function resetView() { state.partner = ''; state.q = ''; $('q').value = ''; state.sort = null; state.limit = 300; }

  function notices(raw, st) {
    var out = [];
    var rd = {}, sd = {};
    raw.forEach(function (r) { rd[r.정산예정일] = 1; }); st.forEach(function (r) { sd[r.정산예정일] = 1; });
    var rk = Object.keys(rd), sk = Object.keys(sd);
    var extra = sk.filter(function (d) { return !rd[d]; });
    if (rk.length > 1) out.push(['warn', '로우데이터에 정산예정일이 ' + rk.length + '개 섞여 있어요 (' + rk.join(', ') + '). 한 회차씩 검수하는 게 정확해요.']);
    if (extra.length) out.push(['warn', '정산내역서에 로우데이터와 다른 정산예정일이 있어요 (' + extra.join(', ') + '). 다른 회차 파일이 섞였는지 확인하세요.']);
    noStNotice(out);
    $('notices').innerHTML = out.map(function (m) { return '<div class="msg ' + (m[0] === 'info' ? '' : m[0]) + '">' + m[1] + '</div>'; }).join('');
  }
  function noStNotice(out) {
    var noSt = state.res.partners.filter(function (p) { return p.stmt === 0 && p.raw > 0; });
    if (!noSt.length) return;
    var n = noSt.reduce(function (a, p) { return a + p.raw; }, 0);
    out.push(['info', '정산내역서가 없는 협력점 ' + noSt.length + '곳(' + n.toLocaleString() + '건)은 누락 목록에서 ' + (state.mode === 'saved' ? '저장하지 않았어요' : '기본으로 숨겼어요') + '. 정말 정산서가 안 나간 곳인지, 파일을 덜 올린 건지 확인하세요: ' +
      noSt.slice(0, 12).map(function (p) { return esc(p.name); }).join(', ') + (noSt.length > 12 ? ' 외 ' + (noSt.length - 12) + '곳' : '')]);
  }
  function fillPartnerSel() {
    $('partnerSel').innerHTML = '<option value="">전체 협력점</option>' + state.res.partners.slice().sort(function (a, b) { return a.key.localeCompare(b.key); })
      .map(function (p) { return '<option value="' + esc(p.key) + '">' + esc(p.key) + (p.stmt === 0 ? ' (정산서 없음)' : '') + '</option>'; }).join('');
  }

  /* ═════════════ 탭 정의 ═════════════ */
  var partnerHasSt = function (key) { var p = state.res.partners.find(function (x) { return x.key === key; }); return p && p.stmt > 0; };
  function R(x) { return x.raw || x.st; }
  function label(f) { return f.replace('차감내역_', '차감 '); }
  function typeTag(t) { return '<span class="tag t-' + esc(t) + '">' + esc(t) + '</span>'; }
  function svcCell(x) { return '<span class="mono">' + esc(x.raw.가입서비스) + '</span><span class="small">' + esc(x.raw.상품명 + ' · ' + x.raw.상품옵션) + '</span>'; }
  function baseFilter(x) {
    var r = R(x), q = state.q;
    if (state.partner && r._partner !== state.partner) return false;
    if (state.type && r.정산종류 !== state.type) return false;
    if (q && [r.고객명, mask(r.고객명), r.가입서비스, r.상품명, r.상품옵션, r.협력점].join(' ').indexOf(q) < 0) return false;
    return true;
  }
  var TABS = {
    partners: { label: '협력점 요약', desc: '협력점별 대조 결과예요. 행을 누르면 그 협력점만 골라서 봐요. 협력점 이름은 기호와 (휴)를 떼고 묶었어요.',
      rows: function () { return state.res.partners; },
      cols: [
        { h: '협력점', v: function (p) { return p.key; }, html: function (p) { return esc(p.key) + '<span class="small">' + esc(p.name) + '</span>'; } },
        { h: '정산서 건수', num: true, v: function (p) { return p.stmt; }, html: function (p) { return p.stmt ? won(p.stmt) : '<span class="tag t-info">정산서 없음</span>'; } },
        { h: '로우 건수', num: true, v: function (p) { return p.raw; } },
        { h: '미차감 건수', num: true, v: function (p) { return p.und; } },
        { h: '미차감 금액', num: true, v: function (p) { return p.undAmt; }, html: function (p) { return p.undAmt ? '<span class="amt-bad">' + won(p.undAmt) + '</span>' : '0'; } },
        { h: '누락', num: true, v: function (p) { return p.stmt ? p.miss : 0; }, html: function (p) { return p.stmt ? won(p.miss) + (p.missPaid ? '<span class="small">사은품 지급 ' + p.missPaid + '</span>' : '') : '–'; } },
        { h: '정산서에만', num: true, v: function (p) { return p.only; } },
        { h: '금액 변동', num: true, v: function (p) { return p.chg; } }
      ],
      filter: function (p) { return (!state.q || p.key.indexOf(state.q) >= 0 || p.name.indexOf(state.q) >= 0) && (!state.partner || p.key === state.partner); },
      rowClick: function (p) { state.partner = p.key; $('partnerSel').value = p.key; state.tab = p.und ? 'und' : (p.miss && p.stmt ? 'miss' : 'chg'); renderAll(); }
    },
    und: { label: '① 미차감', hot: true, desc: '현재 로우에서는 웨이브넷이 사은품을 지급했는데, 정산 당시 정산내역서에는 그만큼 차감되지 않은 건이에요. 미차감액이 다음 정산에서 환수할 금액이에요.',
      rows: function () { return state.res.undeducted; }, typed: true,
      cols: [
        { h: '협력점', v: function (x) { return x.raw._partner; } },
        { h: '구분', v: function (x) { return x.raw.정산종류; }, html: function (x) { return typeTag(x.raw.정산종류); } },
        { h: '고객명', v: function (x) { return x.raw.고객명; } },
        { h: '가입서비스 / 상품', v: function (x) { return x.raw.가입서비스; }, html: svcCell },
        { h: '개통일', v: function (x) { return x.raw.개통일; }, cls: 'nowrap mono' },
        { h: '정산서 지급처', v: function (x) { return x.st.사은품지급처; } },
        { h: '현재 지급처', v: function (x) { return x.raw.사은품지급처; } },
        { h: '현재 지급액', num: true, v: function (x) { return x.paid; } },
        { h: '정산서 차감', num: true, v: function (x) { return x.stDed; } },
        { h: '미차감액', num: true, v: function (x) { return x.gap; }, html: function (x) { return '<span class="amt-bad">' + won(x.gap) + '</span>'; } },
        { h: '지급완료일', v: function (x) { return x.raw.지급완료; }, cls: 'nowrap mono' },
        { h: '사유', v: function (x) { return x.reason + (x.note ? ' / ' + x.note : ''); } }
      ],
      filter: baseFilter
    },
    miss: { label: '② 정산서 누락', desc: '현재 로우에는 있는데 올린 정산내역서 어디에도 없는 건이에요. 사은품 지급이 있는 일반 건은 차감 없이 넘어갔을 가능성이 커서 표시해뒀어요.',
      rows: function () { return state.res.missing; }, typed: true, noSt: true, paid: true,
      cols: [
        { h: '협력점', v: function (x) { return x.raw._partner; }, html: function (x) { return esc(x.raw._partner) + (partnerHasSt(x.raw._partner) ? '' : '<span class="small">정산서 없음</span>'); } },
        { h: '구분', v: function (x) { return x.raw.정산종류; }, html: function (x) { return typeTag(x.raw.정산종류); } },
        { h: '고객명', v: function (x) { return x.raw.고객명; } },
        { h: '가입서비스 / 상품', v: function (x) { return x.raw.가입서비스; }, html: svcCell },
        { h: '개통일', v: function (x) { return x.raw.개통일; }, cls: 'nowrap mono' },
        { h: '개통상태', v: function (x) { return x.raw.개통상태; }, cls: 'nowrap' },
        { h: '정산금액', num: true, v: function (x) { return x.raw.정산금액; } },
        { h: '지급처', v: function (x) { return x.raw.사은품지급처; } },
        { h: '지급액', num: true, v: function (x) { return x.paid; } },
        { h: '사은품 차감', num: true, v: function (x) { return x.raw.차감내역_사은품; } },
        { h: '', v: function (x) { return x.paid > 0 && x.raw.정산종류 === '일반' ? 1 : 0; }, html: function (x) { return x.paid > 0 && x.raw.정산종류 === '일반' ? '<span class="tag t-miss">사은품 지급</span>' : ''; } }
      ],
      filter: function (x) { return baseFilter(x) && (state.noSt || partnerHasSt(x.raw._partner) || state.partner) && (!state.paidOnly || x.paid > 0); }
    },
    only: { label: '③ 정산서에만', desc: '정산내역서에는 있는데 현재 로우에서 찾지 못한 건이에요. 접수가 삭제·취소됐거나 가입서비스·상품명이 바뀌었을 수 있어요.',
      rows: function () { return state.res.stmtOnly; }, typed: true,
      cols: [
        { h: '협력점', v: function (x) { return x.st._partner; } },
        { h: '구분', v: function (x) { return x.st.정산종류; }, html: function (x) { return typeTag(x.st.정산종류); } },
        { h: '고객명', v: function (x) { return mask(x.st.고객명); } },
        { h: '가입서비스 / 상품', v: function (x) { return x.st.가입서비스; }, html: function (x) { return esc(x.st.가입서비스) + '<span class="small">' + esc(x.st.상품명 + ' · ' + x.st.상품옵션) + '</span>'; } },
        { h: '개통일', v: function (x) { return x.st.개통일; }, cls: 'nowrap mono' },
        { h: '정산금액', num: true, v: function (x) { return x.st.정산금액; } },
        { h: '사은품 차감', num: true, v: function (x) { return x.st.차감내역_사은품; } },
        { h: '파일', v: function (x) { return x.st._file; } }
      ],
      filter: baseFilter
    },
    chg: { label: '④ 금액 변동', desc: '정산 이후 사은품 외 금액이 바뀐 건이에요. 정산서보다 사은품이 더 많이 차감됐던 건(과차감)도 여기 나와요. 정산금액 차이는 현재 − 정산서예요.',
      rows: function () { return state.res.changed; }, typed: true,
      cols: [
        { h: '협력점', v: function (x) { return x.raw._partner; } },
        { h: '구분', v: function (x) { return x.raw.정산종류; }, html: function (x) { return typeTag(x.raw.정산종류); } },
        { h: '고객명', v: function (x) { return x.raw.고객명; } },
        { h: '가입서비스 / 상품', v: function (x) { return x.raw.가입서비스; }, html: svcCell },
        { h: '개통일', v: function (x) { return x.raw.개통일; }, cls: 'nowrap mono' },
        { h: '바뀐 항목 (정산서 → 현재)', v: function (x) { return x.diffs.map(function (d) { return label(d.f) + ' ' + won(d.a) + ' → ' + won(d.b) + (d.over ? ' (과차감)' : ''); }).join(', '); },
          html: function (x) { return x.diffs.map(function (d) { return '<span class="nowrap">' + esc(label(d.f)) + ' <span class="mono">' + won(d.a) + '</span><span class="arrow">→</span><span class="mono">' + won(d.b) + '</span>' + (d.over ? ' <span class="tag t-miss">과차감</span>' : '') + '</span>'; }).join('<br>') || '<span class="small">금액 변동 없음</span>'; } },
        { h: '정산금액 차이', num: true, v: function (x) { return x.delta; }, html: function (x) { return (x.delta > 0 ? '+' : '') + won(x.delta); } },
        { h: '비고', v: function (x) { return x.note; } }
      ],
      filter: baseFilter
    },
    chk: { label: '⑤ 확인 필요', desc: '정산서와 상관없이 현재 로우 자체에서 이상해 보이는 건이에요. 추단처럼 정상인 중복도 있으니 확인만 하시면 돼요.',
      rows: function () { return state.res.checks; }, typed: true,
      cols: [
        { h: '협력점', v: function (x) { return x.raw._partner; } },
        { h: '구분', v: function (x) { return x.raw.정산종류; }, html: function (x) { return typeTag(x.raw.정산종류); } },
        { h: '고객명', v: function (x) { return x.raw.고객명; } },
        { h: '가입서비스 / 상품', v: function (x) { return x.raw.가입서비스; }, html: svcCell },
        { h: '개통일', v: function (x) { return x.raw.개통일; }, cls: 'nowrap mono' },
        { h: '정산금액', num: true, v: function (x) { return x.raw.정산금액; } },
        { h: '내용', v: function (x) { return x.why; } }
      ],
      filter: baseFilter
    }
  };
  var ORDER = ['partners', 'und', 'miss', 'only', 'chg', 'chk'];

  /* ═════════════ 렌더 ═════════════ */
  function renderAll() { renderStats(); renderTabs(); renderTable(); }
  function renderStats() {
    var r = state.res, m = r.meta;
    var undAmt = r.undeducted.reduce(function (a, x) { return a + x.gap; }, 0);
    var missVis = r.missing.filter(function (x) { return partnerHasSt(x.raw._partner); });
    var missPaid = missVis.filter(function (x) { return x.paid > 0 && x.raw.정산종류 === '일반'; }).length;
    $('stats').innerHTML = [
      ['und', r.undeducted.length ? 'hot' : '', '① 미차감', won(r.undeducted.length) + '건', '환수 대상 <strong>' + won(undAmt) + '원</strong>'],
      ['miss', missPaid ? 'warm' : '', '② 정산서 누락', won(missVis.length) + '건', '사은품 지급 건 ' + won(missPaid) + '건'],
      ['only', '', '③ 정산서에만', won(r.stmtOnly.length) + '건', '정산서 ' + won(m.stmtRows) + '건 중'],
      ['chg', '', '④ 금액 변동', won(r.changed.length) + '건', '매칭 ' + won(m.matched) + '건 중'],
      ['chk', '', '⑤ 확인 필요', won(r.checks.length) + '건', '로우 ' + won(m.rawRows) + '건 기준']
    ].map(function (s) {
      return '<button class="stat ' + s[1] + '" data-tab="' + s[0] + '"><span class="k">' + s[2] + '</span><span class="v">' + s[3] + '</span><span class="d">' + s[4] + '</span></button>';
    }).join('');
    [].forEach.call($('stats').querySelectorAll('.stat'), function (b) { b.addEventListener('click', function () { state.tab = b.dataset.tab; state.sort = null; renderAll(); }); });
  }
  function renderTabs() {
    $('tabs').innerHTML = ORDER.map(function (k) {
      var t = TABS[k], n = t.rows().filter(t.filter).length;
      return '<button class="tab' + (t.hot && n ? ' hot' : '') + '" role="tab" aria-selected="' + (state.tab === k) + '" data-k="' + k + '">' + t.label + '<span class="n">' + n.toLocaleString() + '</span></button>';
    }).join('');
    [].forEach.call($('tabs').querySelectorAll('.tab'), function (b) { b.addEventListener('click', function () { state.tab = b.dataset.k; state.sort = null; state.limit = 300; renderAll(); }); });
    var t = TABS[state.tab];
    $('tabDesc').textContent = t.desc;
    $('typeSeg').hidden = !t.typed;
    $('noStWrap').hidden = !t.noSt || state.mode === 'saved';
    $('paidWrap').hidden = !t.paid;
  }
  function renderTable() {
    var t = TABS[state.tab];
    var rows = t.rows().filter(t.filter);
    if (state.sort) {
      var c = t.cols[state.sort.i], dir = state.sort.dir;
      rows = rows.slice().sort(function (a, b) { var x = c.v(a), y = c.v(b); return (typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y))) * dir; });
    }
    $('tbl').tHead.innerHTML = '<tr>' + t.cols.map(function (c, i) {
      var cls = state.sort && state.sort.i === i ? (state.sort.dir > 0 ? 'asc' : 'desc') : '';
      return '<th data-sort="' + i + '" class="' + cls + '"' + (c.num ? ' style="text-align:right"' : '') + '>' + esc(c.h) + '</th>';
    }).join('') + '</tr>';
    [].forEach.call($('tbl').tHead.querySelectorAll('th'), function (th) {
      th.addEventListener('click', function () {
        var i = +th.dataset.sort; state.sort = state.sort && state.sort.i === i ? { i: i, dir: -state.sort.dir } : { i: i, dir: t.cols[i].num ? -1 : 1 }; renderTable();
      });
    });
    if (!rows.length) {
      $('tbl').tBodies[0].innerHTML = '<tr><td colspan="' + t.cols.length + '" class="empty">' + (state.tab === 'und' ? '미차감 건이 없어요. 정산 후 지급된 사은품이 모두 차감돼 있어요.' : '해당하는 건이 없어요.') + '</td></tr>';
      $('more').hidden = true; return;
    }
    var shown = rows.slice(0, state.limit);
    $('tbl').tBodies[0].innerHTML = shown.map(function (x, idx) {
      return '<tr' + (t.rowClick ? ' class="click" data-i="' + idx + '"' : '') + '>' + t.cols.map(function (c) {
        var inner = c.html ? c.html(x) : (c.num ? won(c.v(x)) : esc(c.v(x)));
        return '<td class="' + (c.num ? 'num ' : '') + (c.cls || '') + '">' + inner + '</td>';
      }).join('') + '</tr>';
    }).join('');
    if (t.rowClick) [].forEach.call($('tbl').tBodies[0].querySelectorAll('tr.click'), function (tr) { tr.addEventListener('click', function () { t.rowClick(shown[+tr.dataset.i]); }); });
    var m = $('more');
    if (rows.length > state.limit) {
      m.hidden = false; m.innerHTML = rows.length.toLocaleString() + '건 중 ' + state.limit + '건 표시 · <button class="linkbtn" id="moreBtn">더 보기</button> (엑셀로 받으면 전체가 들어가요)';
      $('moreBtn').addEventListener('click', function () { state.limit += 500; renderTable(); });
    } else m.hidden = true;
  }

  $('q').addEventListener('input', function () { state.q = this.value.trim(); state.limit = 300; renderTabs(); renderTable(); });
  $('partnerSel').addEventListener('change', function () { state.partner = this.value; state.limit = 300; renderTabs(); renderTable(); });
  [].forEach.call($('typeSeg').querySelectorAll('button'), function (b) {
    b.addEventListener('click', function () {
      state.type = b.dataset.v; [].forEach.call($('typeSeg').querySelectorAll('button'), function (x) { x.setAttribute('aria-pressed', x === b); }); renderTabs(); renderTable();
    });
  });
  $('noSt').addEventListener('change', function () { state.noSt = this.checked; renderTabs(); renderTable(); });
  $('paidOnly').addEventListener('change', function () { state.paidOnly = this.checked; renderTabs(); renderTable(); });

  /* ═════════════ 결과 저장 / 불러오기 ═════════════ */
  var KEEP = ['정산종류', '고객명', '가입서비스', '상품명', '상품옵션', '협력점', '_partner', '개통일', '개통상태', '접수일', '유치자',
    '사은품지급처', '현금', '차감내역_사은품', '약정금액', '정산금액', '지급완료', '정산예정일', '정산완료일', '_file'];
  function pick(r) {
    if (!r) return null;
    var o = {}; KEEP.forEach(function (k) { if (r[k] !== undefined && r[k] !== '') o[k] = r[k]; });
    if (o.고객명) o.고객명 = mask(o.고객명);   // 정산서 실명은 저장하지 않음
    return o;
  }
  function finding(kind, x, amount, extra) {
    var r = R(x), d = { raw: pick(x.raw), st: pick(x.st) };
    for (var k in extra) d[k] = extra[k];
    return { kind: kind, partner: r._partner || '', type: r.정산종류 || '', name: mask(r.고객명), svc: r.가입서비스 || '',
      product: (r.상품명 || '') + (r.상품옵션 ? ' · ' + r.상품옵션 : ''), openDate: r.개통일 || '', amount: amount || 0, detail: d };
  }
  function buildPayload(memo) {
    var r = state.res, m = r.meta, f = [];
    r.undeducted.forEach(function (x) { f.push(finding('und', x, x.gap, { paid: x.paid, stDed: x.stDed, rawDed: x.rawDed, gap: x.gap, reason: x.reason, note: x.note })); });
    var missSaved = r.missing.filter(function (x) { return partnerHasSt(x.raw._partner); });
    missSaved.forEach(function (x) { f.push(finding('miss', x, x.raw.정산금액, { paid: x.paid })); });
    r.stmtOnly.forEach(function (x) { f.push(finding('only', x, x.st.정산금액, {})); });
    r.changed.forEach(function (x) { f.push(finding('chg', x, x.delta, { diffs: x.diffs, note: x.note, delta: x.delta })); });
    r.checks.forEach(function (x) { f.push(finding('chk', x, x.raw.정산금액, { why: x.why })); });
    var undAmt = r.undeducted.reduce(function (a, x) { return a + x.gap; }, 0);
    var run = {
      settleDate: m.settleDate, rawFile: m.rawFile, stmtFiles: m.stmtFiles, rawRows: m.rawRows, stmtRows: m.stmtRows, matched: m.matched,
      undCount: r.undeducted.length, undAmount: undAmt,
      missCount: missSaved.length, missPaid: missSaved.filter(function (x) { return x.paid > 0 && x.raw.정산종류 === '일반'; }).length,
      onlyCount: r.stmtOnly.length, chgCount: r.changed.length, chkCount: r.checks.length,
      partners: r.partners.map(function (p) { return { key: p.key, name: p.name, raw: p.raw, stmt: p.stmt, und: p.und, undAmt: p.undAmt, miss: p.miss, missPaid: p.missPaid, only: p.only, chg: p.chg }; }),
      memo: memo || ''
    };
    return { run: run, findings: f };
  }
  $('saveBtn').addEventListener('click', function () {
    if (!state.res || !state.res.saveable) return;
    var st = $('saveState'), btn = $('saveBtn');
    var p = buildPayload($('saveMemo').value.trim());
    btn.disabled = true; st.className = 'state'; st.textContent = '저장 중… (' + p.findings.length.toLocaleString() + '건)';
    Api.runSave(p.run, p.findings).then(function (r) {
      st.className = 'state ok'; st.textContent = '저장했어요 · 결과 ' + (r.findings || 0).toLocaleString() + '건. 검수 기록에서 다시 볼 수 있어요.';
      state.res.saveable = false;
    }).catch(function (err) {
      btn.disabled = false;
      if (err.auth) return onAuthLost(err);
      st.className = 'state err'; st.textContent = '저장하지 못했어요: ' + err.message;
    });
  });

  function openSaved(id) {
    Api.runGet(id).then(function (data) {
      var run = data.run, by = { und: [], miss: [], only: [], chg: [], chk: [] };
      (data.findings || []).forEach(function (f) { if (by[f.kind]) by[f.kind].push(f.detail || {}); });
      state.mode = 'saved'; state.savedRun = run; state.savedId = run.id;
      state.res = {
        undeducted: by.und, missing: by.miss, stmtOnly: by.only,
        changed: by.chg.map(function (d) { d.diffs = d.diffs || []; return d; }),
        checks: by.chk, partners: run.partners || [], saveable: false,
        meta: { settleDate: run.settleDate || '', rawFile: run.rawFile, stmtFiles: run.stmtFiles, rawRows: run.rawRows, stmtRows: run.stmtRows, matched: run.matched }
      };
      resetView();
      fillPartnerSel();
      var out = []; noStNotice(out);
      $('notices').innerHTML = out.map(function (m) { return '<div class="msg">' + m[1] + '</div>'; }).join('');
      $('demoBanner').hidden = true; $('saveBar').hidden = true;
      renderViewing();
      $('intro').hidden = true;
      state.tab = state.res.undeducted.length ? 'und' : 'partners';
      go('check');
      $('result').hidden = false;
      renderAll();
      window.scrollTo(0, 0);
    }).catch(handleErr(null));
  }
  function renderViewing() {
    var run = state.savedRun, v = $('viewingBanner');
    v.hidden = false;
    v.innerHTML = '<span>저장된 기록을 보는 중 · <b>' + esc(run.settleDate || '정산예정일 없음') + ' 회차</b> · ' + esc(run.at) + ' · ' + esc(run.by) +
      (run.memo ? ' · ' + esc(run.memo) : '') + '</span>' +
      '<span style="display:flex;gap:10px;align-items:center"><button class="linkbtn" id="vMemo">메모 고치기</button><button class="linkbtn" id="vClose">닫고 새 검수</button></span>';
    $('vClose').addEventListener('click', function () { clearResult(); });
    $('vMemo').addEventListener('click', function () {
      v.innerHTML = '<input class="memo-input" id="vMemoInput" style="flex:1 1 260px" maxlength="1000" aria-label="메모"><button class="btn-sm" id="vMemoSave">저장</button><button class="btn-sm" id="vMemoCancel">취소</button>';
      $('vMemoInput').value = run.memo || ''; $('vMemoInput').focus();
      $('vMemoCancel').addEventListener('click', renderViewing);
      $('vMemoSave').addEventListener('click', function () {
        var memo = $('vMemoInput').value.trim();
        Api.runMemo(run.id, memo).then(function () { run.memo = memo; renderViewing(); }).catch(handleErr(null));
      });
    });
  }

  /* ═════════════ 검수 기록 목록 ═════════════ */
  function loadHistory() {
    var tb = $('histTbl');
    tb.tHead.innerHTML = '<tr><th>정산예정일</th><th>검수 일시</th><th>실행자</th><th style="text-align:right">미차감</th><th style="text-align:right">미차감 금액</th><th style="text-align:right">누락</th><th style="text-align:right">정산서에만</th><th style="text-align:right">금액 변동</th><th>정산서 / 로우</th><th>메모</th><th></th></tr>';
    tb.tBodies[0].innerHTML = '<tr><td colspan="11" class="empty">불러오는 중…</td></tr>';
    Api.runList(200).then(function (list) {
      if (!list.length) { tb.tBodies[0].innerHTML = '<tr><td colspan="11" class="empty">아직 저장한 검수 결과가 없어요. 검수를 실행한 뒤 "결과 저장"을 누르면 여기 쌓여요.</td></tr>'; return; }
      var admin = state.user && state.user.role === 'admin';
      tb.tBodies[0].innerHTML = list.map(function (r, i) {
        return '<tr class="click" data-i="' + i + '">' +
          '<td class="mono nowrap">' + esc(r.settleDate || '–') + '</td>' +
          '<td class="mono nowrap">' + esc(r.at) + '</td>' +
          '<td>' + esc(r.by) + '</td>' +
          '<td class="num">' + won(r.undCount) + '</td>' +
          '<td class="num">' + (r.undAmount ? '<span class="amt-bad">' + won(r.undAmount) + '</span>' : '0') + '</td>' +
          '<td class="num">' + won(r.missCount) + (r.missPaid ? '<span class="small">사은품 ' + r.missPaid + '</span>' : '') + '</td>' +
          '<td class="num">' + won(r.onlyCount) + '</td>' +
          '<td class="num">' + won(r.chgCount) + '</td>' +
          '<td class="nowrap">' + won(r.stmtFiles) + '개 · ' + won(r.stmtRows) + '건 / ' + won(r.rawRows) + '건<span class="small">' + esc(r.rawFile) + '</span></td>' +
          '<td>' + esc(r.memo) + '</td>' +
          '<td><div class="row-actions">' + (admin ? '<button class="btn-sm danger" data-hide="' + i + '">숨기기</button>' : '') + '</div></td></tr>';
      }).join('');
      [].forEach.call(tb.tBodies[0].querySelectorAll('tr.click'), function (tr) {
        tr.addEventListener('click', function (e) { if (e.target.closest('[data-hide]')) return; openSaved(list[+tr.dataset.i].id); });
      });
      [].forEach.call(tb.tBodies[0].querySelectorAll('[data-hide]'), function (b) {
        b.addEventListener('click', function () {
          if (!b.classList.contains('armed')) { b.classList.add('armed'); b.textContent = '정말 숨길까요?'; setTimeout(function () { b.classList.remove('armed'); b.textContent = '숨기기'; }, 4000); return; }
          Api.runHide(list[+b.dataset.hide].id).then(loadHistory).catch(handleErr(null));
        });
      });
    }).catch(function (err) {
      if (err.auth) return onAuthLost(err);
      tb.tBodies[0].innerHTML = '<tr><td colspan="11" class="empty" style="color:var(--danger)">' + esc(err.message) + '</td></tr>';
    });
  }
  $('histReload').addEventListener('click', loadHistory);

  /* ═════════════ 비밀번호 변경 / 계정 관리 ═════════════ */
  function openModal(id) { $(id).hidden = false; var f = $(id).querySelector('input'); if (f) f.focus(); }
  function closeModal(id) { $(id).hidden = true; }
  [].forEach.call(document.querySelectorAll('.modal-back'), function (m) {
    m.addEventListener('click', function (e) { if (e.target === m || e.target.closest('[data-close]')) closeModal(m.id); });
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { closeModal('pwModal'); closeModal('acctModal'); } });

  $('navPw').addEventListener('click', function () { $('pwErr').textContent = ''; $('pwForm').reset(); openModal('pwModal'); });
  $('pwForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var err = $('pwErr'); err.className = 'form-err'; err.textContent = '';
    if ($('pwNew').value !== $('pwNew2').value) { err.textContent = '새 비밀번호 두 칸이 서로 달라요.'; return; }
    Api.changePassword($('pwOld').value, $('pwNew').value).then(function () {
      $('pwForm').reset(); err.className = 'form-ok'; err.textContent = '비밀번호를 바꿨어요. 다른 곳의 로그인은 끊어졌어요.';
    }).catch(function (e2) { if (e2.auth) return onAuthLost(e2); err.textContent = e2.message; });
  });

  var accounts = [];
  function loadAccounts() {
    Api.accountList().then(function (list) {
      accounts = list;
      $('acctTbl').tBodies[0].innerHTML = list.map(function (a, i) {
        return '<tr><td class="mono">' + esc(a.id) + '</td><td>' + esc(a.name) + '</td><td>' + (a.role === 'admin' ? '관리자' : '사용자') + '</td>' +
          '<td>' + (a.enabled ? (a.mustChange ? '<span class="tag t-miss">비번 변경 대기</span>' : '<span class="tag t-ok">사용</span>') : '<span class="tag t-info">중지</span>') + '</td>' +
          '<td class="mono nowrap">' + esc(a.lastLogin || '–') + '</td><td><div class="row-actions"><button class="btn-sm" data-edit="' + i + '">수정</button></div></td></tr>';
      }).join('');
      [].forEach.call($('acctTbl').querySelectorAll('[data-edit]'), function (b) {
        b.addEventListener('click', function () {
          var a = accounts[+b.dataset.edit];
          $('acId').value = a.id; $('acId').readOnly = true; $('acName').value = a.name; $('acPw').value = '';
          $('acRole').value = a.role; $('acEnabled').checked = a.enabled; $('acName').focus();
        });
      });
    }).catch(handleErr($('acErr')));
  }
  $('navAccounts').addEventListener('click', function () {
    $('acctForm').reset(); $('acId').readOnly = false; $('acErr').textContent = ''; openModal('acctModal'); loadAccounts();
  });
  $('acctForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var err = $('acErr'); err.className = 'form-err'; err.textContent = '';
    Api.accountSave({ id: $('acId').value.trim(), name: $('acName').value.trim(), password: $('acPw').value, role: $('acRole').value, enabled: $('acEnabled').checked })
      .then(function () {
        err.className = 'form-ok'; err.textContent = $('acId').value + ' 계정을 저장했어요.';
        $('acctForm').reset(); $('acId').readOnly = false; loadAccounts();
      }).catch(function (e2) { if (e2.auth) return onAuthLost(e2); err.textContent = e2.message; });
  });

  /* ═════════════ 엑셀 내보내기 ═════════════ */
  function sheetFrom(k) {
    var t = TABS[k];
    var rows = t.rows().filter(function (x) { return k === 'miss' ? (partnerHasSt(x.raw._partner) || state.noSt) : true; });
    var cols = t.cols.filter(function (c) { return c.h; });
    var aoa = [cols.map(function (c) { return c.h; })];
    rows.forEach(function (x) { aoa.push(cols.map(function (c) { return c.v(x); })); });
    if (k === 'und' || k === 'miss') {
      aoa[0] = aoa[0].concat(['상품명', '상품옵션', '접수일', '유치자', '정산완료일(현재)']);
      rows.forEach(function (x, i) { var r = x.raw; aoa[i + 1] = aoa[i + 1].concat([r.상품명, r.상품옵션, r.접수일, r.유치자, r.정산완료일]); });
    }
    var ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = aoa[0].map(function (h) { return { wch: Math.max(10, String(h).length * 2) }; });
    return ws;
  }
  $('exportBtn').addEventListener('click', function () {
    if (!state.res || typeof XLSX === 'undefined') return;
    var wb = XLSX.utils.book_new();
    var names = { partners: '협력점 요약', und: '1 미차감', miss: '2 정산서 누락', only: '3 정산서에만', chg: '4 금액 변동', chk: '5 확인 필요' };
    ORDER.forEach(function (k) { XLSX.utils.book_append_sheet(wb, sheetFrom(k), names[k]); });
    var d = (state.res.meta.settleDate || 'result').replace(/-/g, '');
    XLSX.writeFile(wb, '사은품차감검수_' + d + '.xlsx');
  });

  /* ═════════════ 예시 데이터 (가상) ═════════════ */
  function mk(o) {
    var base = { No: '1', 정산종류: '일반', 고객명: '', 가입서비스: '', 상품명: '', 상품옵션: '', 협력점: '', 유치자: '', 접수일: '2026-01-05', 개통일: '2026-01-07', 개통상태: '개통완료', 약정금액: 0, 번들수수료: 0, 동판수수료: 0, 수납: 0, 정산예정일: '2026-01-16', 사은품지급처: '사은품없음', 현금: 0 };
    Engine.DED.forEach(function (d) { base['차감내역_' + d] = 0; });
    for (var k in o) base[k] = o[k];
    base.정산금액 = base.약정금액 - Engine.DED.reduce(function (a, d) { return a + base['차감내역_' + d]; }, 0) + base.번들수수료 + base.동판수수료;
    return base;
  }
  function loadDemo() {
    var S = [
      mk({ 고객명: '한가람', 가입서비스: 'z!60000000001', 상품명: 'KT_인터넷', 상품옵션: '슬림(100M)', 협력점: '★가상텔레콤○', 약정금액: 450000, 사은품지급처: '유치자지급' }),
      mk({ 고객명: '한가람', 가입서비스: 'z!60000000002', 상품명: 'KT_TV', 상품옵션: 'TV베이직', 협력점: '★가상텔레콤○', 약정금액: 180000, 사은품지급처: '유치자지급' }),
      mk({ 고객명: '윤바다', 가입서비스: '7400000001', 상품명: 'SKB_인터넷', 상품옵션: '광랜(500M)', 협력점: '★가상텔레콤○', 약정금액: 520000, 개통일: '2026-01-08' }),
      mk({ 고객명: '서하늘', 가입서비스: '02-000-0001', 상품명: 'SKT_인터넷', 상품옵션: '기가라이트', 협력점: '■■예시네트웍스○', 약정금액: 480000, 사은품지급처: '웨이브넷 지급', 현금: 350000, 차감내역_사은품: 350000, 지급완료: '2026-01-09' }),
      mk({ 고객명: '서하늘', 가입서비스: '02-000-0001', 상품명: 'SKT_TV', 상품옵션: 'B tv 스탠다드', 협력점: '■■예시네트웍스○', 약정금액: 200000, 번들수수료: 90000 }),
      mk({ 고객명: '문나래', 가입서비스: 'z!60000000009', 상품명: 'KT_인터넷', 상품옵션: '에센스(1G)', 협력점: '■■예시네트웍스○', 약정금액: -300000, 정산종류: '환수', 개통상태: '해지(철회)완료', 개통일: '2025-11-20' })
    ];
    var Rw = S.map(function (r) { var o = {}; for (var k in r) o[k] = r[k]; o.고객명 = mask(o.고객명); o.협력점 = o.협력점.replace('★', '★(휴)'); return o; });
    Rw[0].사은품지급처 = '웨이브넷 지급'; Rw[0].현금 = 400000; Rw[0].차감내역_사은품 = 400000; Rw[0].정산금액 -= 400000; Rw[0].지급완료 = '2026-01-21';
    Rw[2].사은품지급처 = '웨이브넷 지급'; Rw[2].현금 = 300000; Rw[2].지급완료 = '2026-01-22';
    Rw[4].번들수수료 = 120000; Rw[4].정산금액 += 30000;
    Rw.push(mk({ 고객명: '서*늘', 가입서비스: '02-000-0001', 상품명: 'SKT_인터넷', 상품옵션: '기가라이트', 협력점: '■■예시네트웍스○', 정산종류: '추가', 약정금액: 50000 }));
    Rw.push(mk({ 고객명: '고*별', 가입서비스: 'z!60000000011', 상품명: 'KT_인터넷', 상품옵션: '슬림(100M)', 협력점: '■■예시네트웍스○', 약정금액: 420000, 사은품지급처: '웨이브넷 지급', 현금: 300000, 차감내역_사은품: 300000, 지급완료: '2026-01-20' }));
    Rw.push(mk({ 고객명: '임*솔', 가입서비스: '7400000031', 상품명: 'SKB_인터넷', 상품옵션: '광랜(100M)', 협력점: '★다른협력점●', 약정금액: 380000 }));
    Rw.splice(5, 1);
    var norm = function (arr) { return arr.map(function (r, i) { r.No = String(i + 1); return Engine.gridToRecords([Object.keys(r), Object.keys(r).map(function (k) { return r[k]; })])[0]; }); };
    clearResult();
    state.mode = 'demo';
    state.raw = norm(Rw); state.rawName = '예시 로우데이터';
    state.stmts = [{ name: '예시_가상텔레콤.xls', rows: norm(S.slice(0, 3)) }, { name: '예시_예시네트웍스.xls', rows: norm(S.slice(3)) }];
    go('check');
    runCheck();
    $('demoBanner').hidden = false;
  }
  $('demoBtn').addEventListener('click', loadDemo);
  $('demoClear').addEventListener('click', function () { resetInputs(); clearResult(); });

  boot();
})();
