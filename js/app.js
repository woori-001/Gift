(function () {
  'use strict';

  /* ═════════════ 공통 ═════════════ */
  var $ = function (id) { return document.getElementById(id); };
  var won = function (n) { return (n || 0).toLocaleString('ko-KR'); };
  var esc = function (t) { return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  function mask(n) { n = String(n || ''); if (n.indexOf('*') >= 0 || n.length < 2) return n; return n[0] + '*' + n.slice(2); }

  // 아이콘 (upche-meeting과 같은 선 아이콘)
  var IC = {
    shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/>',
    cal: '<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    key: '<circle cx="7.5" cy="15.5" r="4.5"/><path d="M10.7 12.3 21 2"/><path d="m16 7 3 3"/><path d="m19 4 2 2"/>',
    logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>',
    upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>',
    sheet: '<rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/>',
    file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>',
    export: '<path d="M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/>',
    search: '<circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',
    info: '<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>',
    x: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
    rotate: '<polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>',
    check: '<polyline points="20 6 9 17 4 12"/>',
    alert: '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
    minus: '<circle cx="12" cy="12" r="10"/><line x1="8" y1="12" x2="16" y2="12"/>',
    trend: '<polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/>',
    save: '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>',
    edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"/>',
    play: '<polygon points="6 4 20 12 6 20 6 4"/>'
  };
  var ic = function (k, s) { s = s || 16; return '<svg width="' + s + '" height="' + s + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + IC[k] + '</svg>'; };

  function toast(msg, ms) {
    var t = $('toast'); t.innerHTML = msg; t.hidden = false;
    clearTimeout(toast._t); if (ms !== 0) toast._t = setTimeout(function () { t.hidden = true; }, ms || 4000);
  }
  $('toast').addEventListener('click', function () { this.hidden = true; });
  function busy(on, msg) { $('busy').hidden = !on; if (msg) $('busyMsg').textContent = msg; }

  /* ═════════════ 상태 ═════════════ */
  var state = {
    user: null, view: 'check',
    raw: null, rawName: '', rawErr: '', stmts: [],
    res: null, mode: 'live',          // live | demo | saved
    savedRun: null, saved: false,     // saved: 지금 결과를 저장했는지
    tab: 'partners', q: '', partner: '', type: '', noSt: false, paidOnly: false, sort: null, limit: 300,
    histCount: null,
    work: null, works: [], sync: null   // 작업 중인 회차(이어하기)
  };

  /* ═════════════ 인증 ═════════════ */
  function showLogin(msg) {
    state.user = null;
    $('app').hidden = true; closeModal();
    $('login').hidden = false; $('loginErr').textContent = msg || '';
    setTimeout(function () { var i = $('loginId'); if (i && !i.value) i.focus(); else $('loginPw').focus(); }, 50);
  }
  function enterApp(user) {
    state.user = user;
    $('login').hidden = true; $('app').hidden = false;
    renderSide(); renderMain();
    refreshHistCount();
    refreshWorks().then(function (list) {
      var id = remembered();
      var hit = id && list.filter(function (w) { return w.id === id; })[0];
      if (hit && !state.raw && !state.stmts.length && !state.res) loadWork(hit.id);
      else if (state.view === 'check' && !state.res) renderUpload();
    });
  }
  function authFail(err) { if (err && err.auth) { showLogin(err.message); return true; } return false; }
  function fail(err) { if (!authFail(err)) toast(esc(err.message || String(err)), 6000); }

  $('loginForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var btn = $('loginBtn'); btn.disabled = true; $('loginErr').textContent = '';
    Api.login($('loginId').value.trim(), $('loginPw').value).then(function (r) {
      $('loginPw').value = '';
      if (r.mustChange) { state.user = r.user; $('login').hidden = true; openPwModal(true); }
      else enterApp(r.user);
    }).catch(function (err) { $('loginErr').textContent = err.message; })
      .then(function () { btn.disabled = false; });
  });

  function boot() {
    if (!Api.hasToken()) return showLogin();
    Api.me().then(function (u) {
      if (u.mustChange) { state.user = u; openPwModal(true); } else enterApp(u);
    }).catch(function (err) { showLogin(err.auth ? '' : err.message); });
  }

  /* ═════════════ 사이드바 ═════════════ */
  function refreshHistCount() {
    Api.runList(500).then(function (l) { state.histCount = l.length; renderSide(); }).catch(function () {});
  }
  function renderSide() {
    var u = state.user || { name: '', id: '' };
    var r = state.res, m = r && r.meta;
    var info = '';
    if (m) {
      var stLine = state.mode === 'demo' ? '<b class="st-warn">예시</b>' : state.mode === 'saved' ? '<b>저장 기록</b>' : state.saved ? '<b class="st-ok">저장됨</b>' : '<b class="st-warn">저장 전</b>';
      info = '<div class="side-info">' +
        '<div><span>정산예정일</span><b>' + esc(m.settleDate || '–') + '</b></div>' +
        '<div><span>로우데이터</span><b>' + won(m.rawRows) + '건</b></div>' +
        '<div><span>정산내역서</span><b>' + won(m.stmtFiles) + '개 · ' + won(m.stmtRows) + '건</b></div>' +
        '<div><span>상태</span>' + stLine + '</div>' +
        (state.mode === 'saved' && state.savedRun ? '<div class="note"><span class="nf">' + esc(state.savedRun.at) + ' · ' + esc(state.savedRun.by) + '</span></div>' : '') +
        '</div>';
    } else {
      info = '<div class="side-info">' +
        (state.work ? '<div><span>작업 회차</span><b>' + esc(state.work.settleDate) + '</b></div>' : '') +
        '<div><span>로우데이터</span><b>' + (state.raw ? won(state.raw.length) + '건' : '<span class="st-warn">없음</span>') + '</b></div>' +
        '<div><span>정산내역서</span><b>' + (okStmts().length ? okStmts().length + '개' : '<span class="st-warn">없음</span>') + '</b></div>' +
        '</div>';
    }
    $('side').innerHTML =
      '<div class="side-top"><div class="brand"><img src="img/wavenet.png" alt="WAVENET"></div></div>' +
      '<div class="side-mid">' +
        '<div class="spaces">' +
          '<button class="space' + (state.view === 'check' ? ' on' : '') + '" data-view="check"><span class="sico blue">' + ic('shield') + '</span><span class="stxt"><b>사은품 검수</b><small>정산서 ↔ 로우 대조</small></span></button>' +
          '<button class="space' + (state.view === 'history' ? ' on' : '') + '" data-view="history"><span class="sico dec">' + ic('cal') + '</span><span class="stxt"><b>검수 기록</b><small>저장한 결과 다시 보기</small></span>' + (state.histCount ? '<span class="snum">' + state.histCount + '</span>' : '') + '</button>' +
        '</div>' +
        '<hr class="side-hr">' + info +
        '<details class="side-help"><summary>' + ic('info', 14) + '판정 기준<span class="chev">▼</span></summary><div class="hl">' +
          helpItem('c-red', '미차감', '현재 로우가 웨이브넷 지급인데 정산서의 사은품 차감이 그보다 적은 건', '환수액 = 현재 지급액 − 정산서 차감') +
          helpItem('c-orange', '정산서 누락', '로우에는 있는데 올린 정산서 어디에도 없는 건') +
          helpItem('c-violet', '정산서에만', '정산서에는 있는데 지금 로우에서 사라진 건') +
          helpItem('c-blue', '금액 변동', '약정·번들·동판·다른 차감이 정산 후 바뀐 건') +
          helpItem('c-green', '확인 필요', '유치자지급인데 금액 입력, 웨이브넷 지급인데 차감 부족') +
          '<div class="hi"><i class="c-blue" style="opacity:.4"></i><div><b>매칭 기준</b><p>정산구분 + 가입서비스 + 상품명 + 상품옵션 + 개통일 + 고객명(*는 아무 글자). 협력점명은 기호·(휴)를 떼고 비교</p></div></div>' +
        '</div></details>' +
      '</div>' +
      '<div class="side-bottom"><div class="me"><span class="avatar">' + esc((u.name || u.id || '?').slice(0, 1)) + '</span>' +
        '<span class="me-n"><b>' + esc(u.name) + '</b><small>' + esc(u.id) + '</small></span>' +
        '<span class="me-a">' +
          (u.role === 'admin' ? '<button class="icon" id="bAcc" title="계정 관리">' + ic('users') + '</button>' : '') +
          '<button class="icon" id="bPw" title="비밀번호 변경">' + ic('key') + '</button>' +
          '<button class="icon out" id="bOut" title="로그아웃">' + ic('logout') + '</button>' +
        '</span></div></div>';
    [].forEach.call($('side').querySelectorAll('[data-view]'), function (b) {
      b.addEventListener('click', function () { state.view = b.dataset.view; renderSide(); renderMain(); window.scrollTo(0, 0); });
    });
    if ($('bAcc')) $('bAcc').addEventListener('click', openAccounts);
    $('bPw').addEventListener('click', function () { openPwModal(false); });
    $('bOut').addEventListener('click', function () { Api.logout().then(function () { state.work = null; state.raw = null; state.stmts = []; state.res = null; state.sync = null; showLogin(''); }); });
  }
  function helpItem(c, t, p, f) { return '<div class="hi"><i class="' + c + '"></i><div><b>' + t + '</b><p>' + p + '</p>' + (f ? '<p class="f">' + f + '</p>' : '') + '</div></div>'; }

  /* ═════════════ 본문 라우팅 ═════════════ */
  function renderMain() {
    if (state.view === 'history') return renderHistory();
    if (state.res && state.showResult !== false) return renderResult();
    renderUpload();
  }

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
  function okStmts() { return state.stmts.filter(function (s) { return !s.error; }); }

  /* ═════════════ 작업 이어하기 (올린 파일을 회차별로 서버에 자동 저장) ═════════════ */
  var WORK_KEY = 'gift_audit_work';
  var FIELDS = ['No', '정산종류', '고객명', '가입서비스', '상품명', '상품옵션', '협력점', '유치자', '접수일', '개통일', '개통상태',
    '정산예정일', '정산완료일', '지급예정', '지급완료', '사은품지급처', '사은품', '현금', '약정금액']
    .concat(Engine.DED.map(function (d) { return '차감내역_' + d; }), ['수납', '번들수수료', '동판수수료', '정산금액']);
  function remember(id) { try { if (id) localStorage.setItem(WORK_KEY, id); else localStorage.removeItem(WORK_KEY); } catch (e) {} }
  function remembered() { try { return localStorage.getItem(WORK_KEY); } catch (e) { return null; } }
  function topDate(rows) {
    var c = {}; rows.forEach(function (r) { if (r.정산예정일) c[r.정산예정일] = (c[r.정산예정일] || 0) + 1; });
    return Object.keys(c).sort(function (a, b) { return c[b] - c[a]; })[0] || '';
  }
  function hhmm() { var d = new Date(); return ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2); }
  // 서버에 올릴 형태: 필요한 칸만, 고객명은 가려서
  function packFile(kind, name, rows) {
    return {
      kind: kind, name: name, partner: rows[0] ? Engine.normPartner(rows[0].협력점) : '', settleDate: topDate(rows), cols: FIELDS,
      data: rows.map(function (r) { return FIELDS.map(function (f) { var v = r[f]; if (f === '고객명') v = mask(v); return v == null ? '' : v; }); })
    };
  }
  function unpackFile(f) { return Engine.gridToRecords([f.cols].concat(f.data || [])); }

  function refreshWorks() {
    return Api.workList().then(function (l) { state.works = l; return l; }).catch(function (err) { authFail(err); state.works = state.works || []; return state.works; });
  }
  function ensureWork(rows) {
    if (state.work) return Promise.resolve(state.work);
    var d = topDate(rows);
    if (!d) return Promise.reject(new Error('파일에 정산예정일이 없어서 회차를 정할 수 없어요.'));
    return Api.workOpen(d).then(function (w) { state.work = w; remember(w.id); return w; });
  }
  function setSync(s) { state.sync = s; renderSide(); if (state.view === 'check' && !(state.res && state.showResult !== false)) renderUpload(); }
  // kind: raw | stmt, items: [{name, rows}]
  function syncFiles(kind, items) {
    if (state.mode === 'demo' || !items.length) return;
    setSync({ status: 'saving' });
    var all = []; items.forEach(function (it) { all = all.concat(it.rows); });
    ensureWork(all).then(function (w) {
      var packs = items.map(function (it) { return packFile(kind, it.name, it.rows); });
      var other = packs.filter(function (p) { return p.settleDate && p.settleDate !== w.settleDate; });
      if (other.length) toast('다른 회차(' + esc(other[0].settleDate) + ') 파일이 섞였어요: ' + esc(other.map(function (p) { return p.name; }).slice(0, 3).join(', ')) + (other.length > 3 ? ' 외 ' + (other.length - 3) + '개' : '') + '. 지금 작업은 ' + esc(w.settleDate) + ' 회차예요.', 8000);
      // 한 번에 너무 크지 않게 나눠서 올림
      var batches = [], cur = [], size = 0;
      packs.forEach(function (p) {
        var s = JSON.stringify(p.data).length;
        if (cur.length && (size + s > 1200000 || cur.length >= 40)) { batches.push(cur); cur = []; size = 0; }
        cur.push(p); size += s;
      });
      if (cur.length) batches.push(cur);
      return batches.reduce(function (pr, b, i) {
        return pr.then(function () {
          if (batches.length > 1) setSync({ status: 'saving', msg: (i + 1) + '/' + batches.length });
          return Api.workPutFiles(w.id, b).then(function (r) { state.work = r.work; });
        });
      }, Promise.resolve());
    }).then(function () {
      setSync({ status: 'ok', at: hhmm() }); refreshWorks();
    }).catch(function (err) {
      if (authFail(err)) return;
      setSync({ status: 'err', msg: err.message, retry: function () { syncFiles(kind, items); } });
      toast('서버에 저장하지 못했어요: ' + esc(err.message) + '<br>지금 화면에서는 그대로 검수할 수 있지만, 다시 접속하면 이 파일은 빠져 있어요. [다시 저장]을 눌러주세요.', 10000);
    });
  }
  function loadWork(id) {
    busy(true, '작업을 불러오는 중...');
    return Api.workGet(id).then(function (d) {
      var raw = d.files.filter(function (f) { return f.kind === 'raw'; })[0];
      state.mode = 'live'; state.res = null; state.savedRun = null; state.showResult = false;
      state.work = d.work; remember(d.work.id);
      state.raw = raw ? unpackFile(raw) : null; state.rawName = raw ? raw.name : ''; state.rawErr = '';
      state.stmts = d.files.filter(function (f) { return f.kind === 'stmt'; }).map(function (f) { return { name: f.name, rows: unpackFile(f) }; });
      state.sync = { status: 'loaded', at: d.work.updatedAt, by: d.work.updatedBy };
      busy(false); state.view = 'check'; renderSide(); renderMain();
    }).catch(function (err) { busy(false); remember(null); fail(err); });
  }
  function startNewWork() {
    state.work = null; remember(null); state.raw = null; state.rawName = ''; state.rawErr = ''; state.stmts = []; state.sync = null;
    state.res = null; state.mode = 'live'; state.showResult = false;
    renderSide(); renderMain();
  }

  function leaveSpecialMode() {
    if (state.mode === 'demo') { state.raw = null; state.rawName = ''; state.stmts = []; }
    if (state.mode !== 'live') { state.res = null; state.mode = 'live'; state.savedRun = null; }
  }
  function onRawFiles(files) {
    if (!files.length) return;
    leaveSpecialMode();
    var f = files[0];
    busy(true, f.name + ' 읽는 중... (큰 파일은 몇 초 걸려요)');
    setTimeout(function () {
      readFile(f).then(function (rows) {
        state.raw = rows; state.rawName = f.name; state.rawErr = '';
        busy(false); state.showResult = false; renderSide(); renderMain();
        syncFiles('raw', [{ name: f.name, rows: rows }]);
      }).catch(function (err) {
        state.raw = null; state.rawName = f.name; state.rawErr = err.message;
        busy(false); state.showResult = false; renderSide(); renderMain();
      });
    }, 30);
  }
  function onStFiles(files) {
    if (!files.length) return;
    leaveSpecialMode();
    busy(true, '정산내역서 ' + files.length + '개 읽는 중...');
    setTimeout(function () {
      Promise.all(files.map(function (f) {
        return readFile(f).then(function (rows) { return { name: f.name, rows: rows }; }, function (err) { return { name: f.name, rows: [], error: err.message }; });
      })).then(function (list) {
        list.forEach(function (item) {
          state.stmts = state.stmts.filter(function (s) { return s.name !== item.name; });
          state.stmts.push(item);
        });
        busy(false); state.showResult = false; renderSide(); renderMain();
        syncFiles('stmt', list.filter(function (x) { return !x.error && x.rows.length; }));
      });
    }, 30);
  }
  $('fRaw').addEventListener('change', function () { onRawFiles([].slice.call(this.files)); this.value = ''; });
  $('fSt').addEventListener('change', function () { onStFiles([].slice.call(this.files)); this.value = ''; });
  function bindDrop(el, fn) {
    ['dragenter', 'dragover'].forEach(function (ev) { el.addEventListener(ev, function (e) { e.preventDefault(); el.classList.add('over'); }); });
    ['dragleave', 'drop'].forEach(function (ev) { el.addEventListener(ev, function (e) { e.preventDefault(); el.classList.remove('over'); }); });
    el.addEventListener('drop', function (e) { fn([].slice.call(e.dataTransfer.files)); });
  }
  // 두 번 눌러야 실행되는 버튼 (확인 창 대신)
  function armed(btn, label, fn) {
    btn.addEventListener('click', function () {
      if (!btn.classList.contains('armed')) {
        var orig = btn.innerHTML; btn.classList.add('armed'); btn.textContent = label;
        setTimeout(function () { if (btn.isConnected) { btn.classList.remove('armed'); btn.innerHTML = orig; } }, 4000);
        return;
      }
      fn();
    });
  }

  /* ═════════════ 파일 올리기 화면 ═════════════ */
  function syncLine() {
    var s = state.sync, w = state.work;
    if (state.mode === 'demo') return '';
    if (!w && !(s && s.status === 'saving')) return '<span class="sync">' + ic('save', 13) + '파일을 올리면 회차별로 서버에 자동 저장돼요</span>';
    var head = w ? '<span class="segb" style="margin:0">' + esc(w.settleDate) + ' 회차</span>' : '';
    if (!s) return head;
    if (s.status === 'saving') return head + '<span class="sync"><span class="spin sm"></span>서버에 저장 중' + (s.msg ? ' (' + esc(s.msg) + ')' : '') + '...</span>';
    if (s.status === 'ok') return head + '<span class="sync ok">' + ic('check', 13) + '자동 저장됨 ' + esc(s.at) + '</span>';
    if (s.status === 'loaded') return head + '<span class="sync ok">' + ic('check', 13) + '이어서 하는 중 · 마지막 저장 ' + esc(s.at) + ' ' + esc(s.by || '') + '</span>';
    return head + '<span class="sync err">' + ic('alert', 13) + '서버 저장 실패: ' + esc(s.msg) + ' <button class="linkb" id="bRetry">다시 저장</button></span>';
  }
  function worksPanel() {
    var list = (state.works || []).filter(function (w) { return !state.work || w.id !== state.work.id; });
    if (!list.length) return '';
    return '<div class="card works"><div class="card-h"><h2><span class="ib c4">' + ic('cal') + '</span>' + (state.work ? '다른 작업 중인 회차' : '이어서 할 회차') + '</h2></div>' +
      '<div class="wlist">' + list.map(function (w) {
        return '<button class="witem" data-work="' + esc(w.id) + '"><b>' + esc(w.settleDate) + ' 회차</b>' +
          '<span class="wmeta">로우 ' + (w.raw ? won(w.raw.rows) + '건' : '<em>없음</em>') + ' · 정산서 ' + won(w.stmtFiles) + '개(' + won(w.stmtRows) + '건)' + (w.runs ? ' · 결과 저장 ' + w.runs + '번' : '') + '</span>' +
          '<span class="wby">' + esc(w.updatedAt) + ' · ' + esc(w.updatedBy) + '</span><span class="wgo">이어서 하기 ›</span></button>';
      }).join('') + '</div></div>';
  }
  function renderUpload() {
    var hasRaw = !!state.raw, sts = okStmts(), errs = state.stmts.filter(function (s) { return s.error; });
    var stRows = sts.reduce(function (a, s) { return a + s.rows.length; }, 0);
    var rawSmall = state.rawErr ? '읽지 못했어요: ' + esc(state.rawErr)
      : hasRaw ? esc(state.rawName) + ' · ' + won(state.raw.length) + '건 · 정산예정일 ' + esc(summarizeDates(state.raw))
      : '전체정산관리 엑셀 1개 (정산예정일로 받은 파일). 끌어다 놓아도 돼요';
    var stSmall = sts.length ? won(sts.length) + '개 파일 · ' + won(stRows) + '건' + (errs.length ? ' · 읽지 못한 파일 ' + errs.length + '개' : '')
      : '같은 회차 협력점별 정산내역서 여러 개를 한 번에. 나눠서 올려도 계속 쌓여요';
    var chips = state.stmts.length ? '<div class="fchips">' +
      errs.map(function (s) { return '<span class="fchip err" title="' + esc(s.error) + '">' + esc(s.name) + '<button class="fx" data-rm="' + esc(s.name) + '" title="빼기">×</button></span>'; }).join('') +
      sts.map(function (s) { var p = s.rows[0] ? Engine.normPartner(s.rows[0].협력점) : '빈 파일'; return '<span class="fchip" title="' + esc(s.name) + '">' + esc(p) + ' ' + s.rows.length + '<button class="fx" data-rm="' + esc(s.name) + '" title="이 파일 빼기">×</button></span>'; }).join('') + '</div>' : '';
    var ready = hasRaw && sts.length;
    var hasFiles = state.raw || state.stmts.length;
    $('main').innerHTML =
      '<div class="top"><div><h1>사은품 차감 검수</h1><p class="sub">정산 당시 정산내역서와 현재 로우데이터를 건별로 대조해, 정산 후 지급됐는데 차감되지 않은 사은품을 찾아요.</p></div>' +
      '<div class="top-r">' +
        (state.res ? '<button class="ghost" id="bBack">' + ic('sheet') + '결과로 돌아가기</button>' : '') +
        (state.work ? '<button class="ghost" id="bNewWork">' + ic('rotate') + '새 회차 시작</button><button class="ghost del" id="bCloseWork">' + ic('check') + '검수 끝 · 초기화</button>' : '') +
      '</div></div>' +
      worksPanel() +
      '<div class="card upl">' +
        '<div class="steps"><i class="' + (hasRaw ? 'done' : 'on') + '"></i><i class="' + (sts.length ? 'done' : hasRaw ? 'on' : '') + '"></i><i class="' + (ready ? 'on' : '') + '"></i></div>' +
        '<h2>검수할 파일을 올려주세요</h2>' +
        '<p class="sub">올린 파일은 회차별로 서버에 자동 저장돼서, 나중에 들어와도 이어서 할 수 있어요. 고객명은 가려서 저장해요.</p>' +
        '<div class="syncrow" id="syncRow">' + syncLine() + '</div>' +
        '<ol class="stepl">' +
          '<li id="liRaw" class="' + (hasRaw ? 'done' : '') + (state.rawErr ? ' err' : '') + '"><span>' + (hasRaw ? ic('check', 13) : '1') + '</span><div><b>현재 로우데이터</b><small>' + rawSmall + '</small></div>' +
            '<button class="' + (hasRaw ? 'ghost' : 'primary') + '" id="bRaw">' + ic('upload') + (hasRaw ? '바꾸기' : '올리기') + '</button></li>' +
          '<li id="liSt" class="' + (sts.length ? 'done' : '') + '"><span>' + (sts.length ? ic('check', 13) : '2') + '</span><div><b>정산 당시 정산내역서</b><small>' + stSmall + '</small>' + chips + '</div>' +
            '<button class="' + (sts.length || !hasRaw ? 'ghost' : 'primary') + '" id="bSt">' + ic('upload') + (sts.length ? '더 넣기' : '올리기') + '</button></li>' +
        '</ol>' +
        '<div class="runrow"><span>' +
          (hasFiles ? '<button class="linkb" id="bClear">파일 모두 빼기</button> · ' : '') +
          '<button class="linkb" id="bDemo">예시 데이터로 둘러보기</button></span>' +
          '<button class="primary" id="bRun"' + (ready ? '' : ' disabled') + '>' + ic('play', 14) + '검수 실행</button></div>' +
      '</div>' +
      '</div>';
    $('bRaw').addEventListener('click', function () { $('fRaw').click(); });
    $('bSt').addEventListener('click', function () { $('fSt').click(); });
    bindDrop($('liRaw'), onRawFiles); bindDrop($('liSt'), onStFiles);
    $('bRun').addEventListener('click', runCheck);
    $('bDemo').addEventListener('click', function () { state.work = null; state.sync = null; loadDemo(); });
    if ($('bBack')) $('bBack').addEventListener('click', function () { state.showResult = true; renderMain(); });
    if ($('bRetry')) $('bRetry').addEventListener('click', function () { state.sync.retry(); });
    [].forEach.call($('main').querySelectorAll('[data-work]'), function (b) { b.addEventListener('click', function () { loadWork(b.dataset.work); }); });
    [].forEach.call($('main').querySelectorAll('[data-rm]'), function (b) {
      b.addEventListener('click', function (e) {
        e.stopPropagation();
        var name = b.dataset.rm;
        state.stmts = state.stmts.filter(function (s) { return s.name !== name; });
        renderSide(); renderUpload();
        if (state.work) Api.workRemoveFiles(state.work.id, 'stmt', [name]).then(function (r) { state.work = r.work; setSync({ status: 'ok', at: hhmm() }); refreshWorks(); }).catch(fail);
      });
    });
    if ($('bClear')) armed($('bClear'), '정말 모두 뺄까요? 한 번 더 누르세요', function () {
      var w = state.work;
      state.raw = null; state.rawName = ''; state.rawErr = ''; state.stmts = [];
      renderSide(); renderUpload();
      if (w) Api.workRemoveFiles(w.id, null, null).then(function (r) { state.work = r.work; setSync({ status: 'ok', at: hhmm() }); refreshWorks(); }).catch(fail);
    });
    if ($('bNewWork')) $('bNewWork').addEventListener('click', function () { startNewWork(); refreshWorks().then(function () { renderUpload(); }); });
    if ($('bCloseWork')) armed($('bCloseWork'), '올린 파일을 비울까요? 한 번 더', function () {
      var w = state.work;
      Api.workClose(w.id).then(function () {
        toast(esc(w.settleDate) + ' 회차를 초기화했어요. 서버에 올려둔 로우·정산서 내용을 비웠어요. 저장한 검수 결과는 [검수 기록]에 그대로 있어요.', 7000);
        startNewWork(); return refreshWorks();
      }).then(function () { renderUpload(); }).catch(fail);
    });
  }
  function summarizeDates(rows) {
    var c = {}; rows.forEach(function (r) { var d = r.정산예정일 || '없음'; c[d] = (c[d] || 0) + 1; });
    var ks = Object.keys(c).sort(function (a, b) { return c[b] - c[a]; });
    return ks.slice(0, 2).join(', ') + (ks.length > 2 ? ' 외 ' + (ks.length - 2) + '개' : '');
  }

  /* ═════════════ 검수 실행 ═════════════ */
  function runCheck() {
    busy(true, '대조하는 중...');
    setTimeout(function () {
      var stRows = [];
      okStmts().forEach(function (s) { s.rows.forEach(function (r) { r._file = s.name; stRows.push(r); }); });
      var raw = state.raw.map(function (r) { var o = {}; for (var k in r) o[k] = r[k]; return o; });
      var res = Engine.run(raw, stRows);
      var dates = {}; raw.forEach(function (r) { if (r.정산예정일) dates[r.정산예정일] = (dates[r.정산예정일] || 0) + 1; });
      res.meta = {
        settleDate: topDate(stRows) || Object.keys(dates).sort(function (a, b) { return dates[b] - dates[a]; })[0] || '',
        rawFile: state.rawName, stmtFiles: okStmts().length, rawRows: res.rawCount, stmtRows: res.stmtCount, matched: res.pairs.length,
        excluded: res.excluded
      };
      res.notes = buildNotes(raw, stRows, res);
      state.res = res; state.saved = false; state.showResult = true;
      resetView(); state.tab = res.undeducted.length ? 'und' : 'partners';
      busy(false); state.view = 'check'; renderSide(); renderMain(); window.scrollTo(0, 0);
    }, 30);
  }
  function resetView() { state.partner = ''; state.q = ''; state.type = ''; state.sort = null; state.limit = 300; state.noSt = false; state.paidOnly = false; }
  function buildNotes(raw, st, res) {
    var out = [], rd = {}, sd = {};
    raw.forEach(function (r) { rd[r.정산예정일] = 1; }); st.forEach(function (r) { sd[r.정산예정일] = 1; });
    var rk = Object.keys(rd), extra = Object.keys(sd).filter(function (d) { return !rd[d]; });
    var o = res.otherRound;
    if (o && o.count) {
      var od = Object.keys(o.dates).sort();
      out.push(['info', '로우데이터에 다른 회차 건이 섞여 있어요. 누락은 올린 정산서 회차(<b>' + esc(res.roundDates.join(', ')) + '</b>)에 해당하는 건만 봤고, 다른 회차 <b>' + won(o.count) + '건</b>은 뺐어요.' +
        '<span class="rnames">' + od.map(function (d) { return esc(d) + ' ' + won(o.dates[d]) + '건'; }).join(', ') + '</span>']);
    }
    if (Object.keys(sd).length > 1) out.push(['warn', '정산내역서에 정산예정일이 ' + Object.keys(sd).length + '개 섞여 있어요 (' + esc(Object.keys(sd).sort().join(', ')) + '). 다른 회차 파일이 섞였는지 확인하세요.']);
    if (extra.length) out.push(['warn', '정산내역서 회차(' + esc(extra.join(', ')) + ')가 로우데이터에 없어요. 로우데이터를 그 회차가 들어가게 받았는지 확인하세요.']);
    return out;
  }
  function noStNote() {
    var noSt = state.res.partners.filter(function (p) { return p.stmt === 0 && p.raw > 0; });
    if (!noSt.length) return null;
    var n = noSt.reduce(function (a, p) { return a + p.raw; }, 0);
    return ['info', '정산내역서가 없는 협력점 <b>' + noSt.length + '곳(' + won(n) + '건)</b>은 누락 목록에서 ' + (state.mode === 'saved' ? '저장하지 않았어요' : '기본으로 숨겼어요') + '. 정산서가 안 나간 곳인지, 파일을 덜 올린 건지 확인하세요.<span class="rnames">' +
      noSt.slice(0, 20).map(function (p) { return esc(p.key); }).join(', ') + (noSt.length > 20 ? ' 외 ' + (noSt.length - 20) + '곳' : '') + '</span>'];
  }

  /* ═════════════ 탭 정의 ═════════════ */
  var partnerHasSt = function (key) { var p = state.res.partners.find(function (x) { return x.key === key; }); return p && p.stmt > 0; };
  function R(x) { return x.raw || x.st; }
  function label(f) { return f.replace('차감내역_', '차감 '); }
  function typeTag(t) { return '<span class="badge t-' + esc(t) + '">' + esc(t) + '</span>'; }
  function svcCell(x) { return '<span class="mono">' + esc(x.raw.가입서비스) + '</span><span class="small">' + esc(x.raw.상품명 + ' · ' + x.raw.상품옵션) + '</span>'; }
  function baseFilter(x) {
    var r = R(x), q = state.q;
    if (state.partner && r._partner !== state.partner) return false;
    if (state.type && r.정산종류 !== state.type) return false;
    if (q && [r.고객명, mask(r.고객명), r.가입서비스, r.상품명, r.상품옵션, r.협력점].join(' ').indexOf(q) < 0) return false;
    return true;
  }
  var TABS = {
    partners: { label: '협력점 요약', desc: '협력점별 대조 결과예요. 행을 누르면 그 협력점만 골라서 봐요. 협력점명은 기호와 (휴)를 떼고 묶었어요.',
      rows: function () { return state.res.partners; },
      cols: [
        { h: '협력점', v: function (p) { return p.key; }, html: function (p) { return '<b>' + esc(p.key) + '</b><span class="small">' + esc(p.name) + '</span>'; } },
        { h: '정산서', num: true, v: function (p) { return p.stmt; }, html: function (p) { return p.stmt ? won(p.stmt) : '<span class="badge gray">정산서 없음</span>'; } },
        { h: '로우', num: true, v: function (p) { return p.raw; } },
        { h: '미차감', num: true, v: function (p) { return p.und; } },
        { h: '미차감 금액', num: true, v: function (p) { return p.undAmt; }, html: function (p) { return p.undAmt ? '<b class="up">' + won(p.undAmt) + '</b>' : '<span class="dim">0</span>'; } },
        { h: '누락', num: true, v: function (p) { return p.stmt ? p.miss : 0; }, html: function (p) { return p.stmt ? won(p.miss) + (p.missPaid ? '<span class="small">사은품 ' + p.missPaid + '</span>' : '') : '<span class="dim">–</span>'; } },
        { h: '정산서에만', num: true, v: function (p) { return p.only; } },
        { h: '금액 변동', num: true, v: function (p) { return p.chg; } }
      ],
      filter: function (p) { return (!state.q || p.key.indexOf(state.q) >= 0 || (p.name || '').indexOf(state.q) >= 0) && (!state.partner || p.key === state.partner); },
      rowClick: function (p) { state.partner = p.key; state.tab = p.und ? 'und' : (p.miss && p.stmt ? 'miss' : 'chg'); renderResultBody(); }
    },
    und: { label: '미차감', hot: true, desc: '현재 로우에서는 웨이브넷이 사은품을 지급했는데, 정산 당시 정산내역서에는 그만큼 차감되지 않은 건이에요. 미차감액이 다음 정산에서 환수할 금액이에요.',
      rows: function () { return state.res.undeducted; }, typed: true,
      cols: [
        { h: '협력점', v: function (x) { return x.raw._partner; }, html: function (x) { return '<b>' + esc(x.raw._partner) + '</b>'; } },
        { h: '구분', v: function (x) { return x.raw.정산종류; }, html: function (x) { return typeTag(x.raw.정산종류); } },
        { h: '고객명', v: function (x) { return x.raw.고객명; } },
        { h: '가입서비스 / 상품', v: function (x) { return x.raw.가입서비스; }, html: svcCell },
        { h: '미차감액', num: true, v: function (x) { return x.gap; }, cls: 'amt' },
        { h: '현재 지급액', num: true, v: function (x) { return x.paid; } },
        { h: '정산서 차감', num: true, v: function (x) { return x.stDed; } },
        { h: '정산서 → 현재 지급처', v: function (x) { return (x.st.사은품지급처 || '미입력') + ' → ' + x.raw.사은품지급처; }, html: function (x) { return '<span class="dim">' + esc(x.st.사은품지급처 || '미입력') + '</span><span class="arrow">→</span>' + esc(x.raw.사은품지급처); } },
        { h: '개통일', v: function (x) { return x.raw.개통일; }, cls: 'mono' },
        { h: '지급완료일', v: function (x) { return x.raw.지급완료; }, cls: 'mono' },
        { h: '사유', v: function (x) { return x.reason + (x.note ? ' / ' + x.note : ''); }, cls: 'wrap' }
      ],
      filter: baseFilter
    },
    miss: { label: '정산서 누락', desc: '현재 로우에는 있는데 올린 정산내역서 어디에도 없는 건이에요. 사은품 지급이 있는 일반 건은 차감 없이 넘어갔을 가능성이 커요.',
      rows: function () { return state.res.missing; }, typed: true, noSt: true, paid: true,
      cols: [
        { h: '협력점', v: function (x) { return x.raw._partner; }, html: function (x) { return '<b>' + esc(x.raw._partner) + '</b>' + (partnerHasSt(x.raw._partner) ? '' : '<span class="small">정산서 없음</span>'); } },
        { h: '구분', v: function (x) { return x.raw.정산종류; }, html: function (x) { return typeTag(x.raw.정산종류); } },
        { h: '고객명', v: function (x) { return x.raw.고객명; } },
        { h: '가입서비스 / 상품', v: function (x) { return x.raw.가입서비스; }, html: svcCell },
        { h: '개통일', v: function (x) { return x.raw.개통일; }, cls: 'mono' },
        { h: '개통상태', v: function (x) { return x.raw.개통상태; } },
        { h: '정산금액', num: true, v: function (x) { return x.raw.정산금액; } },
        { h: '지급처', v: function (x) { return x.raw.사은품지급처; } },
        { h: '지급액', num: true, v: function (x) { return x.paid; } },
        { h: '사은품 차감', num: true, v: function (x) { return x.raw.차감내역_사은품; } },
        { h: '', v: function (x) { return x.paid > 0 && x.raw.정산종류 === '일반' ? 1 : 0; }, html: function (x) { return x.paid > 0 && x.raw.정산종류 === '일반' ? '<span class="badge orange">사은품 지급</span>' : ''; } }
      ],
      filter: function (x) { return baseFilter(x) && (state.noSt || partnerHasSt(x.raw._partner) || state.partner) && (!state.paidOnly || x.paid > 0); }
    },
    only: { label: '정산서에만', desc: '정산내역서에는 있는데 현재 로우에서 찾지 못한 건이에요. 접수가 삭제·취소됐거나 가입서비스·상품명이 바뀌었을 수 있어요.',
      rows: function () { return state.res.stmtOnly; }, typed: true,
      cols: [
        { h: '협력점', v: function (x) { return x.st._partner; }, html: function (x) { return '<b>' + esc(x.st._partner) + '</b>'; } },
        { h: '구분', v: function (x) { return x.st.정산종류; }, html: function (x) { return typeTag(x.st.정산종류); } },
        { h: '고객명', v: function (x) { return mask(x.st.고객명); } },
        { h: '가입서비스 / 상품', v: function (x) { return x.st.가입서비스; }, html: function (x) { return '<span class="mono">' + esc(x.st.가입서비스) + '</span><span class="small">' + esc(x.st.상품명 + ' · ' + x.st.상품옵션) + '</span>'; } },
        { h: '개통일', v: function (x) { return x.st.개통일; }, cls: 'mono' },
        { h: '정산금액', num: true, v: function (x) { return x.st.정산금액; } },
        { h: '사은품 차감', num: true, v: function (x) { return x.st.차감내역_사은품; } },
        { h: '파일', v: function (x) { return x.st._file; } }
      ],
      filter: baseFilter
    },
    chg: { label: '금액 변동', desc: '정산 이후 사은품 외 금액이 바뀐 건이에요. 정산서보다 사은품이 더 많이 차감됐던 건(과차감)도 여기 나와요. 정산금액 차이는 현재 − 정산서예요.',
      rows: function () { return state.res.changed; }, typed: true,
      cols: [
        { h: '협력점', v: function (x) { return x.raw._partner; }, html: function (x) { return '<b>' + esc(x.raw._partner) + '</b>'; } },
        { h: '구분', v: function (x) { return x.raw.정산종류; }, html: function (x) { return typeTag(x.raw.정산종류); } },
        { h: '고객명', v: function (x) { return x.raw.고객명; } },
        { h: '가입서비스 / 상품', v: function (x) { return x.raw.가입서비스; }, html: svcCell },
        { h: '개통일', v: function (x) { return x.raw.개통일; }, cls: 'mono' },
        { h: '바뀐 항목 (정산서 → 현재)', v: function (x) { return x.diffs.map(function (d) { return label(d.f) + ' ' + won(d.a) + ' → ' + won(d.b) + (d.over ? ' (과차감)' : ''); }).join(', '); },
          html: function (x) { return x.diffs.map(function (d) { return '<div>' + esc(label(d.f)) + ' <span class="mono">' + won(d.a) + '</span><span class="arrow">→</span><b class="mono">' + won(d.b) + '</b>' + (d.over ? ' <span class="badge orange">과차감</span>' : '') + '</div>'; }).join('') || '<span class="dim">금액 변동 없음</span>'; } },
        { h: '정산금액 차이', num: true, v: function (x) { return x.delta; }, html: function (x) { return '<span class="chip ' + (x.delta > 0 ? 'up' : x.delta < 0 ? 'down' : '') + '">' + (x.delta > 0 ? '+' : '') + won(x.delta) + '</span>'; } },
        { h: '비고', v: function (x) { return x.note; } }
      ],
      filter: baseFilter
    },
    chk: { label: '확인 필요', desc: '정산서와 상관없이 현재 로우 자체에서 이상해 보이는 건이에요. 지급처와 금액이 맞지 않거나, 웨이브넷이 지급했는데 차감이 부족한 건이에요.',
      rows: function () { return state.res.checks; }, typed: true,
      cols: [
        { h: '협력점', v: function (x) { return x.raw._partner; }, html: function (x) { return '<b>' + esc(x.raw._partner) + '</b>'; } },
        { h: '구분', v: function (x) { return x.raw.정산종류; }, html: function (x) { return typeTag(x.raw.정산종류); } },
        { h: '고객명', v: function (x) { return x.raw.고객명; } },
        { h: '가입서비스 / 상품', v: function (x) { return x.raw.가입서비스; }, html: svcCell },
        { h: '개통일', v: function (x) { return x.raw.개통일; }, cls: 'mono' },
        { h: '정산금액', num: true, v: function (x) { return x.raw.정산금액; } },
        { h: '내용', v: function (x) { return x.why; }, cls: 'wrap' }
      ],
      filter: baseFilter
    }
  };
  var ORDER = ['partners', 'und', 'miss', 'only', 'chg', 'chk'];

  /* ═════════════ 결과 화면 ═════════════ */
  function renderResult() {
    var r = state.res, m = r.meta;
    var title = state.mode === 'saved' ? '저장된 검수 결과' : state.mode === 'demo' ? '검수 결과 (예시)' : '검수 결과';
    var canSave = state.mode === 'live' && !state.saved;
    $('main').innerHTML =
      '<div class="top"><div><h1>' + title + '<span class="segb">' + esc(m.settleDate || '정산예정일 없음') + ' 회차</span></h1>' +
        '<p class="sub">' + esc(m.rawFile || '') + ' · 정산내역서 ' + won(m.stmtFiles) + '개(' + won(m.stmtRows) + '건) · 매칭 ' + won(m.matched) + '건</p></div>' +
        '<div class="top-r">' +
          '<button class="ghost" id="bNew">' + ic('upload') + (state.mode === 'live' ? '파일 바꾸기' : '새 검수') + '</button>' +
          '<button class="ghost" id="bExport">' + ic('export') + '엑셀 받기</button>' +
          (state.mode === 'live' ? '<button class="primary" id="bSave"' + (canSave ? '' : ' disabled') + '>' + ic(state.saved ? 'check' : 'save') + (state.saved ? '저장됨' : '결과 저장') + '</button>' : '') +
        '</div></div>' +
      '<div class="rlay"><div class="rmain">' +
      '<div class="kpis k5" id="kpis"></div>' +
      '<div class="card">' +
        '<div class="tabs" id="tabs"></div>' +
        '<div class="frow">' +
          '<label class="field">' + ic('search', 15) + '<input type="search" id="q" placeholder="고객명·가입서비스·상품 검색" aria-label="검색"></label>' +
          '<label class="field"><select id="partnerSel" aria-label="협력점"></select></label>' +
          '<div class="pills" id="typePills"><button data-v="" class="on">전체</button><button data-v="일반">일반</button><button data-v="추가">추가</button><button data-v="환수">환수</button></div>' +
          '<label class="chk" id="noStWrap"><input type="checkbox" id="noSt"> 정산서 없는 협력점 포함</label>' +
          '<label class="chk" id="paidWrap"><input type="checkbox" id="paidOnly"> 사은품 지급 건만</label>' +
        '</div>' +
        '<p class="desc" id="tabDesc"></p>' +
        '<div class="tw"><table class="t" id="tbl"><thead></thead><tbody></tbody></table></div>' +
        '<div class="more" id="more" hidden></div>' +
      '</div>' +
      '</div><aside class="rail" id="rail"></aside></div>';
    $('bNew').addEventListener('click', function () {
      if (state.mode !== 'live') { state.res = null; state.mode = 'live'; state.savedRun = null; if (state.rawName === '예시 로우데이터') { state.raw = null; state.stmts = []; } }
      state.showResult = false; renderSide(); renderUpload();
    });
    $('bExport').addEventListener('click', exportXlsx);
    if ($('bSave')) $('bSave').addEventListener('click', openSaveModal);
    $('q').value = state.q;
    $('q').addEventListener('input', function () { state.q = this.value.trim(); state.limit = 300; renderTabs(); renderTable(); });
    fillPartnerSel();
    $('partnerSel').addEventListener('change', function () { state.partner = this.value; state.limit = 300; renderTabs(); renderTable(); });
    [].forEach.call($('typePills').querySelectorAll('button'), function (b) {
      b.addEventListener('click', function () { state.type = b.dataset.v; renderTabs(); renderTable(); });
    });
    $('noSt').addEventListener('change', function () { state.noSt = this.checked; renderTabs(); renderTable(); });
    $('paidOnly').addEventListener('change', function () { state.paidOnly = this.checked; renderTabs(); renderTable(); });
    renderNotes();
    renderResultBody();
  }
  function renderResultBody() { renderKpis(); renderTabs(); renderTable(); }

  function renderNotes() {
    var r = state.res, m = r.meta, out = (r.notes || []).slice(), n = noStNote(); if (n) out.push(n);
    var ex = m.excluded;
    if (ex && (ex.raw || ex.stmt)) out.push(['own', '자점 <b>' + ex.partners.length + '곳</b>(로우 ' + won(ex.raw) + '건' + (ex.stmt ? ' · 정산서 ' + won(ex.stmt) + '건' : '') + ')은 검수에서 뺐어요.' +
      '<span class="rnames">' + ex.partners.map(esc).join(', ') + '</span>']);
    var html = '';
    if (state.mode === 'demo') html += '<div class="rcard rdemo"><div class="rh">' + ic('info') + '<b>예시 데이터</b></div><p>가상의 예시예요. 저장되지 않아요.</p><button class="linkb" id="bDemoClear">예시 지우기</button></div>';
    if (state.mode === 'saved') {
      var run = state.savedRun;
      html += '<div class="rcard rsaved" id="savedNote"><div class="rh">' + ic('cal') + '<b>저장된 기록</b></div>' +
        '<p>' + esc(run.at) + ' · ' + esc(run.by) + '</p>' + (run.memo ? '<p class="rmemo">' + esc(run.memo) + '</p>' : '') +
        '<button class="linkb" id="bMemo">' + (run.memo ? '메모 고치기' : '메모 남기기') + '</button></div>';
    }
    html += '<div class="rcard"><div class="rh">' + ic('sheet') + '<b>회차 정보</b></div><dl class="rinfo">' +
      '<dt>정산예정일</dt><dd>' + esc(m.settleDate || '–') + '</dd>' +
      '<dt>로우데이터</dt><dd>' + won(m.rawRows) + '건' + (m.rawFile ? '<small>' + esc(m.rawFile) + '</small>' : '') + '</dd>' +
      '<dt>정산내역서</dt><dd>' + won(m.stmtFiles) + '개 · ' + won(m.stmtRows) + '건</dd>' +
      '<dt>매칭</dt><dd>' + won(m.matched) + '건</dd>' +
      (ex && ex.raw ? '<dt>자점 제외</dt><dd>' + won(ex.raw) + '건</dd>' : '') +
      '</dl></div>';
    html += '<div class="rcard"><div class="rh">' + ic('alert') + '<b>확인할 점</b>' + (out.length ? '<span class="snum">' + out.length + '</span>' : '') + '</div>' +
      (out.length ? '<div class="rnotes">' + out.map(function (x) {
        return '<div class="rnote ' + x[0] + '">' + ic(x[0] === 'warn' ? 'alert' : x[0] === 'own' ? 'minus' : 'info', 15) + '<div>' + x[1] + '</div></div>';
      }).join('') + '</div>' : '<p class="rnone">' + ic('check', 14) + '특별히 확인할 점이 없어요.</p>') + '</div>';
    $('rail').innerHTML = html;
    if ($('bDemoClear')) $('bDemoClear').addEventListener('click', function () { state.res = null; state.mode = 'live'; state.raw = null; state.stmts = []; state.rawName = ''; renderSide(); renderMain(); });
    if ($('bMemo')) $('bMemo').addEventListener('click', editSavedMemo);
  }
  function editSavedMemo() {
    var run = state.savedRun, box = $('savedNote');
    box.innerHTML = '<div class="rh">' + ic('edit') + '<b>메모</b></div><textarea class="memo-in" id="memoIn" rows="3" maxlength="1000" placeholder="메모"></textarea>' +
      '<div class="mfoot" style="margin-top:8px"><button class="ghost sm" id="memoNo">취소</button><button class="primary sm" id="memoOk">저장</button></div>';
    $('memoIn').value = run.memo || ''; $('memoIn').focus();
    $('memoNo').addEventListener('click', renderNotes);
    $('memoOk').addEventListener('click', function () {
      var memo = $('memoIn').value.trim();
      Api.runMemo(run.id, memo).then(function () { run.memo = memo; renderNotes(); toast('메모를 저장했어요.'); }).catch(fail);
    });
  }

  function renderKpis() {
    var r = state.res;
    var undAmt = r.undeducted.reduce(function (a, x) { return a + x.gap; }, 0);
    var missVis = r.missing.filter(function (x) { return partnerHasSt(x.raw._partner); });
    var missPaid = missVis.filter(function (x) { return x.paid > 0 && x.raw.정산종류 === '일반'; }).length;
    var k = function (tab, c, icon, label, val, cls, sub) {
      return '<button class="kpi btn' + (state.tab === tab ? ' on' : '') + '" data-tab="' + tab + '"><div class="kt"><span class="ib ' + c + '">' + ic(icon) + '</span><span class="kl">' + label + '</span></div>' +
        '<div class="kv ' + (cls || '') + '">' + val + '<small>건</small></div><div class="ks">' + sub + '</div></button>';
    };
    $('kpis').innerHTML =
      k('und', 'c3', 'alert', '① 미차감', won(r.undeducted.length), r.undeducted.length ? 'bad' : '', '환수 대상 <strong>' + won(undAmt) + '원</strong>') +
      k('miss', 'c5', 'file', '② 정산서 누락', won(missVis.length), missPaid ? 'warn' : '', '사은품 지급 일반건 ' + won(missPaid) + '건') +
      k('only', 'c4', 'minus', '③ 정산서에만', won(r.stmtOnly.length), '', '정산서 ' + won(r.meta.stmtRows) + '건 중') +
      k('chg', 'c1', 'trend', '④ 금액 변동', won(r.changed.length), '', '매칭 ' + won(r.meta.matched) + '건 중') +
      k('chk', 'c2', 'info', '⑤ 확인 필요', won(r.checks.length), '', '로우 ' + won(r.meta.rawRows) + '건 기준');
    [].forEach.call($('kpis').querySelectorAll('.kpi'), function (b) {
      b.addEventListener('click', function () { state.tab = b.dataset.tab; state.sort = null; state.limit = 300; renderResultBody(); });
    });
  }
  function fillPartnerSel() {
    $('partnerSel').innerHTML = '<option value="">전체 협력점</option>' + state.res.partners.slice().sort(function (a, b) { return a.key.localeCompare(b.key); })
      .map(function (p) { return '<option value="' + esc(p.key) + '">' + esc(p.key) + (p.stmt === 0 ? ' (정산서 없음)' : '') + '</option>'; }).join('');
    $('partnerSel').value = state.partner;
  }
  function renderTabs() {
    $('tabs').innerHTML = ORDER.map(function (k) {
      var t = TABS[k], n = t.rows().filter(t.filter).length;
      return '<button class="' + (state.tab === k ? 'on' : '') + (t.hot && n ? ' hot' : '') + '" data-k="' + k + '">' + t.label + '<span class="n">' + n.toLocaleString() + '</span></button>';
    }).join('');
    [].forEach.call($('tabs').querySelectorAll('button'), function (b) {
      b.addEventListener('click', function () { state.tab = b.dataset.k; state.sort = null; state.limit = 300; renderResultBody(); });
    });
    var t = TABS[state.tab];
    $('tabDesc').textContent = t.desc;
    $('typePills').hidden = !t.typed;
    [].forEach.call($('typePills').querySelectorAll('button'), function (b) { b.classList.toggle('on', b.dataset.v === state.type); });
    $('noStWrap').hidden = !t.noSt || state.mode === 'saved';
    $('paidWrap').hidden = !t.paid;
    $('noSt').checked = state.noSt; $('paidOnly').checked = state.paidOnly;
    $('partnerSel').value = state.partner;
  }
  function renderTable() {
    var t = TABS[state.tab];
    var rows = t.rows().filter(t.filter);
    if (state.sort) {
      var c = t.cols[state.sort.i], dir = state.sort.dir;
      rows = rows.slice().sort(function (a, b) { var x = c.v(a), y = c.v(b); return (typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y))) * dir; });
    }
    $('tbl').tHead.innerHTML = '<tr>' + t.cols.map(function (c, i) {
      var on = state.sort && state.sort.i === i;
      return '<th class="sortable' + (on ? ' on' : '') + (c.num ? ' n' : '') + '" data-sort="' + i + '">' + esc(c.h) + (on ? (state.sort.dir > 0 ? ' ↑' : ' ↓') : '') + '</th>';
    }).join('') + '</tr>';
    [].forEach.call($('tbl').tHead.querySelectorAll('th'), function (th) {
      th.addEventListener('click', function () {
        var i = +th.dataset.sort; state.sort = state.sort && state.sort.i === i ? { i: i, dir: -state.sort.dir } : { i: i, dir: t.cols[i].num ? -1 : 1 }; renderTable();
      });
    });
    if (!rows.length) {
      $('tbl').tBodies[0].innerHTML = '<tr><td colspan="' + t.cols.length + '" class="none">' + (state.tab === 'und' ? '미차감 건이 없어요. 정산 후 지급된 사은품이 모두 차감돼 있어요.' : '해당하는 건이 없어요.') + '</td></tr>';
      $('more').hidden = true; return;
    }
    var shown = rows.slice(0, state.limit);
    $('tbl').tBodies[0].innerHTML = shown.map(function (x, idx) {
      return '<tr' + (t.rowClick ? ' class="click" data-i="' + idx + '"' : '') + '>' + t.cols.map(function (c) {
        var inner = c.html ? c.html(x) : (c.num ? won(c.v(x)) : esc(c.v(x)));
        return '<td class="' + (c.num ? 'n ' : '') + (c.cls || '') + '">' + inner + '</td>';
      }).join('') + '</tr>';
    }).join('');
    if (t.rowClick) [].forEach.call($('tbl').tBodies[0].querySelectorAll('tr.click'), function (tr) { tr.addEventListener('click', function () { t.rowClick(shown[+tr.dataset.i]); }); });
    var m = $('more');
    if (rows.length > state.limit) {
      m.hidden = false; m.innerHTML = won(rows.length) + '건 중 ' + won(state.limit) + '건 표시 · <button class="linkb" id="moreBtn">더 보기</button> (엑셀로 받으면 전체가 들어가요)';
      $('moreBtn').addEventListener('click', function () { state.limit += 500; renderTable(); });
    } else m.hidden = true;
  }

  /* ═════════════ 결과 저장 ═════════════ */
  var KEEP = ['정산종류', '고객명', '가입서비스', '상품명', '상품옵션', '협력점', '_partner', '개통일', '개통상태', '접수일', '유치자',
    '사은품지급처', '현금', '차감내역_사은품', '약정금액', '정산금액', '지급완료', '정산예정일', '정산완료일', '_file'];
  function pick(r) {
    if (!r) return null;
    var o = {}; KEEP.forEach(function (k) { if (r[k] !== undefined && r[k] !== '') o[k] = r[k]; });
    if (o.고객명) o.고객명 = mask(o.고객명);   // 정산서의 실명은 저장하지 않음
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
    return {
      run: {
        settleDate: m.settleDate, rawFile: m.rawFile, stmtFiles: m.stmtFiles, rawRows: m.rawRows, stmtRows: m.stmtRows, matched: m.matched,
        undCount: r.undeducted.length, undAmount: r.undeducted.reduce(function (a, x) { return a + x.gap; }, 0),
        missCount: missSaved.length, missPaid: missSaved.filter(function (x) { return x.paid > 0 && x.raw.정산종류 === '일반'; }).length,
        onlyCount: r.stmtOnly.length, chgCount: r.changed.length, chkCount: r.checks.length,
        partners: r.partners.map(function (p) { return { key: p.key, name: p.name, raw: p.raw, stmt: p.stmt, und: p.und, undAmt: p.undAmt, miss: p.miss, missPaid: p.missPaid, only: p.only, chg: p.chg }; }),
        memo: memo || ''
      },
      findings: f
    };
  }
  function openSaveModal() {
    var r = state.res, undAmt = r.undeducted.reduce(function (a, x) { return a + x.gap; }, 0);
    openModal('<div class="mbox"><button class="icon mx" data-close title="닫기">' + ic('x', 18) + '</button><h3>검수 결과 저장</h3>' +
      '<p class="msub">' + esc(r.meta.settleDate || '') + ' 회차 · 미차감 ' + won(r.undeducted.length) + '건(' + won(undAmt) + '원). 고객명은 가린 상태로 저장돼요.</p>' +
      '<form class="mform" id="saveForm"><label>메모 <textarea id="saveMemo" rows="3" maxlength="1000" placeholder="예: 10/2 정산분 1차 검수, 협력점 3곳 환수 요청"></textarea></label>' +
      '<p class="merr" id="saveErr"></p><div class="mfoot"><button type="button" class="ghost" data-close>취소</button><button class="primary" type="submit" id="saveOk">' + ic('save') + '저장</button></div></form></div>');
    $('saveMemo').focus();
    $('saveForm').addEventListener('submit', function (e) {
      e.preventDefault();
      var p = buildPayload($('saveMemo').value.trim());
      $('saveOk').disabled = true; busy(true, '저장하는 중... (' + won(p.findings.length) + '건)');
      Api.runSave(p.run, p.findings).then(function (res) {
        busy(false); closeModal(); state.saved = true; state.histCount = (state.histCount || 0) + 1;
        renderSide(); renderResult(); toast('저장했어요 · 결과 ' + won(res.findings) + '건. <a id="toHist">검수 기록에서 보기</a>');
        var a = $('toHist'); if (a) a.addEventListener('click', function () { state.view = 'history'; renderSide(); renderMain(); });
      }).catch(function (err) {
        busy(false); $('saveOk').disabled = false;
        if (!authFail(err)) $('saveErr').textContent = '저장하지 못했어요: ' + err.message;
      });
    });
  }

  /* ═════════════ 검수 기록 ═════════════ */
  function renderHistory() {
    $('main').innerHTML =
      '<div class="top"><div><h1>검수 기록</h1><p class="sub">저장한 검수 결과예요. 행을 누르면 그때 결과를 다시 볼 수 있어요.</p></div>' +
      '<div class="top-r"><button class="ghost" id="hReload">' + ic('rotate') + '새로고침</button></div></div>' +
      '<div class="card hist"><div class="tw" style="max-height:none"><table class="t"><thead><tr>' +
      '<th>정산예정일</th><th>검수 일시</th><th>실행자</th><th class="n">미차감</th><th class="n">미차감 금액</th><th class="n">누락</th><th class="n">정산서에만</th><th class="n">금액 변동</th><th>정산서 / 로우</th><th>메모</th><th></th>' +
      '</tr></thead><tbody id="histBody"><tr><td colspan="11" class="none">불러오는 중...</td></tr></tbody></table></div></div>';
    $('hReload').addEventListener('click', renderHistory);
    Api.runList(200).then(function (list) {
      state.histCount = list.length; renderSide();
      var tb = $('histBody'); if (!tb) return;
      if (!list.length) { tb.innerHTML = '<tr><td colspan="11" class="none">아직 저장한 검수 결과가 없어요. 검수를 실행한 뒤 [결과 저장]을 누르면 여기 쌓여요.</td></tr>'; return; }
      var admin = state.user && state.user.role === 'admin';
      tb.innerHTML = list.map(function (r, i) {
        return '<tr class="click" data-i="' + i + '">' +
          '<td><b class="mono">' + esc(r.settleDate || '–') + '</b></td>' +
          '<td class="mono">' + esc(r.at) + '</td>' +
          '<td>' + esc(r.by) + '</td>' +
          '<td class="n">' + (r.undCount ? '<span class="badge red">' + won(r.undCount) + '</span>' : '<span class="dim">0</span>') + '</td>' +
          '<td class="n">' + (r.undAmount ? '<b class="up">' + won(r.undAmount) + '</b>' : '<span class="dim">0</span>') + '</td>' +
          '<td class="n">' + won(r.missCount) + (r.missPaid ? '<span class="small">사은품 ' + r.missPaid + '</span>' : '') + '</td>' +
          '<td class="n">' + won(r.onlyCount) + '</td>' +
          '<td class="n">' + won(r.chgCount) + '</td>' +
          '<td>' + won(r.stmtFiles) + '개 · ' + won(r.stmtRows) + '건 / ' + won(r.rawRows) + '건<span class="small">' + esc(r.rawFile) + '</span></td>' +
          '<td class="wrap">' + esc(r.memo) + '</td>' +
          '<td><div class="rowact">' + (admin ? '<button class="ghost sm" data-hide="' + i + '">숨기기</button>' : '') + '</div></td></tr>';
      }).join('');
      [].forEach.call(tb.querySelectorAll('tr.click'), function (tr) {
        tr.addEventListener('click', function (e) { if (e.target.closest('[data-hide]')) return; openSaved(list[+tr.dataset.i].id); });
      });
      [].forEach.call(tb.querySelectorAll('[data-hide]'), function (b) {
        b.addEventListener('click', function () {
          if (!b.classList.contains('armed')) { b.classList.add('armed'); b.textContent = '정말 숨길까요?'; setTimeout(function () { b.classList.remove('armed'); b.textContent = '숨기기'; }, 4000); return; }
          Api.runHide(list[+b.dataset.hide].id).then(function () { toast('기록을 숨겼어요.'); renderHistory(); }).catch(fail);
        });
      });
    }).catch(function (err) {
      if (authFail(err)) return;
      var tb = $('histBody'); if (tb) tb.innerHTML = '<tr><td colspan="11" class="none up">' + esc(err.message) + '</td></tr>';
    });
  }
  function openSaved(id) {
    busy(true, '불러오는 중...');
    Api.runGet(id).then(function (data) {
      busy(false);
      var run = data.run, by = { und: [], miss: [], only: [], chg: [], chk: [] };
      (data.findings || []).forEach(function (f) { if (by[f.kind]) by[f.kind].push(f.detail || {}); });
      state.mode = 'saved'; state.savedRun = run; state.saved = true; state.showResult = true;
      state.res = {
        undeducted: by.und, missing: by.miss, stmtOnly: by.only,
        changed: by.chg.map(function (d) { d.diffs = d.diffs || []; return d; }),
        checks: by.chk, partners: run.partners || [], notes: [],
        meta: { settleDate: run.settleDate || '', rawFile: run.rawFile, stmtFiles: run.stmtFiles, rawRows: run.rawRows, stmtRows: run.stmtRows, matched: run.matched }
      };
      resetView(); state.tab = state.res.undeducted.length ? 'und' : 'partners';
      state.view = 'check'; renderSide(); renderMain(); window.scrollTo(0, 0);
    }).catch(function (e) { busy(false); fail(e); });
  }

  /* ═════════════ 모달 ═════════════ */
  function openModal(html) {
    var m = $('modal'); m.innerHTML = html; m.hidden = false;
    [].forEach.call(m.querySelectorAll('[data-close]'), function (b) { b.addEventListener('click', closeModal); });
  }
  function closeModal() { var m = $('modal'); if (m.dataset.lock) return; m.hidden = true; m.innerHTML = ''; }
  $('modal').addEventListener('mousedown', function (e) { if (e.target === this) closeModal(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeModal(); });

  // 비밀번호 변경 (first=true: 첫 로그인이라 닫을 수 없음)
  function openPwModal(first) {
    var m = $('modal');
    if (first) m.dataset.lock = '1'; else delete m.dataset.lock;
    openModal('<div class="mbox">' + (first ? '' : '<button class="icon mx" data-close title="닫기">' + ic('x', 18) + '</button>') +
      '<h3>' + (first ? '새 비밀번호를 정해주세요' : '비밀번호 변경') + '</h3>' +
      '<p class="msub">' + (first ? '임시 비밀번호로 로그인했어요. 계속하려면 새 비밀번호(6자 이상)를 정해주세요.' : '바꾸면 다른 곳에 로그인된 세션은 끊어져요.') + '</p>' +
      '<form class="pwf" id="pwForm"><label>현재 비밀번호<input type="password" id="pwOld" autocomplete="current-password" required></label>' +
      '<label>새 비밀번호<input type="password" id="pwNew" autocomplete="new-password" minlength="6" required></label>' +
      '<label>새 비밀번호 확인<input type="password" id="pwNew2" autocomplete="new-password" minlength="6" required></label>' +
      '<p class="merr" id="pwErr"></p><div class="mfoot">' + (first ? '<button type="button" class="ghost" id="pwLogout">로그아웃</button>' : '<button type="button" class="ghost" data-close>취소</button>') +
      '<button class="primary" type="submit">변경</button></div></form></div>');
    $('pwOld').focus();
    if ($('pwLogout')) $('pwLogout').addEventListener('click', function () { delete m.dataset.lock; Api.logout().then(function () { showLogin(''); }); });
    $('pwForm').addEventListener('submit', function (e) {
      e.preventDefault();
      if ($('pwNew').value !== $('pwNew2').value) { $('pwErr').textContent = '새 비밀번호 두 칸이 서로 달라요.'; return; }
      Api.changePassword($('pwOld').value, $('pwNew').value).then(function () {
        delete m.dataset.lock; closeModal();
        if (first) return Api.me().then(enterApp);
        toast('비밀번호를 바꿨어요.');
      }).catch(function (err) { if (err.auth) { delete m.dataset.lock; return showLogin(err.message); } $('pwErr').textContent = err.message; });
    });
  }

  // 계정 관리 (관리자)
  function openAccounts() {
    openModal('<div class="mbox wide"><button class="icon mx" data-close title="닫기">' + ic('x', 18) + '</button><h3>계정 관리</h3>' +
      '<p class="msub">로그인 계정을 만들고 고쳐요. 새 계정이나 비밀번호를 바꾼 계정은 처음 로그인할 때 비밀번호를 새로 정하게 돼요. 계정은 지우지 않고 [사용]을 꺼서 막아요.</p>' +
      '<div class="acc-list"><table class="t"><thead><tr><th>아이디</th><th>이름</th><th>권한</th><th>상태</th><th>마지막 로그인</th><th></th></tr></thead><tbody id="accBody"><tr><td colspan="6" class="none">불러오는 중...</td></tr></tbody></table></div>' +
      '<form class="acc-form" id="accForm"><h4 id="accTitle">새 계정 만들기</h4><div class="acc-grid">' +
        '<label>아이디<input id="acId" placeholder="영문·숫자" required pattern="[A-Za-z0-9._\\-]{2,40}"></label>' +
        '<label>이름<input id="acName" placeholder="화면에 보일 이름"></label>' +
        '<label>비밀번호<input id="acPw" type="password" autocomplete="new-password" placeholder="새 계정은 필수"></label>' +
        '<label>권한<select id="acRole"><option value="user">일반</option><option value="admin">관리자</option></select></label>' +
        '<label class="chk"><input type="checkbox" id="acOn" checked> 사용</label>' +
      '</div><p class="merr" id="acErr"></p><div class="mfoot"><button type="button" class="ghost" id="acReset">새로 입력</button><button class="primary" type="submit">저장</button></div></form></div>');
    var accounts = [];
    function resetForm() { $('accForm').reset(); $('acId').readOnly = false; $('accTitle').textContent = '새 계정 만들기'; $('acPw').placeholder = '새 계정은 필수'; }
    function load() {
      Api.accountList().then(function (list) {
        accounts = list;
        $('accBody').innerHTML = list.map(function (a, i) {
          return '<tr><td><b>' + esc(a.id) + '</b></td><td>' + esc(a.name) + '</td><td>' + (a.role === 'admin' ? '<span class="badge blue">관리자</span>' : '<span class="badge gray">일반</span>') + '</td>' +
            '<td>' + (!a.enabled ? '<span class="badge gray">중지</span>' : a.mustChange ? '<span class="badge orange">비번 변경 대기</span>' : '<span class="badge green">사용</span>') + '</td>' +
            '<td class="dim">' + esc(a.lastLogin || '–') + '</td><td><div class="rowact"><button class="ghost sm" data-edit="' + i + '">고치기</button></div></td></tr>';
        }).join('');
        [].forEach.call($('accBody').querySelectorAll('[data-edit]'), function (b) {
          b.addEventListener('click', function () {
            var a = accounts[+b.dataset.edit];
            $('accTitle').textContent = a.id + ' 고치기'; $('acId').value = a.id; $('acId').readOnly = true; $('acName').value = a.name;
            $('acPw').value = ''; $('acPw').placeholder = '비우면 그대로'; $('acRole').value = a.role; $('acOn').checked = a.enabled; $('acName').focus();
          });
        });
      }).catch(function (err) { if (!authFail(err)) $('acErr').textContent = err.message; });
    }
    $('acReset').addEventListener('click', resetForm);
    $('accForm').addEventListener('submit', function (e) {
      e.preventDefault(); $('acErr').textContent = '';
      var id = $('acId').value.trim();
      Api.accountSave({ id: id, name: $('acName').value.trim(), password: $('acPw').value, role: $('acRole').value, enabled: $('acOn').checked })
        .then(function () { toast(esc(id) + ' 계정을 저장했어요.'); resetForm(); load(); })
        .catch(function (err) { if (!authFail(err)) $('acErr').textContent = err.message; });
    });
    load();
  }

  /* ═════════════ 엑셀 받기 ═════════════ */
  function exportXlsx() {
    if (!state.res || typeof XLSX === 'undefined') return toast('엑셀 라이브러리를 불러오지 못했어요.');
    var wb = XLSX.utils.book_new();
    var names = { partners: '협력점 요약', und: '1 미차감', miss: '2 정산서 누락', only: '3 정산서에만', chg: '4 금액 변동', chk: '5 확인 필요' };
    ORDER.forEach(function (k) {
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
      XLSX.utils.book_append_sheet(wb, ws, names[k]);
    });
    XLSX.writeFile(wb, '사은품차감검수_' + (state.res.meta.settleDate || 'result').replace(/-/g, '') + '.xlsx');
  }

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
    state.raw = norm(Rw); state.rawName = '예시 로우데이터'; state.rawErr = '';
    state.stmts = [{ name: '예시_가상텔레콤.xls', rows: norm(S.slice(0, 3)) }, { name: '예시_예시네트웍스.xls', rows: norm(S.slice(3)) }];
    state.savedRun = null;
    runCheck();
    state.mode = 'demo';
  }

  boot();
})();
