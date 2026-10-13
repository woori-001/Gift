/* Supabase RPC 래퍼. 모든 호출은 /rest/v1/rpc/gift_* 로만 나가요. */
var Api = (function () {
  var cfg = window.GIFT_CONFIG || {};
  var TOKEN_KEY = 'gift_audit_token';
  var token = null;
  try { token = localStorage.getItem(TOKEN_KEY); } catch (e) {}

  function setToken(t) {
    token = t || null;
    try { if (t) localStorage.setItem(TOKEN_KEY, t); else localStorage.removeItem(TOKEN_KEY); } catch (e) {}
  }

  function AuthError(msg) { var e = new Error(msg); e.auth = true; return e; }

  function rpc(fn, args) {
    return fetch(cfg.SUPABASE_URL + '/rest/v1/rpc/' + fn, {
      method: 'POST',
      headers: { 'apikey': cfg.SUPABASE_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify(args || {})
    }).then(function (res) {
      return res.text().then(function (text) {
        var body = null; try { body = text ? JSON.parse(text) : null; } catch (e) { body = text; }
        if (!res.ok) {
          var msg = (body && (body.message || body.error_description || body.hint)) || ('서버 오류 (' + res.status + ')');
          if (/^AUTH:/.test(msg)) { setToken(null); throw AuthError(msg.replace(/^AUTH:\s*/, '')); }
          throw new Error(msg);
        }
        return body;
      });
    }, function () { throw new Error('서버에 연결하지 못했어요. 인터넷 연결을 확인해 주세요.'); });
  }

  function withToken(fn, args) {
    if (!token) return Promise.reject(AuthError('로그인이 필요해요.'));
    var a = { p_token: token }; for (var k in args) a[k] = args[k];
    return rpc(fn, a);
  }

  return {
    hasToken: function () { return !!token; },
    login: function (id, pw) {
      return rpc('gift_login', { p_id: id, p_password: pw }).then(function (r) {
        if (!r || !r.ok) throw new Error((r && r.error) || '로그인하지 못했어요.');
        setToken(r.token); return r;
      });
    },
    logout: function () {
      var t = token; setToken(null);
      return t ? rpc('gift_logout', { p_token: t }).catch(function () {}) : Promise.resolve();
    },
    me: function () { return withToken('gift_me', {}); },
    changePassword: function (oldPw, newPw) { return withToken('gift_change_password', { p_old: oldPw, p_new: newPw }); },
    accountList: function () { return withToken('gift_account_list', {}); },
    accountSave: function (a) {
      return withToken('gift_account_save', { p_id: a.id, p_name: a.name, p_password: a.password || '', p_role: a.role, p_enabled: a.enabled });
    },
    runSave: function (run, findings) { return withToken('gift_run_save', { p_run: run, p_findings: findings }); },
    runList: function (limit) { return withToken('gift_run_list', { p_limit: limit || 100 }); },
    runGet: function (id) { return withToken('gift_run_get', { p_id: id }); },
    runMemo: function (id, memo) { return withToken('gift_run_memo', { p_id: id, p_memo: memo }); },
    runHide: function (id) { return withToken('gift_run_hide', { p_id: id }); }
  };
})();
