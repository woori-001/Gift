/* workline.kr → 사은품 차감 검수 데이터 가져오기 북마크
 * workline.kr 에 로그인한 화면에서 북마크를 누르면 작은 창이 뜨고,
 * [가져오기]를 누르면 아래 두 가지를 받아서 검수 앱으로 넘겨요.
 *  1) 전체 정산 관리 · 정산예정일 기준 엑셀 (지금 데이터)
 *  2) 전체 정산 내역서 중 제목에 그 정산예정일(예: 260904)이 들어간 것 전부 (등록일과 상관없이, 늦게 등록한 것도 포함)
 * 받은 파일은 workline 서버에서 브라우저로만 오고, 검수 앱 창으로 바로 넘겨요.
 * README 의 "북마크 만들기" 에 있는 한 줄짜리 javascript: 주소가 이 파일을 줄인 것이에요. */
(function () {
  var GIFT = 'https://woori-001.github.io/Gift/';
  var GIFT_ORIGIN = 'https://woori-001.github.io';
  if (location.hostname !== 'workline.kr') { alert('workline.kr 화면에서 눌러주세요.'); return; }
  var old = document.getElementById('gift-wl');
  if (old) old.remove();

  function ymd(d) { return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  function add(d, n) { var x = new Date(d); x.setDate(x.getDate() + n); return x; }
  var now = new Date(); now.setHours(0, 0, 0, 0);
  var mon = add(now, -((now.getDay() + 6) % 7)); // 이번 주 월요일
  var fri = add(mon, -3);                        // 지난주 금요일

  var box = document.createElement('div');
  box.id = 'gift-wl';
  box.style.cssText = 'position:fixed;z-index:2147483647;top:16px;right:16px;width:320px;background:#fff;color:#191f28;border:1px solid #e5e8eb;border-radius:14px;box-shadow:0 8px 28px rgba(0,0,0,.18);font:14px/1.5 Pretendard,-apple-system,"Malgun Gothic",sans-serif;padding:16px';
  box.innerHTML =
    '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px"><b style="font-size:15px">사은품 검수로 가져오기</b><button data-x style="border:0;background:none;font-size:18px;cursor:pointer;color:#8b95a1">×</button></div>' +
    '<label style="display:block;font-size:12px;color:#4e5968;margin-bottom:2px">정산예정일</label>' +
    '<input data-sd type="date" value="' + ymd(fri) + '" style="width:100%;box-sizing:border-box;padding:7px 9px;border:1px solid #d1d6db;border-radius:8px;margin-bottom:6px">' +
    '<label style="display:flex;align-items:center;gap:6px;font-size:12.5px;margin:0 0 6px;cursor:pointer"><input data-two type="checkbox"> 앞 주와 몰아서 정산 (명절 2주 정산)</label>' +
    '<div style="font-size:11.5px;color:#8b95a1;margin-bottom:12px">전체 정산 관리 + 제목에 이 날짜가 들어간 정산내역서(늦게 등록한 것 포함)를 받아요. 2주 정산이면 앞 주 정산예정일 건까지 같이 받아요.</div>' +
    '<button data-go style="width:100%;padding:10px;border:0;border-radius:10px;background:#3182f6;color:#fff;font-weight:700;cursor:pointer">가져오기</button>' +
    '<div data-log style="margin-top:10px;font-size:12px;color:#4e5968;white-space:pre-line;max-height:220px;overflow:auto"></div>';
  document.body.appendChild(box);
  var q = function (s) { return box.querySelector('[' + s + ']'); };
  var logEl = q('data-log');
  // 진행 상황은 이 작은 창에도 쓰고, 검수 앱 창에도 같이 보내요(검수 앱이 준비되기 전 것은 모아뒀다가 한 번에)
  var fwd = { win: null, ready: false, queue: [] };
  function post(msg) { try { fwd.win.postMessage(msg, GIFT_ORIGIN); } catch (e) {} }
  function log(m, err, extra) {
    logEl.innerHTML += '<div style="color:' + (err ? '#f04452' : '#4e5968') + '">' + m.replace(/</g, '&lt;') + '</div>'; logEl.scrollTop = 1e6;
    if (!fwd.win) return;
    var msg = Object.assign({ type: 'gift-progress', msg: m.replace(/^[·✕✓]\s*/, ''), err: !!err }, extra || {});
    if (fwd.ready) post(msg); else fwd.queue.push(msg);
  }
  q('data-x').onclick = function () { box.remove(); };

  var wait = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  function api(url, hdr) {
    return fetch(url, { credentials: 'same-origin', headers: Object.assign({ Accept: 'application/json' }, hdr || {}) }).then(function (r) {
      if (r.status === 401) throw new Error('workline 로그인이 풀렸어요. 다시 로그인한 뒤 눌러주세요.');
      return r.text().then(function (t) {
        var j = null; try { j = JSON.parse(t); } catch (e) {}
        if (!r.ok) throw new Error((j && (j.message || j.error)) || ('workline 응답 오류 ' + r.status));
        return j;
      });
    });
  }
  function bin(url, hdr) {
    return fetch(url, { credentials: 'same-origin', headers: hdr || {} }).then(function (r) {
      if (!r.ok) return r.text().then(function (t) { var j = null; try { j = JSON.parse(t); } catch (e) {} throw new Error((j && (j.message || j.error)) || ('다운로드 실패 ' + r.status)); });
      return r.arrayBuffer().then(function (b) { return { buf: b, headers: r.headers }; });
    });
  }
  // 전체 정산 관리 엑셀: 내보내기 작업을 만들고, 끝나면 받기
  function exportCalc(date, od, from) {
    var tag = od ? 'OD' : '지금 데이터';
    // OD 는 엑셀 만들기 요청에만 표시를 붙이고, 진행 확인·받기는 평소처럼 해요(붙이면 workline 이 거절함)
    var hdr = od ? { 'X-Data-Source': 'old' } : {};
    log('· ' + tag + ' 엑셀 만드는 중...');
    return api('/api/exact/calc/export?dateChk=4&dateFrom=' + (from || date) + '&dateTo=' + date, hdr).then(function (j) {
      var id = j && j.job && j.job.jobId;
      if (!id) throw new Error(tag + ' 엑셀 작업을 시작하지 못했어요.');
      var tries = 0;
      function poll() {
        return api('/api/orders/export-jobs/' + id).then(function (s) {
          var job = s.job || s;
          if (job.status === 'done' && job.downloadable) return job;
          if (job.status === 'done' && !job.rowCount) return job;
          if (job.status === 'failed' || job.status === 'error' || (job.status === 'done' && job.error)) throw new Error(tag + ' 엑셀 만들기 실패: ' + (job.error || job.status));
          if (++tries > 150) throw new Error(tag + ' 엑셀이 너무 오래 걸려요. 잠시 뒤 다시 눌러주세요.');
          return wait(1500).then(poll);
        });
      }
      return poll().then(function (job) {
        if (!job.rowCount) { log('· ' + tag + ': 0건'); return null; }
        return bin('/api/orders/export-jobs/' + id + '/download').then(function (d) {
          log('· ' + tag + ': ' + job.rowCount.toLocaleString() + '건 받음', 0, { ok: true });
          return { name: job.fileName || ('전체정산관리_' + tag + '.xlsx'), buf: d.buf, source: od ? 'od' : 'now', rows: job.rowCount };
        });
      });
    });
  }
  // 정산내역서: 제목의 정산예정일(예: 웨이브넷260904-주정산)로 찾아요. 등록일로 받으면 늦게 등록한 정산서가 빠져서.
  function getStatements(dates) {
    var codes = dates.map(function (d) { return d.slice(2).replace(/-/g, ''); });
    var re = new RegExp('(^|\\D)(' + codes.join('|') + ')(\\D|$)');
    log('· 정산내역서 찾는 중... (제목에 ' + codes.join(' 또는 ') + ')');
    var items = [], seen = {};
    function page(code, n) {
      return api('/api/exact/statements?page=' + n + '&size=100&searchKey=title&searchTxt=' + code).then(function (j) {
        var d = (j && j.data) || {}, list = d.items || [];
        list.forEach(function (i) { if (!seen[i.exactIdx]) { seen[i.exactIdx] = 1; items.push(i); } });
        var pg = d.pagination || {};
        if (list.length && n < (pg.totalPages || 1) && n < 30) return page(code, n + 1);
      });
    }
    return codes.reduce(function (p, c) { return p.then(function () { return page(c, 1); }); }, Promise.resolve()).then(function () {
      var mine = items.filter(function (i) { return re.test(i.title || ''); });
      var withFile = mine.filter(function (i) { return i.hasExcel; });
      if (!mine.length) throw new Error('제목에 ' + codes.join(' / ') + ' 가 들어간 정산내역서가 없어요.');
      var days = mine.map(function (i) { return i.writeday; }).filter(Boolean).sort();
      log('· 정산내역서 ' + mine.length + '개 찾음 (등록일 ' + days[0] + (days[0] !== days[days.length - 1] ? ' ~ ' + days[days.length - 1] : '') + ')' + (mine.length > withFile.length ? ' · 엑셀 없는 ' + (mine.length - withFile.length) + '개 제외' : ''));
      var out = [], idx = 0, done = 0;
      function worker() {
        if (idx >= withFile.length) return Promise.resolve();
        var it = withFile[idx++];
        return bin('/api/exact/statements/' + it.exactIdx + '/file?which=excel').then(function (d) {
          out.push({ name: (it.dealerName || '') + '_' + (it.title || '') + '_' + it.exactIdx + '.xlsx', buf: d.buf });
          done++; if (done % 25 === 0 && done < withFile.length) log('· 정산내역서 받는 중 ' + done + ' / ' + withFile.length);
        }, function (e) { log('· 받지 못함: ' + (it.dealerName || '') + ' ' + (it.title || '') + ' — ' + e.message, 1); }).then(worker);
      }
      return Promise.all([worker(), worker(), worker(), worker()]).then(function () {
        if (!out.length) throw new Error('정산내역서를 하나도 받지 못했어요.');
        log('· 정산내역서 ' + out.length + '개 받음', 0, { ok: true });
        return out;
      });
    });
  }

  var busy = false;
  q('data-go').onclick = function () {
    if (busy) return;
    var sd = q('data-sd').value, two = q('data-two').checked;
    if (!sd) { log('정산예정일을 넣어주세요.', 1); return; }
    var prev = two ? ymd(add(new Date(sd + 'T00:00:00'), -7)) : '';
    // 팝업 차단을 피하려면 클릭하자마자 창을 열어야 해요
    var win = window.open(GIFT + '?wl=' + Date.now() + '#wl-import', 'gift_import');
    if (!win) { log('검수 앱 창이 차단됐어요. 주소창 오른쪽의 팝업 허용을 누른 뒤 다시 눌러주세요.', 1); return; }
    busy = true; this.disabled = true; this.style.opacity = '.6'; logEl.innerHTML = '';
    fwd = { win: win, ready: false, queue: [] };
    var ready = false, sent = false;
    var payload = null;
    function trySend() {
      if (!ready || !payload || sent) return;
      sent = true;
      var tr = payload.raw.map(function (r) { return r.buf; }).concat(payload.stmts.map(function (s) { return s.buf; }));
      win.postMessage(payload, GIFT_ORIGIN, tr);
      log('· 검수 앱으로 보냈어요. 그 창에서 확인하세요.');
      fwd.win = null;
    }
    function onMsg(e) {
      if (e.origin !== GIFT_ORIGIN || !e.data) return;
      if (e.data.type === 'gift-ready' && !ready) { ready = true; fwd.ready = true; fwd.queue.forEach(post); fwd.queue = []; trySend(); }
      if (e.data.type === 'gift-import-received') { log('✓ 검수 앱이 받았어요.'); window.removeEventListener('message', onMsg); }
    }
    window.addEventListener('message', onMsg);
    var btn = this;
    // OD(옛날 데이터)는 받지 않아요
    if (two) log('· 2주 몰아서 정산: 정산예정일 ' + prev + ' ~ ' + sd);
    exportCalc(sd, false, prev)
      .then(function (a) { return [a]; })
      .then(function (raws) {
        raws = raws.filter(Boolean);
        if (!raws.length) throw new Error('정산예정일 ' + sd + ' 전체 정산 관리 데이터가 0건이에요.');
        return getStatements(two ? [prev, sd] : [sd]).then(function (sts) {
          payload = { type: 'gift-import', v: 2, settleDate: sd, settleFrom: prev || sd,
            raw: raws.map(function (r) { return { name: r.name, buf: r.buf, source: r.source }; }), stmts: sts };
          if (!ready) log('· 검수 앱 창이 열리길 기다리는 중... (로그인 화면이면 로그인해 주세요)');
          trySend();
        });
      })
      .catch(function (err) { log('✕ ' + err.message, 1, { fail: true }); })
      .then(function () { busy = false; btn.disabled = false; btn.style.opacity = ''; });
  };
})();
