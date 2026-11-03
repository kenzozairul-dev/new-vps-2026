/* =============================================================================
   VPS Panel API client
   Talks to panel/api.php on the same origin. Falls back to DEMO mode when the
   page is opened via file:// (no backend available).
   ========================================================================== */
(function () {
  'use strict';

  var API_BASE = 'api/api.php';

  // file:// or a static host with no API -> demo mode
  var isHttp = /^https?:$/.test(location.protocol);

  function api(action, data, method) {
    var opts = {
      method: method || (data ? 'POST' : 'GET'),
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' }
    };
    var url = API_BASE + '?action=' + encodeURIComponent(action);
    if (data) opts.body = JSON.stringify(data);
    return fetch(url, opts).then(function (r) {
      return r.json().catch(function () { return { ok: false, error: 'Bad response (' + r.status + ')' }; });
    }).then(function (j) {
      if (j && j.ok) return j;
      var err = new Error((j && j.error) || 'Request failed');
      err.code = (j && j.error) || 'error';
      return Promise.reject(err);
    });
  }

  window.VPSAPI = {
    available: isHttp,

    // ---- auth ----
    session: function () { return api('session'); },
    login: function (password) { return api('login', { password: password }); },
    logout: function () { return api('logout'); },

    // ---- status ----
    system: function () { return api('system'); },
    services: function () { return api('services'); },
    accounts: function (svc) { return api('accounts', { svc: svc }); },
    xrayDetail: function () { return api('xray_detail'); },
    createdUsers: function (q) { return api('created_users', { q: q || '' }); },
    logs: function (lines, src) { return api('logs', { lines: lines || 100, src: src || 'user' }); },
    changelog: function () { return api('changelog'); },

    // ---- management ----
    createAccount: function (svc, payload) { return api('account_create', Object.assign({ svc: svc }, payload)); },
    deleteAccount: function (svc, user) { return api('account_delete', { svc: svc, user: user }); },
    renewAccount: function (svc, user, days) { return api('account_renew', { svc: svc, user: user, days: days }); },
    restartService: function (unit) { return api('service_restart', { unit: unit }); }
  };
})();
