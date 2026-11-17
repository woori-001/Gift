/* workline.kr → 사은품 차감 검수 데이터 가져오기 북마크
 * workline.kr 에 로그인한 화면에서 북마크를 누르면 작은 창이 뜨고,
 * [가져오기]를 누르면 아래 세 가지를 받아서 검수 앱으로 넘겨요.
 *  1) 전체 정산 관리 · 정산예정일 기준 엑셀 (지금 데이터)
 *  2) 같은 조건의 OD(옛날 데이터) 엑셀
 *  3) 전체 정산 내역서 · 등록일 기간 일괄다운(zip)
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
  var fri = add(mon, -3), thu = add(mon, -4);    // 지난주 금요일, 목요일

  var box = document.createElement('div');
  box.id = 'gift-wl';
  box.style.cssText = 'position:fixed;z-index:2147483647;top:16px;right:16px;width:320px;background:#fff;color:#191f28;border:1px solid #e5e8eb;border-radius:14px;box-shadow:0 8px 28px rgba(0,0,0,.18);font:14px/1.5 Pretendard,-apple-system,"Malgun Gothic",sans-serif;padding:16px';
  box.innerHTML =
    '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px"><b style="font-size:15px">사은품 검수로 가져오기</b><button data-x style="border:0;background:none;font-size:18px;cursor:pointer;color:#8b95a1">×</button></div>' +
    '<label style="display:block;font-size:12px;color:#4e5968;margin-bottom:2px">정산예정일 (전체 정산 관리 · 지금 + OD)</label>' +
    '<input data-sd type="date" value="' + ymd(fri) + '" style="width:100%;box-sizing:border-box;padding:7px 9px;border:1px solid #d1d6db;border-radius:8px;margin-bottom:10px">' +
    '<label style="display:block;font-size:12px;color:#4e5968;margin-bottom:2px">정산내역서 등록일</label>' +
    '<div style="display:flex;gap:6px;align-items:center;margin-bottom:12px"><input data-f type="date" value="' + ymd(thu) + '" style="flex:1;min-width:0;padding:7px 6px;border:1px solid #d1d6db;border-radius:8px"><span>~</span><input data-t type="date" value="' + ymd(fri) + '" style="flex:1;min-width:0;padding:7px 6px;border:1px solid #d1d6db;border-radius:8px"></div>' +
    '<button data-go style="width:100%;padding:10px;border:0;border-radius:10px;background:#3182f6;color:#fff;font-weight:700;cursor:pointer">가져오기</button>' +
    '<div data-log style="margin-top:10px;font-size:12px;color:#4e5968;white-space:pre-line;max-height:220px;overflow:auto"></div>';
  document.body.appendChild(box);
  var q = function (s) { return box.querySelector('[' + s + ']'); };
  var logEl = q('data-log');
  function log(m, err) { logEl.innerHTML += '<div style="color:' + (err ? '#f04452' : '#4e5968') + '">' + m.replace(/</g, '&lt;') + '</div>'; logEl.scrollTop = 1e6; }
  q('data-x').onclick = function () { box.remove(); };

  var wait = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  function api(url, hdr) {
    return fetch(url, { credentials: 'same-origin', headers: Object.assign({ Accept: 'application/json' }, hdr || {}) }).then(function (r) {
      if (r.status === 401 || r.status === 403) throw new Error('workline 로그인이 풀렸어요. 다시 로그인한 뒤 눌러주세요.');
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
  function exportCalc(date, od) {
    var tag = od ? 'OD' : '지금 데이터';
    var hdr = od ? { 'X-Data-Source': 'old' } : {};
    log('· ' + tag + ' 엑셀 만드는 중...');
    return api('/api/exact/calc/export?dateChk=4&dateFrom=' + date + '&dateTo=' + date, hdr).then(function (j) {
      var id = j && j.job && j.job.jobId;
      if (!id) throw new Error(tag + ' 엑셀 작업을 시작하지 못했어요.');
      var tries = 0;
      function poll() {
        return api('/api/orders/export-jobs/' + id, hdr).then(function (s) {
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
        return bin('/api/orders/export-jobs/' + id + '/download', hdr).then(function (d) {
          log('· ' + tag + ': ' + job.rowCount.toLocaleString() + '건 받음');
          return { name: job.fileName || ('전체정산관리_' + tag + '.xlsx'), buf: d.buf, source: od ? 'od' : 'now', rows: job.rowCount };
        });
      });
    });
  }
  function getStatements(from, to) {
    log('· 정산내역서 개수 확인 중...');
    var qs = '?dateFrom=' + from + '&dateTo=' + to;
    return api('/api/exact/statements/bulk-excel/count' + qs).then(function (c) {
      var d = (c && c.data) || c || {};
      if (!d.total) throw new Error('등록일 ' + from + '~' + to + ' 정산내역서가 없어요.');
      if (d.max && d.total > d.max) throw new Error('정산내역서가 ' + d.total + '개라 한 번에 받을 수 있는 ' + d.max + '개를 넘어요. 기간을 나눠 주세요.');
      log('· 정산내역서 ' + d.total + '개 받는 중...' + (d.missing ? ' (파일 없는 ' + d.missing + '개 제외)' : ''));
      return bin('/api/exact/statements/bulk-excel' + qs).then(function (z) {
        log('· 정산내역서 압축파일 받음 (' + Math.round(z.buf.byteLength / 1024).toLocaleString() + 'KB)');
        return { name: '정산내역서_' + from + '_' + to + '.zip', buf: z.buf, count: d.withFile || d.total };
      });
    });
  }

  var busy = false;
  q('data-go').onclick = function () {
    if (busy) return;
    var sd = q('data-sd').value, f = q('data-f').value, t = q('data-t').value;
    if (!sd || !f || !t) { log('날짜를 모두 넣어주세요.', 1); return; }
    // 팝업 차단을 피하려면 클릭하자마자 창을 열어야 해요
    var win = window.open(GIFT + '?wl=' + Date.now() + '#wl-import', 'gift_import');
    if (!win) { log('검수 앱 창이 차단됐어요. 주소창 오른쪽의 팝업 허용을 누른 뒤 다시 눌러주세요.', 1); return; }
    busy = true; this.disabled = true; this.style.opacity = '.6'; logEl.innerHTML = '';
    var ready = false, sent = false;
    var payload = null;
    function trySend() {
      if (!ready || !payload || sent) return;
      sent = true;
      var tr = payload.raw.map(function (r) { return r.buf; }); if (payload.stmtZip) tr.push(payload.stmtZip.buf);
      win.postMessage(payload, GIFT_ORIGIN, tr);
      log('· 검수 앱으로 보냈어요. 그 창에서 확인하세요.');
    }
    function onMsg(e) {
      if (e.origin !== GIFT_ORIGIN || !e.data) return;
      if (e.data.type === 'gift-ready') { ready = true; trySend(); }
      if (e.data.type === 'gift-import-received') { log('✓ 검수 앱이 받았어요.'); window.removeEventListener('message', onMsg); }
    }
    window.addEventListener('message', onMsg);
    var btn = this;
    exportCalc(sd, false)
      .then(function (a) { return exportCalc(sd, true).then(function (b) { return [a, b]; }); })
      .then(function (raws) {
        raws = raws.filter(Boolean);
        if (!raws.length) throw new Error('정산예정일 ' + sd + ' 데이터가 지금·OD 모두 0건이에요.');
        return getStatements(f, t).then(function (z) {
          payload = { type: 'gift-import', v: 1, settleDate: sd, stmtRange: [f, t],
            raw: raws.map(function (r) { return { name: r.name, buf: r.buf, source: r.source }; }), stmtZip: z };
          if (!ready) log('· 검수 앱 창이 열리길 기다리는 중... (로그인 화면이면 로그인해 주세요)');
          trySend();
        });
      })
      .catch(function (err) { log('✕ ' + err.message, 1); try { if (!sent) win.close(); } catch (e) {} })
      .then(function () { busy = false; btn.disabled = false; btn.style.opacity = ''; });
  };
})();
