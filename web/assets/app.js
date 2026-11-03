/* =============================================================================
   SCRIPT VPS MENU — Ops Console
   Vanilla, no dependencies. All interactions simulated client-side.
   ========================================================================== */
(function () {
  'use strict';

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var isMac = /Mac|iPhone|iPad/.test(navigator.platform || '');
  var $ = function (sel, ctx) { return (ctx || document).querySelector(sel); };
  var $$ = function (sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); };

  function esc(str) {
    return String(str).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* ---------------------------------------------------------------- toasts */
  var toaster = $('#toaster');
  function toast(message, variant) {
    var el = document.createElement('div');
    el.className = 'toast' + (variant ? ' toast--' + variant : '');
    el.innerHTML = '<span class="toast__dot" aria-hidden="true"></span><span></span>';
    el.lastChild.textContent = message;
    toaster.appendChild(el);
    window.setTimeout(function () {
      el.classList.add('is-out');
      window.setTimeout(function () { el.remove(); }, 240);
    }, 2600);
  }

  /* ---------------------------------------------------------------- copy */
  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text).catch(function () { return legacyCopy(text); });
    }
    return legacyCopy(text);
  }

  function legacyCopy(text) {
    return new Promise(function (resolve, reject) {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.top = '-1000px';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      var ok = false;
      try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
      ta.remove();
      ok ? resolve() : reject(new Error('copy failed'));
    });
  }

  function flashCopied(btn) {
    var label = btn.querySelector('.copy-btn__label');
    if (label) label.textContent = 'Copied';
    btn.classList.add('is-copied');
    var prevLabel = btn.getAttribute('aria-label');
    btn.setAttribute('aria-label', 'Copied');
    window.clearTimeout(btn._copyTimer);
    btn._copyTimer = window.setTimeout(function () {
      btn.classList.remove('is-copied');
      if (prevLabel) btn.setAttribute('aria-label', prevLabel);
      if (label) label.textContent = '';
    }, 1500);
  }

  document.addEventListener('click', function (e) {
    var btn = e.target.closest('.copy-btn');
    if (!btn) return;
    var value = btn.getAttribute('data-copy') || '';
    if (!value) return;
    copyText(value).then(function () {
      flashCopied(btn);
    }).catch(function () {
      toast('Copy blocked by browser — select the text manually', 'warn');
    });
  });

  /* ---------------------------------------------------------------- services */
  var SERVICES = {
    ssh: {
      idx: '01', name: 'SSH & OVPN', status: 'running', uptime: 'up 12d 4h 33m',
      systemd: 'ssh.service · active (running)',
      configPath: '/etc/ssh/sshd_config',
      config: [
        '# SCRIPT VPS MENU — ssh profile',
        'Port 22',
        'Port 109                     # dropbear ws',
        'PermitRootLogin prohibit-password',
        'PasswordAuthentication yes',
        'MaxAuthTries 3',
        'ClientAliveInterval 120',
        'AllowTcpForwarding yes',
        'Banner /etc/vps/banner',
        '',
        '# OHP (openvpn over http proxy)',
        'listen-addr = 0.0.0.0:443',
        'proxy = 127.0.0.1:109'
      ].join('\n'),
      ports: [
        { port: '22', proto: 'tcp', desc: 'OpenSSH daemon', state: 'listen' },
        { port: '109', proto: 'tcp', desc: 'Dropbear / websocket', state: 'listen' },
        { port: '143', proto: 'tcp', desc: 'OpenVPN TCP', state: 'listen' },
        { port: '443', proto: 'tcp', desc: 'OHP HTTP proxy', state: 'listen' }
      ],
      accounts: [
        { user: 'kenzo', exp: 'Lifetime', days: 9999, quota: 42, used: '12.4 / 30 GB', login: '02-11 09:14', online: true },
        { user: 'ali_vpn', exp: '18-11-2026', days: 16, quota: 68, used: '20.3 / 30 GB', login: '02-11 08:51', online: true },
        { user: 'nadiah', exp: '05-11-2026', days: 3, quota: 91, used: '27.2 / 30 GB', login: '01-11 23:08', online: true },
        { user: 'tokramli', exp: '24-12-2026', days: 52, quota: 22, used: '6.6 / 30 GB', login: '31-10 19:40', online: false },
        { user: 'shah94', exp: '01-02-2027', days: 91, quota: 12, used: '3.5 / 30 GB', login: '29-10 12:02', online: false },
        { user: 'meimei', exp: '09-11-2026', days: 7, quota: 55, used: '16.4 / 30 GB', login: '02-11 07:30', online: false }
      ]
    },
    xray: {
      idx: '02', name: 'XRAY — VMess / VLess', status: 'running', uptime: 'up 12d 4h 30m',
      systemd: 'xray.service · active (running)',
      configPath: '/usr/local/etc/xray/config.json',
      config: [
        '{',
        '  "log": { "loglevel": "warning" },',
        '  "inbounds": [',
        '    { "tag": "vmess-ws", "port": 443, "protocol": "vmess",',
        '      "streamSettings": { "network": "ws",',
        '        "wsSettings": { "path": "/kenzo" } } },',
        '    { "tag": "vless-grpc", "port": 8443, "protocol": "vless",',
        '      "streamSettings": { "network": "grpc",',
        '        "grpcSettings": { "serviceName": "vless-gun" } } }',
        '  ],',
        '  "outbounds": [{ "protocol": "freedom" }]',
        '}'
      ].join('\n'),
      ports: [
        { port: '443', proto: 'tcp', desc: 'VMess WS + TLS', state: 'listen' },
        { port: '8443', proto: 'tcp', desc: 'VLess gRPC', state: 'listen' },
        { port: '2087', proto: 'tcp', desc: 'VLess WS non-TLS', state: 'listen' },
        { port: '10085', proto: 'tcp', desc: 'stats api (localhost)', state: 'listen' }
      ],
      accounts: [
        { user: 'ali_vpn', exp: '18-11-2026', days: 16, quota: 74, used: '37.1 / 50 GB', login: '02-11 08:53', online: true },
        { user: 'nadiah', exp: '05-11-2026', days: 3, quota: 96, used: '48.0 / 50 GB', login: '02-11 09:02', online: true },
        { user: 'tokramli', exp: '24-12-2026', days: 52, quota: 31, used: '15.6 / 50 GB', login: '01-11 21:15', online: false },
        { user: 'zulkifli', exp: '27-11-2026', days: 25, quota: 18, used: '9.0 / 50 GB', login: '31-10 22:44', online: false },
        { user: 'meimei', exp: '09-11-2026', days: 7, quota: 62, used: '31.0 / 50 GB', login: '02-11 07:32', online: false },
        { user: 'hafiz_t', exp: '12-11-2026', days: 10, quota: 5, used: '2.6 / 50 GB', login: '30-10 18:20', online: false },
        { user: 'ain', exp: '02-01-2027', days: 61, quota: 44, used: '22.1 / 50 GB', login: '28-10 10:05', online: false },
        { user: 'remy', exp: '15-11-2026', days: 13, quota: 12, used: '6.0 / 50 GB', login: '27-10 14:31', online: false },
        { user: 'wan_ed', exp: '20-02-2027', days: 110, quota: 8, used: '4.2 / 50 GB', login: '26-10 09:19', online: false }
      ]
    },
    trojan: {
      idx: '03', name: 'TROJAN-GFW & GO', status: 'running', uptime: 'up 12d 1h 12m',
      systemd: 'trojan-go.service · active (running)',
      configPath: '/etc/trojan-go/config.json',
      config: [
        '{',
        '  "run_type": "server",',
        '  "local_port": 2083,',
        '  "local_addr": "0.0.0.0",',
        '  "remote_addr": "127.0.0.1",',
        '  "remote_port": 80,',
        '  "ssl": {',
        '    "cert": "/etc/vps/cert/fullchain.pem",',
        '    "key": "/etc/vps/cert/privkey.pem",',
        '    "sni": "sg1.kenzovpn.my"',
        '  },',
        '  "websocket": { "enabled": true, "path": "/trojan" }',
        '}'
      ].join('\n'),
      ports: [
        { port: '2083', proto: 'tcp', desc: 'Trojan-GFW TLS', state: 'listen' },
        { port: '2087', proto: 'tcp', desc: 'Trojan-Go WS', state: 'listen' }
      ],
      accounts: [
        { user: 'nadiah', exp: '05-11-2026', days: 3, quota: 88, used: '26.4 / 30 GB', login: '02-11 09:01', online: true },
        { user: 'tokramli', exp: '24-12-2026', days: 52, quota: 40, used: '12.0 / 30 GB', login: '01-11 20:02', online: false },
        { user: 'zulkifli', exp: '27-11-2026', days: 25, quota: 27, used: '8.1 / 30 GB', login: '31-10 22:50', online: false }
      ]
    },
    wireguard: {
      idx: '04', name: 'WIREGUARD', status: 'running', uptime: 'up 12d 4h 33m',
      systemd: 'wg-quick@wg0.service · active (running)',
      configPath: '/etc/wireguard/wg0.conf',
      config: [
        '[Interface]',
        'Address = 10.66.66.1/24',
        'ListenPort = 51820',
        'PrivateKey = <redacted>',
        'MTU = 1420',
        '',
        '[Peer]',
        '# kenzo-phone',
        'AllowedIPs = 10.66.66.2/32',
        'PublicKey = 8Xk2…q7Ld',
        '',
        '[Peer]',
        '# ali-laptop',
        'AllowedIPs = 10.66.66.3/32',
        'PublicKey = Qm4v…p0Rt'
      ].join('\n'),
      ports: [
        { port: '51820', proto: 'udp', desc: 'wg0 handshake + data', state: 'listen' }
      ],
      accounts: [
        { user: 'kenzo-phone', exp: 'Lifetime', days: 9999, quota: 18, used: '4.1 / 25 GB', login: '02-11 09:10', online: true },
        { user: 'ali-laptop', exp: '18-11-2026', days: 16, quota: 52, used: '13.0 / 25 GB', login: '02-11 08:44', online: true },
        { user: 'nadiah-ipad', exp: '05-11-2026', days: 3, quota: 81, used: '20.2 / 25 GB', login: '01-11 23:11', online: false },
        { user: 'tokramli-tv', exp: '24-12-2026', days: 52, quota: 34, used: '8.5 / 25 GB', login: '31-10 20:00', online: false },
        { user: 'shah94-pc', exp: '01-02-2027', days: 91, quota: 9, used: '2.2 / 25 GB', login: '29-10 12:15', online: false }
      ]
    },
    sstp: {
      idx: '05', name: 'SSTP', status: 'stopped', uptime: 'stopped 4d 2h ago',
      systemd: 'sstp-server.service · inactive (dead)',
      configPath: '/etc/sstp/sstp.conf',
      config: [
        '# SCRIPT VPS MENU — sstp-server',
        'listen 0.0.0.0',
        'port 444',
        'certificate /etc/vps/cert/sstp.pem',
        'local 10.20.20.1',
        'remote 10.20.20.100-200',
        '',
        '# certificate expired 29-10-2026 — renew required',
        '# run: vps-setting > renew cert'
      ].join('\n'),
      ports: [
        { port: '444', proto: 'tcp', desc: 'SSTP over TLS', state: 'down' }
      ],
      accounts: []
    },
    l2tp: {
      idx: '06', name: 'L2TP / PPTP', status: 'running', uptime: 'up 12d 4h 31m',
      systemd: 'xl2tpd.service · active (running)',
      configPath: '/etc/xl2tpd/xl2tpd.conf',
      config: [
        '[global]',
        'port = 1701',
        'access control = no',
        '',
        '[lns default]',
        'ip range = 10.30.30.10-10.30.30.100',
        'local ip = 10.30.30.1',
        'require chap = yes',
        'refuse pap = yes',
        'require authentication = yes',
        'name = vps-sg1',
        'ppp debug = no',
        'pppoptfile = /etc/ppp/options.xl2tpd',
        'length bit = yes'
      ].join('\n'),
      ports: [
        { port: '1701', proto: 'udp', desc: 'L2TP control + data', state: 'listen' },
        { port: '1723', proto: 'tcp', desc: 'PPTP (legacy)', state: 'listen' }
      ],
      accounts: [
        { user: 'tokramli', exp: '24-12-2026', days: 52, quota: 47, used: '9.4 / 20 GB', login: '01-11 22:31', online: true },
        { user: 'meimei', exp: '09-11-2026', days: 7, quota: 73, used: '14.6 / 20 GB', login: '02-11 07:28', online: false }
      ]
    },
    shadowsocks: {
      idx: '07', name: 'SHADOWSOCKS obfs/SSR', status: 'empty', uptime: 'not installed',
      systemd: 'no unit · package absent',
      configPath: '/etc/shadowsocks-libev/config.json',
      config: [
        '# ss-libev is not installed on this image',
        '# install: vps-setting > add service > shadowsocks',
        '',
        '{',
        '  "server": "0.0.0.0",',
        '  "server_port": 8388,',
        '  "method": "chacha20-ietf-poly1305"',
        '}'
      ].join('\n'),
      ports: [],
      accounts: []
    }
  };

  /* ---------------------------------------------------------------- drawer */
  var drawer = $('#drawer');
  var drawerScrim = $('#drawerScrim');
  var lastFocused = null;
  var activeService = null;
  var activeTab = 'accounts';
  var trapHandler = null;

  function focusables(root) {
    return $$('a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])', root)
      .filter(function (el) {
        return el.offsetWidth > 0 || el.offsetHeight > 0 || el === document.activeElement;
      });
  }

  function trapFocus(container) {
    return function (e) {
      if (e.key !== 'Tab') return;
      var list = focusables(container);
      if (!list.length) { e.preventDefault(); return; }
      var first = list[0];
      var last = list[list.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first || !container.contains(document.activeElement)) {
          e.preventDefault();
          last.focus();
        }
      } else if (document.activeElement === last || !container.contains(document.activeElement)) {
        e.preventDefault();
        first.focus();
      }
    };
  }

  function lockPage() { document.body.classList.add('is-locked'); }
  function unlockPageIfIdle() {
    if (!drawer.classList.contains('is-open') && !modal.classList.contains('is-open')) {
      document.body.classList.remove('is-locked');
    }
  }

  function statusMeta(status) {
    if (status === 'running') return { pill: 'pill--run', label: 'RUNNING', cls: 'run' };
    if (status === 'stopped') return { pill: 'pill--stop', label: 'STOPPED', cls: 'stop' };
    return { pill: 'pill--muted', label: 'NOT INSTALLED', cls: 'empty' };
  }

  function accountRows(svc) {
    if (!svc.accounts.length) {
      return '';
    }
    return svc.accounts.map(function (a) {
      var expClass = a.days <= 0 ? 'acc-exp--dead' : (a.days <= 7 ? 'acc-exp--soon' : '');
      var quotaClass = a.quota >= 75 ? ' quota--high' : '';
      var dotClass = a.online ? '' : ' acc-user__dot--idle';
      return '<tr>' +
        '<td><span class="acc-user"><i class="acc-user__dot' + dotClass + '" aria-hidden="true"></i>' +
        '<span class="acc-user__name">' + esc(a.user) + '</span></span></td>' +
        '<td><span class="acc-exp ' + expClass + '">' + esc(a.exp) + '</span></td>' +
        '<td><span class="quota' + quotaClass + '"><span class="quota__txt">' + esc(a.used) + ' · ' + a.quota + '%</span>' +
        '<span class="quota__bar"><span style="width:' + Math.min(100, a.quota) + '%"></span></span></span></td>' +
        '<td class="col-login"><span class="acc-login">' + esc(a.login) + '</span></td>' +
        '<td><span class="row-actions">' +
        '<button class="row-btn" type="button" data-act="renew" data-user="' + esc(a.user) + '" aria-label="Renew ' + esc(a.user) + '" title="Renew">' +
        '<svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M13 8a5 5 0 1 1-1.6-3.7"/><path d="M13 2.5V5h-2.5"/></svg></button>' +
        '<button class="row-btn row-btn--danger" type="button" data-act="delete" data-user="' + esc(a.user) + '" aria-label="Delete ' + esc(a.user) + '" title="Delete">' +
        '<svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.6 8h5.8l.6-8"/></svg></button>' +
        '</span></td></tr>';
    }).join('');
  }

  function renderDrawer(svc) {
    var meta = statusMeta(svc.status);
    $('#drawerIdx').textContent = svc.idx;
    $('#drawerTitle').textContent = svc.name;
    $('#drawerUptime').textContent = svc.uptime;
    $('#drawerFootMeta').textContent = svc.systemd;

    var pill = $('#drawerPill');
    pill.className = 'pill ' + meta.pill;
    pill.innerHTML = '<i class="pill__dot" aria-hidden="true"></i>' + meta.label;

    $('#tabAccountCount').textContent = svc.accounts.length;
    $('#tabPortCount').textContent = svc.ports.length;

    var expiring = svc.accounts.filter(function (a) { return a.days <= 7; }).length;
    $('#accSummary').textContent = svc.accounts.length + ' account' + (svc.accounts.length === 1 ? '' : 's') +
      (expiring ? ' · ' + expiring + ' expiring soon' : '');

    $('#accBody').innerHTML = accountRows(svc);
    var empty = $('#accEmpty');
    empty.hidden = svc.accounts.length > 0;
    $('#accEmptyTitle').textContent = svc.status === 'empty' ? 'Service not installed' : 'No accounts';
    $('#accEmptyBody').textContent = svc.status === 'empty'
      ? 'Install Shadowsocks from VPS Setting before provisioning accounts.'
      : 'This service has no provisioned users yet.';
    $('#accEmptyAction').textContent = svc.status === 'empty' ? 'Open VPS Setting' : 'Create first user';

    $('#portList').innerHTML = svc.ports.length ? svc.ports.map(function (p) {
      return '<li class="port-row">' +
        '<span class="port-row__num">' + esc(p.port) + '</span>' +
        '<span><span class="port-row__proto">' + esc(p.proto) + '</span> ' +
        '<span class="port-row__desc">' + esc(p.desc) + '</span></span>' +
        '<span class="port-row__state"' + (p.state === 'down' ? ' style="color:var(--danger)"' : '') + '>' +
        '<i aria-hidden="true"></i>' + (p.state === 'down' ? 'DOWN' : 'LISTEN') + '</span></li>';
    }).join('') : '<li class="empty"><p class="empty__title">No listeners</p><p class="empty__body">Service is not installed, so no sockets are bound.</p></li>';

    $('#cfgPath').textContent = svc.configPath;
    $('#cfgCode').textContent = svc.config;
    var copyBtn = $('#cfgCopy');
    copyBtn.setAttribute('data-copy', svc.config);
    copyBtn.classList.remove('is-copied');
  }

  function setTab(name, focusTab) {
    activeTab = name;
    $$('.tab', drawer).forEach(function (tab) {
      var on = tab.id === 'tab-' + name;
      tab.setAttribute('aria-selected', on ? 'true' : 'false');
      tab.tabIndex = on ? 0 : -1;
      if (on && focusTab) tab.focus();
    });
    $$('.tabpanel', drawer).forEach(function (panel) {
      panel.hidden = panel.id !== 'panel-' + name;
    });
    if (name === 'config') {
      var code = $('#cfgCode');
      if (code) code.scrollTop = 0;
    }
  }

  function openDrawer(key, trigger) {
    var svc = SERVICES[key];
    if (!svc) return;
    activeService = key;
    lastFocused = trigger || document.activeElement;
    renderDrawer(svc);
    setTab('accounts', false);

    drawerScrim.hidden = false;
    drawer.removeAttribute('inert');
    drawer.setAttribute('aria-hidden', 'false');
    lockPage();
    // force reflow so transition runs from the closed state
    void drawer.offsetWidth;
    drawerScrim.classList.add('is-open');
    drawer.classList.add('is-open');
    trapHandler = trapFocus(drawer);
    document.addEventListener('keydown', trapHandler, true);
    $('#drawerClose').focus();
  }

  function closeDrawer() {
    if (!drawer.classList.contains('is-open')) return;
    drawer.classList.remove('is-open');
    drawerScrim.classList.remove('is-open');
    drawer.setAttribute('aria-hidden', 'true');
    drawer.setAttribute('inert', '');
    if (trapHandler) document.removeEventListener('keydown', trapHandler, true);
    trapHandler = null;
    window.setTimeout(function () {
      if (!drawer.classList.contains('is-open')) drawerScrim.hidden = true;
    }, 260);
    unlockPageIfIdle();
    if (lastFocused && document.contains(lastFocused)) lastFocused.focus();
  }

  $$('.svc-card').forEach(function (card) {
    card.addEventListener('click', function () {
      openDrawer(card.getAttribute('data-service'), card);
    });
  });

  $('#drawerClose').addEventListener('click', closeDrawer);
  drawerScrim.addEventListener('click', closeDrawer);

  $$('.tab', drawer).forEach(function (tab) {
    tab.addEventListener('click', function () {
      setTab(tab.id.replace('tab-', ''), false);
    });
    tab.addEventListener('keydown', function (e) {
      var tabs = $$('.tab', drawer);
      var i = tabs.indexOf(tab);
      var next = null;
      if (e.key === 'ArrowRight') next = tabs[(i + 1) % tabs.length];
      if (e.key === 'ArrowLeft') next = tabs[(i - 1 + tabs.length) % tabs.length];
      if (e.key === 'Home') next = tabs[0];
      if (e.key === 'End') next = tabs[tabs.length - 1];
      if (next) {
        e.preventDefault();
        setTab(next.id.replace('tab-', ''), true);
      }
    });
  });

  $('#accBody').addEventListener('click', function (e) {
    var btn = e.target.closest('.row-btn');
    if (!btn) return;
    var user = btn.getAttribute('data-user');
    if (btn.getAttribute('data-act') === 'renew') {
      btn.closest('tr').querySelector('.acc-exp').classList.remove('acc-exp--soon');
      toast('Renewed ' + user + ' · +30 days (simulated)', 'info');
    } else {
      var row = btn.closest('tr');
      row.style.opacity = '.35';
      window.setTimeout(function () { row.remove(); }, 220);
      toast('Account ' + user + ' deleted (simulated)', 'warn');
    }
  });

  $('#svcRestart').addEventListener('click', function () {
    var name = SERVICES[activeService] ? SERVICES[activeService].name : 'service';
    toast('Restarting ' + name + ' — queued (simulated)', 'info');
  });
  $('#svcLogs').addEventListener('click', function () {
    closeDrawer();
    window.setTimeout(function () {
      $('#logStream').scrollIntoView({ block: 'center', behavior: reduceMotion ? 'auto' : 'smooth' });
      $('#logStream').focus({ preventScroll: true });
    }, 200);
  });
  $('#addUserBtn').addEventListener('click', function () {
    toast('Add user form opens in CLI mode (simulated)', 'info');
  });
  $('#accEmptyAction').addEventListener('click', function () {
    toast('Redirecting to VPS Setting (simulated)', 'info');
  });

  /* ---------------------------------------------------------------- modal */
  var modal = $('#updateModal');
  var modalScrim = $('#modalScrim');
  var modalTrap = null;
  var modalOpener = null;

  function openModal(trigger) {
    modalOpener = trigger || document.activeElement;
    modalScrim.hidden = false;
    modal.removeAttribute('inert');
    modal.setAttribute('aria-hidden', 'false');
    lockPage();
    void modal.offsetWidth;
    modalScrim.classList.add('is-open');
    modal.classList.add('is-open');
    modalTrap = trapFocus(modal);
    document.addEventListener('keydown', modalTrap, true);
    $('#modalConfirm').focus();
  }

  function closeModal() {
    if (!modal.classList.contains('is-open')) return;
    modal.classList.remove('is-open');
    modalScrim.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
    modal.setAttribute('inert', '');
    if (modalTrap) document.removeEventListener('keydown', modalTrap, true);
    modalTrap = null;
    window.setTimeout(function () {
      if (!modal.classList.contains('is-open')) modalScrim.hidden = true;
    }, 200);
    resetProgress();
    unlockPageIfIdle();
    if (modalOpener && document.contains(modalOpener)) modalOpener.focus();
  }

  var progressTimer = null;
  function resetProgress() {
    window.clearInterval(progressTimer);
    $('#updProgress').hidden = true;
    $('#updBar').style.width = '0%';
    $('#updStatus').textContent = 'preparing…';
    $('#modalConfirm').disabled = false;
    $('#modalConfirm').textContent = 'Confirm update';
  }

  $('#updateBtn').addEventListener('click', function (e) { openModal(e.currentTarget); });
  $('#menuUpdate').addEventListener('click', function (e) { openModal(e.currentTarget); });
  $('#modalClose').addEventListener('click', closeModal);
  $('#modalCancel').addEventListener('click', closeModal);
  modalScrim.addEventListener('click', closeModal);

  $('#modalConfirm').addEventListener('click', function () {
    var steps = [
      'fetching manifest 3.1 …',
      'verifying sha256 · 4f2a9c1',
      'installing core xray / v2ray …',
      'migrating panel config …',
      'restarting services 1/7 …',
      'update complete · 38s'
    ];
    var i = 0;
    var btn = $('#modalConfirm');
    btn.disabled = true;
    btn.textContent = 'Running…';
    $('#updProgress').hidden = false;
    $('#updBar').style.width = '4%';
    progressTimer = window.setInterval(function () {
      i++;
      if (i < steps.length) {
        $('#updStatus').textContent = steps[i];
        $('#updBar').style.width = Math.round((i / (steps.length - 1)) * 100) + '%';
      } else {
        window.clearInterval(progressTimer);
        window.setTimeout(function () {
          closeModal();
          toast('Server updated to v3.1 — all services restarted', 'info');
        }, 700);
      }
    }, reduceMotion ? 120 : 620);
  });

  /* ---------------------------------------------------------------- keyboard */
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      if (modal.classList.contains('is-open')) { e.preventDefault(); closeModal(); return; }
      if (drawer.classList.contains('is-open')) { e.preventDefault(); closeDrawer(); return; }
      if (cmdOutput && !cmdOutput.hidden) {
        cmdOutput.hidden = true;
      }
    }
  });

  /* ---------------------------------------------------------------- counters */
  function animateCount(el) {
    var target = parseFloat(el.getAttribute('data-count'));
    var decimals = parseInt(el.getAttribute('data-decimals'), 10) || 0;
    if (reduceMotion || !isFinite(target)) {
      el.textContent = target.toFixed(decimals);
      return;
    }
    var start = performance.now();
    var dur = 780;
    function frame(now) {
      var t = Math.min(1, (now - start) / dur);
      var eased = 1 - Math.pow(1 - t, 3);
      el.textContent = (target * eased).toFixed(decimals);
      if (t < 1) requestAnimationFrame(frame);
      else el.textContent = target.toFixed(decimals);
    }
    requestAnimationFrame(frame);
  }

  var counters = $$('.num');
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          animateCount(entry.target);
          io.unobserve(entry.target);
        }
      });
    }, { threshold: .4 });
    counters.forEach(function (c) { io.observe(c); });
  } else {
    counters.forEach(animateCount);
  }

  /* ---------------------------------------------------------------- command palette */
  var cmdForm = $('#cmdForm');
  var cmdInput = $('#cmdInput');
  var cmdItems = $$('.cmd__item');
  var cmdEmpty = $('#cmdEmpty');
  var cmdOutput = $('#cmdOutput');
  var cmdOutBody = $('#cmdOutBody');
  var cmdOutputTitle = $('#cmdOutputTitle');

  var OUTPUTS = {
    'ssh-menu': [
      ' [SSH & OVPN]  manage account',
      '',
      '  1) create user      4) delete user',
      '  2) renew user       5) show user',
      '  3) lock user        6) set quota',
      '',
      ' active: 14 users · ports 22 / 109 / 143 / 443',
      ' status: service healthy · uptime 12d 4h'
    ],
    'xray-menu': [
      ' [XRAY]  VMess / VLess',
      '',
      ' core      : xray 1.8.24',
      ' transport : ws + grpc + xtls',
      ' tls       : sg1.kenzovpn.my (valid 67d)',
      '',
      ' users 9 · traffic today 48.2 GB',
      ' stats api 127.0.0.1:10085 ok'
    ],
    'wg-menu': [
      ' [WIREGUARD]  wg0',
      '',
      ' interface   : wg0 (up)',
      ' listen      : 51820/udp',
      ' peers       : 5 (2 online)',
      '',
      '   kenzo-phone    10.66.66.2   handshake 12s',
      '   ali-laptop     10.66.66.3   handshake 4m',
      '',
      ' generate QR: wg-qr <peer>'
    ],
    trial: [
      ' [TRIAL]  generator',
      '',
      ' >> creating trial account …',
      ' user      : trial-x7k2',
      ' password  : generated (12 chars)',
      ' expiry    : 1 day (03-11-2026 09:20)',
      ' quota     : 2 GB · 1 device',
      '',
      ' account saved to /etc/vps/trial.log'
    ],
    usernew: [
      ' [USER]  create account',
      '',
      ' >> username : ali_vpn',
      ' >> expiry   : 30 days',
      ' >> services : ssh, xray, trojan',
      '',
      ' created 3 entries · reloading xray …',
      ' done. user ali_vpn active until 02-12-2026'
    ],
    update: [
      ' [UPDATE]  version check',
      '',
      ' installed : 3.0.9',
      ' available : 3.1  (stable)',
      ' size      : 2.4 MB · sha 4f2a9c1',
      '',
      ' changelog : new auto-update engine (3.1)',
      '             panel update dengan UI baru (3.1)',
      '',
      ' run: update --apply   (requires root)'
    ]
  };

  var visibleItems = cmdItems.slice();
  var activeIndex = 0;

  function setActive(idx) {
    if (!visibleItems.length) return;
    activeIndex = (idx + visibleItems.length) % visibleItems.length;
    cmdItems.forEach(function (item) {
      item.setAttribute('aria-current', item === visibleItems[activeIndex] ? 'true' : 'false');
    });
    var active = visibleItems[activeIndex];
    if (visibleItems.length > 4) {
      active.scrollIntoView({ block: 'nearest' });
    }
  }

  function filterCommands() {
    var q = cmdInput.value.trim().toLowerCase();
    visibleItems = [];
    cmdItems.forEach(function (item) {
      var hay = (item.getAttribute('data-cmd') + ' ' + item.querySelector('.cmd__desc').textContent).toLowerCase();
      var match = !q || hay.indexOf(q) !== -1;
      item.parentElement.hidden = !match;
      if (match) visibleItems.push(item);
    });
    cmdEmpty.hidden = visibleItems.length > 0;
    $('#cmdEmptyTerm').textContent = cmdInput.value.trim() || '—';
    if (visibleItems.length) setActive(0);
  }

  function showOutput(cmd) {
    var lines = OUTPUTS[cmd] || ['command not found: ' + cmd, 'type "help" for the command list'];
    cmdOutputTitle.textContent = 'root@vps:~# ' + cmd;
    cmdOutBody.textContent = lines.join('\n');
    cmdOutput.hidden = false;
    cmdOutBody.scrollTop = 0;
    toast('Ran ' + cmd + ' (simulated)', 'info');
  }

  cmdInput.addEventListener('input', filterCommands);
  cmdInput.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(activeIndex + 1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(activeIndex - 1); }
    else if (e.key === 'Enter') {
      e.preventDefault();
      var q = cmdInput.value.trim();
      if (!q) {
        if (visibleItems[activeIndex]) {
          cmdInput.value = visibleItems[activeIndex].getAttribute('data-cmd');
          filterCommands();
        }
        return;
      }
      if (visibleItems.length) {
        showOutput(visibleItems[activeIndex].getAttribute('data-cmd'));
      } else {
        showOutput(q.split(/\s+/)[0]);
      }
    } else if (e.key === 'Escape') {
      cmdInput.value = '';
      filterCommands();
      cmdOutput.hidden = true;
    }
  });

  cmdItems.forEach(function (item) {
    item.addEventListener('click', function () {
      cmdInput.value = item.getAttribute('data-cmd');
      filterCommands();
      showOutput(item.getAttribute('data-cmd'));
    });
  });

  cmdForm.addEventListener('submit', function (e) {
    e.preventDefault();
    var q = cmdInput.value.trim();
    if (visibleItems.length) showOutput(visibleItems[activeIndex].getAttribute('data-cmd'));
    else if (q) showOutput(q.split(/\s+/)[0]);
  });

  $('#cmdClear').addEventListener('click', function () {
    cmdOutput.hidden = true;
    cmdInput.value = '';
    filterCommands();
    cmdInput.focus();
  });

  $('#cmdReset').addEventListener('click', function () {
    cmdInput.value = '';
    filterCommands();
    cmdInput.focus();
  });

  /* ---------------------------------------------------------------- log tail */
  var logLinesEl = $('#logLines');
  var logStream = $('#logStream');
  var logPause = $('#logPause');
  var logLive = $('#logLive');
  var logCount = $('#logCount');
  var logJump = $('#logJump');
  var paused = false;
  var logTimer = null;
  var LOG_LIMIT = 120;

  var SEED_LOGS = [
    ['INFO', 'xray', 'started inbound vmess-ws on :443 (TLS 1.3)'],
    ['INFO', 'ssh', 'accepted password for <span class="u">ali_vpn</span> from 175.139.11.42:51244'],
    ['INFO', 'wg0', 'peer <span class="u">kenzo-phone</span> handshake ok (12ms)'],
    ['WARN', 'sstp', 'certificate expires in 0d — service stopped'],
    ['INFO', 'trojan', 'tls handshake sni=sg1.kenzovpn.my alpn=h2'],
    ['INFO', 'cron', 'log cleaner: rotated 3 files, freed <span class="u">18.2 MB</span>'],
    ['ERROR', 'xray', 'user <span class="u">nadiah</span> quota exceeded (48.0/50 GB) — throttled'],
    ['INFO', 'l2tp', 'xl2tpd: session 1184 established 10.30.30.42'],
    ['WARN', 'sys', 'disk /dev/vda1 at 36% — threshold 80%'],
    ['INFO', 'bot', 'telegram bot-panel poll ok · 0 pending'],
    ['INFO', 'xray', 'stats flush: 4.2 GB in / 9.8 GB out (24h)'],
    ['INFO', 'ssh', 'dropbear reloaded after config sync']
  ];

  var POOL = [
    ['INFO', 'xray', 'accepted tcp:175.139.11.42:51288 -> :443'],
    ['INFO', 'ssh', 'new session for <span class="u">meimei</span> (pty)'],
    ['INFO', 'wg0', 'peer <span class="u">ali-laptop</span> keepalive 25s'],
    ['WARN', 'sys', 'load average 0.62 — above 0.50 soft threshold'],
    ['INFO', 'trojan', 'fallback to nginx :80 for probe path /'],
    ['INFO', 'cron', 'autokill: scanned 14 users, 0 multi-login'],
    ['ERROR', 'xray', 'tls alert: client hello mismatch on :8443 (1 drop)'],
    ['INFO', 'l2tp', 'pppd: chap auth ok for <span class="u">tokramli</span>'],
    ['INFO', 'bot', 'sent expiry reminder to 3 users'],
    ['INFO', 'ssh', 'accepted publickey for <span class="u">kenzo</span> from 10.0.0.4'],
    ['WARN', 'xray', 'grpc stream reset by peer (retry ok)'],
    ['INFO', 'xray', 'handler: <span class="u">zulkifli</span> 2.1 MB / 8.4 MB today'],
    ['INFO', 'sys', 'uptime check ok · memory 1.8/4.0 GB'],
    ['INFO', 'sstp', 'skipping health probe — unit inactive']
  ];

  function stamp(d) {
    return String(d.getHours()).padStart(2, '0') + ':' +
      String(d.getMinutes()).padStart(2, '0') + ':' +
      String(d.getSeconds()).padStart(2, '0');
  }

  function addLog(level, tag, msg, atTop) {
    var li = document.createElement('li');
    li.setAttribute('data-level', level);
    var cls = level === 'ERROR' ? 'error' : (level === 'WARN' ? 'warn' : 'info');
    li.innerHTML = '<span class="log__time">' + stamp(new Date()) + '</span>' +
      '<span class="log__tag log__tag--' + cls + '">' + level + '</span>' +
      '<span class="log__msg"></span>';
    li.querySelector('.log__msg').innerHTML = msg;
    if (atTop) logLinesEl.appendChild(li);
    else logLinesEl.appendChild(li);

    while (logLinesEl.children.length > LOG_LIMIT) logLinesEl.removeChild(logLinesEl.firstChild);
    logCount.textContent = logLinesEl.children.length;
    autoScroll();
  }

  function autoScroll() {
    var nearBottom = logStream.scrollHeight - logStream.scrollTop - logStream.clientHeight < 44;
    if (nearBottom) { logStream.scrollTop = logStream.scrollHeight; logJump.hidden = true; }
    else { logJump.hidden = false; }
  }

  function seedLogs() {
    logLinesEl.innerHTML = '';
    var base = Date.now() - SEED_LOGS.length * 4200;
    SEED_LOGS.forEach(function (row, i) {
      var li = document.createElement('li');
      li.setAttribute('data-level', row[0]);
      var cls = row[0] === 'ERROR' ? 'error' : (row[0] === 'WARN' ? 'warn' : 'info');
      var d = new Date(base + i * 4200);
      li.innerHTML = '<span class="log__time">' + stamp(d) + '</span>' +
        '<span class="log__tag log__tag--' + cls + '">' + row[0] + '</span>' +
        '<span class="log__msg">' + row[2] + '</span>';
      logLinesEl.appendChild(li);
    });
    logCount.textContent = logLinesEl.children.length;
    logStream.scrollTop = logStream.scrollHeight;
  }

  function tickLog() {
    var row = POOL[Math.floor(Math.random() * POOL.length)];
    addLog(row[0], row[1], row[2]);
  }

  function scheduleLog() {
    window.clearTimeout(logTimer);
    if (paused || reduceMotion) return;
    logTimer = window.setTimeout(function () {
      if (!paused) tickLog();
      scheduleLog();
    }, 4000 + Math.random() * 900);
  }

  logPause.addEventListener('click', function () {
    paused = !paused;
    logPause.setAttribute('aria-pressed', paused ? 'true' : 'false');
    logPause.textContent = paused ? 'resume' : 'pause';
    logLive.classList.toggle('is-paused', paused);
    logLive.innerHTML = '<i class="pill__dot" aria-hidden="true"></i>' + (paused ? 'PAUSED' : 'LIVE');
    if (paused) {
      window.clearTimeout(logTimer);
    } else {
      scheduleLog();
      toast('Log tail resumed', 'info');
    }
  });

  $('#logClear').addEventListener('click', function () {
    logLinesEl.innerHTML = '';
    logCount.textContent = '0';
    logJump.hidden = true;
    addLog('INFO', 'sys', 'log buffer cleared by <span class="u">kenzo</span>');
  });

  logJump.addEventListener('click', function () {
    logStream.scrollTop = logStream.scrollHeight;
    logJump.hidden = true;
  });

  logStream.addEventListener('scroll', function () {
    var nearBottom = logStream.scrollHeight - logStream.scrollTop - logStream.clientHeight < 44;
    if (nearBottom) logJump.hidden = true;
  }, { passive: true });

  seedLogs();
  scheduleLog();

  if (reduceMotion) {
    logLive.innerHTML = '<i class="pill__dot" aria-hidden="true"></i>STATIC';
    logLive.classList.add('is-paused');
    logPause.disabled = true;
    logPause.title = 'Live tail paused by reduced-motion preference';
  }

  /* ---------------------------------------------------------------- footer clock */
  var upStart = Date.now() - (12 * 86400 + 4 * 3600 + 33 * 60 + 12) * 1000;
  function renderUptime() {
    var s = Math.floor((Date.now() - upStart) / 1000);
    var d = Math.floor(s / 86400); s -= d * 86400;
    var h = Math.floor(s / 3600); s -= h * 3600;
    var m = Math.floor(s / 60); s -= m * 60;
    $('#footUptime').textContent = d + 'd ' + String(h).padStart(2, '0') + ':' +
      String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
  }
  renderUptime();
  window.setInterval(renderUptime, 1000);

  /* ---------------------------------------------------------------- misc UI */
  var latency = $('#latency');
  window.setInterval(function () {
    latency.textContent = (21 + Math.floor(Math.random() * 8)) + 'ms';
  }, 5200);

  var avatarBtn = $('#avatarBtn');
  avatarBtn.addEventListener('click', function () {
    var open = avatarBtn.getAttribute('aria-expanded') === 'true';
    avatarBtn.setAttribute('aria-expanded', open ? 'false' : 'true');
    toast(open ? 'Account menu closed' : 'kenzo · Lifetime · client #SG-01', 'info');
  });

  $('#clViewAll').addEventListener('click', function () {
    var btn = $('#clViewAll');
    var open = btn.getAttribute('aria-expanded') === 'true';
    btn.setAttribute('aria-expanded', open ? 'false' : 'true');
    $('#clOld').hidden = open;
    btn.firstChild.textContent = open ? 'View all ' : 'Collapse ';
  });

  $$('.menu-item').forEach(function (item) {
    item.addEventListener('click', function () {
      if (item.id === 'menuUpdate') return;
      toast('Opening menu ' + item.getAttribute('data-menu') + ' — ' + item.getAttribute('data-label') + ' (simulated)', 'info');
    });
  });

  /* ---------------------------------------------------------------- number dispatch (CLI-style) */
  // press digits anywhere (outside inputs) -> "Select menu :" prompt; Enter runs it.
  var numPrompt = $('#numPrompt');
  var numPromptVal = $('#numPromptVal');
  var numBuf = '';
  var numTimer = null;

  var SERVICE_BY_NUM = {
    '1': 'ssh', '2': 'xray', '3': 'trojan', '4': 'wireguard',
    '5': 'sstp', '6': 'l2tp', '7': 'shadowsocks'
  };

  function numPromptOpen() {
    numPrompt.hidden = false;
  }
  function numPromptClose() {
    numPrompt.hidden = true;
    numBuf = '';
    numPromptVal.textContent = '';
    window.clearTimeout(numTimer);
  }
  function numPromptRender() {
    numPromptVal.textContent = numBuf;
  }

  function dispatchNumber(n) {
    numPromptClose();
    var svc = SERVICE_BY_NUM[n];
    if (svc) {
      var card = document.querySelector('.svc-card[data-service="' + svc + '"]');
      if (card) { openDrawer(svc, card); }
      else { toast('Servis ' + n + ' tiada', 'warn'); }
      return;
    }
    if (n === '999') {
      openModal(document.getElementById('menuUpdate'));
      return;
    }
    var item = document.querySelector('.menu-item[data-menu="' + n + '"]');
    if (item) {
      if (n === '66') {
        var logEl = $('#logStream');
        logEl.scrollIntoView({ block: 'center', behavior: reduceMotion ? 'auto' : 'smooth' });
        logEl.focus({ preventScroll: true });
      }
      toast('Opening menu ' + n + ' — ' + item.getAttribute('data-label') + ' (simulated)', 'info');
      return;
    }
    toast('Tiada menu ' + n, 'warn');
  }

  document.addEventListener('keydown', function (e) {
    // ignore when typing in a real input/textarea or when a modal/drawer is open
    var t = e.target;
    var typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
    if (typing) return;
    if (modal.classList.contains('is-open') || drawer.classList.contains('is-open')) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;

    if (/^[0-9]$/.test(e.key)) {
      e.preventDefault();
      if (numPrompt.hidden) { numBuf = ''; numPromptOpen(); }
      numBuf += e.key;
      // cap length; dispatch immediately on single-digit service keys (1-7)
      if (numBuf.length > 3) numBuf = numBuf.slice(-3);
      numPromptRender();
      window.clearTimeout(numTimer);
      if (/^[1-7]$/.test(numBuf)) {
        // give a beat for a second digit (e.g. 55), then auto-run service keys
        numTimer = window.setTimeout(function () { dispatchNumber(numBuf); }, 900);
      }
      return;
    }

    if (e.key === 'Enter') {
      if (!numPrompt.hidden && numBuf !== '') { e.preventDefault(); dispatchNumber(numBuf); }
      return;
    }
    if (e.key === 'Backspace') {
      if (!numPrompt.hidden && numBuf !== '') {
        e.preventDefault();
        numBuf = numBuf.slice(0, -1);
        numPromptRender();
        if (numBuf === '') numPromptClose();
      }
      return;
    }
    if (e.key === 'Escape') {
      if (!numPrompt.hidden) { e.preventDefault(); numPromptClose(); }
      return;
    }
  }, true);

  /* expose a tiny hook for automated visual checks */
  window.__VPS_MENU__ = {
    services: SERVICES,
    openDrawer: openDrawer,
    closeDrawer: closeDrawer,
    openModal: openModal,
    closeModal: closeModal,
    toast: toast,
    statusMeta: statusMeta,
    setActiveService: function (key) { activeService = key; },
    getActiveService: function () { return activeService; },
    renderDrawer: renderDrawer,
    setTab: setTab
  };

  /* ===========================================================================
     LIVE MODE — connect to VPS panel API (api.js). When VPSAPI.available is
     false (file:// demo), the simulated behaviour above stays in effect.
     ========================================================================== */
  (function () {
    if (!window.VPSAPI || !window.VPSAPI.available) {
      showBanner(false);
      return;
    }
    showBanner(true);

    var API = window.VPSAPI;
    var loginScrim = $('#loginScrim');
    var loginForm = $('#loginForm');
    var loginPass = $('#loginPass');
    var loginError = $('#loginError');
    var loginSubmit = $('#loginSubmit');
    var authed = false;

    // service id -> (systemd unit, fallback pgrep pattern) used for restart
    var UNIT_MAP = {
      ssh: 'ssh', xray: 'xray', v2ray: 'v2ray', trojan: 'xray', 'trojan-go': 'trojan-go',
      wireguard: 'wg-quick@wg0', sstp: 'accel-ppp', l2tp: 'xl2tpd', pptp: 'pptpd',
      ss: 'shadowsocks-libev', ssr: 'ssrmu'
    };
    // card id -> api account svc key
    var ACCT_MAP = { ssh: 'ssh', xray: 'xray', trojan: 'xray', wireguard: 'wireguard', ss: 'ss', shadowsocks: 'ss' };

    function showBanner(live) {
      var topbar = $('#topbar');
      var b = document.createElement('div');
      b.className = 'conn-banner ' + (live ? 'conn-banner--live' : 'conn-banner--demo');
      var txt = live
        ? 'Live — bersambung ke VPS melalui <code class="mono">api.php</code>'
        : 'DEMO — data simulasi (buka panel melalui nginx untuk sambungan sebenar)';
      b.innerHTML = '<i class="conn-banner__dot" aria-hidden="true"></i><span>' + txt + '</span>';
      topbar.parentNode.insertBefore(b, topbar);
    }

    function showLogin() {
      loginScrim.hidden = false;
      loginError.hidden = true;
      loginPass.value = '';
      loginPass.focus();
    }
    function hideLogin() {
      loginScrim.hidden = true;
    }

    loginForm.addEventListener('submit', function (e) {
      e.preventDefault();
      loginError.hidden = true;
      loginSubmit.disabled = true;
      loginSubmit.textContent = 'Memeriksa…';
      API.login(loginPass.value).then(function () {
        authed = true;
        hideLogin();
        loadAll();
      }).catch(function (err) {
        loginError.textContent = err.message || 'Salah kata laluan';
        loginError.hidden = false;
        loginPass.select();
      }).finally(function () {
        loginSubmit.disabled = false;
        loginSubmit.textContent = 'Masuk';
      });
    });

    // ---- repopulate UI from live data ----
    function fmtBytes(n) {
      if (!n || n <= 0) return '—';
      var u = ['B','KB','MB','GB','TB']; var i = 0; var v = n;
      while (v >= 1024 && i < u.length - 1) { v /= 1024; i++; }
      return v.toFixed(v >= 100 ? 0 : 1) + ' ' + u[i];
    }
    function fmtUptime(sec) {
      var d = Math.floor(sec / 86400); sec -= d * 86400;
      var h = Math.floor(sec / 3600); sec -= h * 3600;
      var m = Math.floor(sec / 60);
      return (d ? d + 'd ' : '') + h + 'h ' + m + 'm';
    }

    function applySystem(sys) {
      if (sys.ip) {
        $('#serverIp').textContent = sys.ip;
        var ipBtn = document.querySelector('.ip-row .copy-btn');
        if (ipBtn) ipBtn.setAttribute('data-copy', sys.ip);
      }
      var domain = document.querySelector('.domain');
      if (domain && sys.domain) domain.textContent = sys.domain;
      var coreChip = document.querySelector('.chip--core');
      if (coreChip && sys.core) coreChip.textContent = sys.core;

      // meta grid
      var metaDds = $$('.meta-grid dd');
      if (sys.uptime_sec != null && metaDds[0]) metaDds[0].textContent = fmtUptime(sys.uptime_sec);
      if (sys.os && metaDds[1]) metaDds[1].textContent = sys.os;
      if (sys.kernel && metaDds[2]) metaDds[2].textContent = sys.kernel;
      if (sys.region && metaDds[3]) metaDds[3].textContent = sys.region;

      // KPIs
      var memPct = sys.mem.total > 0 ? Math.round(sys.mem.used / sys.mem.total * 100) : 0;
      var diskPct = sys.disk.total > 0 ? Math.round(sys.disk.used / sys.disk.total * 100) : 0;
      var cpuPct = sys.load && sys.load[0] != null ? Math.round(sys.load[0] * 100 / Math.max(1, sys.cpu_cores)) : 0;
      setKpi(0, cpuPct + '%', (sys.load ? sys.load[0].toFixed(2) : '—'), '/ ' + (sys.cpu_cores || 2) + ' core');
      setKpi(1, memPct + '%', (sys.mem.total > 0 ? (sys.mem.used/1073741824).toFixed(1) : '—'), '/ ' + (sys.mem.total/1073741824).toFixed(1) + ' GB');
      setKpi(2, diskPct + '%', (sys.disk.total > 0 ? (sys.disk.used/1073741824).toFixed(1) : '—'), '/ ' + (sys.disk.total/1073741824).toFixed(0) + ' GB');

      if (sys.update_available) {
        $('#menuUpdate').classList.remove('hidden');
      }
    }

    function setKpi(idx, pctText, valueText, unitText) {
      var kpis = $$('.kpi');
      if (!kpis[idx]) return;
      var kpi = kpis[idx];
      var pct = kpi.querySelector('.kpi__pct');
      var value = kpi.querySelector('.num');
      var unit = kpi.querySelector('.kpi__unit');
      if (pct) pct.textContent = pctText;
      if (value) { value.textContent = valueText; value.removeAttribute('data-count'); }
      if (unit) unit.textContent = unitText;
    }

    function applyServices(list) {
      var running = 0, total = 0;
      list.forEach(function (s) {
        var card = document.querySelector('.svc-card[data-service="' + s.id + '"]');
        var mapId = s.id === 'v2ray' ? 'xray' : (s.id === 'xray' ? 'xray' : s.id);
        if (!card && (s.id === 'xray' || s.id === 'v2ray')) {
          // core could be either; xray card is static
          card = document.querySelector('.svc-card[data-service="xray"]');
        }
        var status = !s.installed ? 'empty' : (s.running ? 'running' : 'stopped');
        var meta = statusMeta(status);
        if (card) {
          var pill = card.querySelector('.pill');
          if (pill) {
            pill.className = 'pill ' + meta.pill;
            pill.innerHTML = '<i class="pill__dot" aria-hidden="true"></i>' + meta.label;
          }
          card.classList.toggle('svc-card--stopped', status === 'stopped');
          card.classList.toggle('svc-card--empty', status === 'empty');
        }
        // keep the SERVICES object in sync so the drawer reflects live state
        var key = (s.id === 'xray' || s.id === 'v2ray') ? 'xray' : (s.id === 'shadowsocks-libev' ? 'shadowsocks' : s.id);
        if (SERVICES[key]) {
          SERVICES[key].status = status;
          SERVICES[key].systemd = s.unit + ' · ' + (s.running ? 'active (running)' : 'inactive');
          SERVICES[key].uptime = s.running ? 'up — live' : (s.installed ? 'stopped' : 'not installed');
        }
        if (s.installed) { total++; if (s.running) running++; }
      });
      $('#svcRunning').textContent = running;
      $('#svcTotal').textContent = total;
    }

    function applyAccounts(svc, list) {
      var key = svc;
      if (svc === 'xray' || svc === 'v2ray') key = 'xray';
      if (svc === 'ss') key = 'shadowsocks';
      if (!SERVICES[key]) return;
      SERVICES[key].accounts = list.map(function (a) {
        return {
          user: a.user, exp: a.exp || '—', days: a.days == null ? 999 : a.days,
          quota: a.quota || 0, used: a.used || '—', login: '—', online: !!a.online
        };
      });
      // update card user count
      var card = document.querySelector('.svc-card[data-service="' + key + '"]');
      if (card) {
        var b = card.querySelector('.svc-card__stat b');
        if (b) b.textContent = list.length || '—';
      }
      // refresh drawer if it's open on this service
      if (activeService === key) renderDrawer(SERVICES[key]);
    }

    // ---- Xray "Login" tab: registered users + active IPs + generated files ----
    var loginTab = $('#tab-login');
    var loginBody = $('#loginBody');
    var loginEmpty = $('#loginEmpty');

    function escHtml(s) {
      return String(s).replace(/[&<>"']/g, function (c) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
      });
    }

    function renderXrayLogin(data) {
      var users = (data && data.users) || [];
      if (!users.length) {
        loginBody.innerHTML = '';
        loginEmpty.hidden = false;
        $('#tabLoginCount').textContent = '0';
        return;
      }
      loginEmpty.hidden = true;
      $('#tabLoginCount').textContent = String(users.length);

      loginBody.innerHTML = '<div class="xlogin">' + users.map(function (u) {
        var online = u.online;
        var badge = online
          ? '<span class="xlogin__badge xlogin__badge--on">ONLINE</span>'
          : '<span class="xlogin__badge xlogin__badge--off">OFFLINE</span>';
        var expTxt = u.exp ? ('exp ' + u.exp + (u.days != null ? ' · ' + u.days + 'd' : '')) : '—';

        var ips = (u.ips && u.ips.length)
          ? u.ips.map(function (x) {
              return '<span class="xlogin__ip' + (x.online ? ' xlogin__ip--on' : '') + '">' + escHtml(x.ip) + '</span>';
            }).join('')
          : '<span class="xlogin__none">tiada IP aktif</span>';

        var files = (u.files && u.files.length)
          ? u.files.map(function (f) { return '<span class="xlogin__file mono">' + escHtml(f) + '</span>'; }).join('')
          : '<span class="xlogin__none">tiada fail</span>';

        return '<div class="xlogin__user">' +
          '<div class="xlogin__head">' +
            '<span class="xlogin__name mono">' + escHtml(u.user) + '</span>' +
            badge +
            '<span class="xlogin__exp mono">' + escHtml(expTxt) + '</span>' +
          '</div>' +
          '<div class="xlogin__row"><span class="xlogin__k mono">IP</span><span class="xlogin__ips">' + ips + '</span></div>' +
          '<div class="xlogin__row"><span class="xlogin__k mono">FILES</span><span class="xlogin__files">' + files + '</span></div>' +
        '</div>';
      }).join('') + '</div>';

      if (data.other && data.other.length) {
        loginBody.insertAdjacentHTML('beforeend',
          '<p class="drawer__note" style="margin-top:.8rem">Other IP (tidak padan user): <span class="mono">' +
          data.other.map(escHtml).join(', ') + '</span></p>');
      }
    }

    function refreshLoginTab() {
      var isXray = (activeService === 'xray' || activeService === 'trojan');
      loginTab.hidden = !isXray;
      if (!isXray) return;
      API.xrayDetail().then(function (r) {
        renderXrayLogin(r);
      }).catch(function () {
        loginBody.innerHTML = '';
        loginEmpty.hidden = false;
      });
    }

    // hook: whenever the drawer opens (card click, number key, API), refresh the Login tab
    var drawerEl = $('#drawer');
    var lastDrawerOpen = false;
    var drawerObserver = new MutationObserver(function () {
      var open = drawerEl.classList.contains('is-open');
      if (open && !lastDrawerOpen) {
        // read which service is active from the drawer title / exposed hook
        var key = (window.__VPS_MENU__.getActiveService && window.__VPS_MENU__.getActiveService()) || '';
        activeService = key;
        refreshLoginTab();
      }
      lastDrawerOpen = open;
    });
    drawerObserver.observe(drawerEl, { attributes: true, attributeFilter: ['class'] });

    function loadAccountsForVisible() {
      var seen = {};
      Object.keys(ACCT_MAP).forEach(function (cardId) {
        var svcKey = ACCT_MAP[cardId];
        if (seen[svcKey]) return; seen[svcKey] = true;
        API.accounts(svcKey).then(function (r) { applyAccounts(svcKey, r.accounts); }).catch(function () {});
      });
    }

    function loadAll() {
      API.system().then(applySystem).catch(function () { toast('Gagal ambil status sistem', 'warn'); });
      API.services().then(function (r) { applyServices(r.services); loadAccountsForVisible(); }).catch(function () {});
      // live log tail from real log file
      startLiveLog();
    }

    // ---- live log tail from /etc/log-create-user.log ----
    var logTimer = null, logPaused = false;
    function startLiveLog() {
      // replace the synthetic seed log with real tail (append-only view)
      $('#logLines').innerHTML = '';
      fetchLog();
      logTimer = window.setInterval(fetchLog, 5000);
      $('#logPause').addEventListener('click', function () {
        logPaused = !logPaused;
        if (logPaused) window.clearInterval(logTimer); else { fetchLog(); logTimer = window.setInterval(fetchLog, 5000); }
      });
    }
    function fetchLog() {
      API.logs(80, 'user').then(function (r) {
        var lines = (r.lines || []).map(function (ln) { return ln; });
        var el = $('#logLines');
        el.innerHTML = '';
        lines.forEach(function (ln) {
          if (!ln.trim()) return;
          var li = document.createElement('li');
          var lvl = /error|denied|fail/i.test(ln) ? 'ERROR' : (/warn/i.test(ln) ? 'WARN' : 'INFO');
          li.setAttribute('data-level', lvl);
          var cls = lvl === 'ERROR' ? 'error' : (lvl === 'WARN' ? 'warn' : 'info');
          li.innerHTML = '<span class="log__tag log__tag--' + cls + '">' + lvl + '</span>' +
            '<span class="log__msg"></span>';
          li.querySelector('.log__msg').textContent = ln;
          el.appendChild(li);
        });
        $('#logCount').textContent = el.children.length;
        var s = $('#logStream');
        s.scrollTop = s.scrollHeight;
      }).catch(function () {});
    }

    // ---- real management actions (capture phase overrides simulated) ----
    function liveAccountsHandler(e) {
      var btn = e.target.closest('.row-btn');
      if (!btn) return;
      e.stopPropagation();
      e.preventDefault();
      var user = btn.getAttribute('data-user');
      var act = btn.getAttribute('data-act');
      var svc = ACCT_MAP[activeService] || 'ssh';
      if (act === 'renew') {
        API.renewAccount(svc, user, 30).then(function () {
          toast('Renewed ' + user + ' · +30 hari', 'info');
          API.accounts(svc).then(function (r) { applyAccounts(svc, r.accounts); });
        }).catch(function (err) { toast(err.message, 'warn'); });
      } else if (act === 'delete') {
        if (!window.confirm('Padam akaun ' + user + '? Tindakan ini kekal.')) return;
        API.deleteAccount(svc, user).then(function () {
          toast('Akaun ' + user + ' dipadam', 'warn');
          API.accounts(svc).then(function (r) { applyAccounts(svc, r.accounts); });
        }).catch(function (err) { toast(err.message, 'warn'); });
      }
    }
    document.addEventListener('click', liveAccountsHandler, true);

    var svcRestartBtn = $('#svcRestart');
    svcRestartBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      var unit = UNIT_MAP[activeService];
      if (!unit) { toast('Tiada unit untuk servis ini', 'warn'); return; }
      API.restartService(unit).then(function (r) {
        toast(r.ok ? 'Servis ' + unit + ' restart' : (r.message || 'Gagal restart'), r.ok ? 'info' : 'warn');
        API.services().then(function (res) { applyServices(res.services); });
      }).catch(function (err) { toast(err.message, 'warn'); });
    }, true);

    var addUserBtn = $('#addUserBtn');
    var SVCS_MANAGED = { ssh: 'ssh', xray: 'xray', trojan: 'xray', wireguard: 'wireguard', ss: 'ss', shadowsocks: 'ss' };
    addUserBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      var svcKey = SVCS_MANAGED[activeService];
      if (!svcKey) {
        toast('Tambah user untuk ' + activeService + ' belum disokong (guna CLI)', 'warn');
        return;
      }
      var user = window.prompt('Username baru (' + svcKey + '):');
      if (!user) return;
      var days = parseInt(window.prompt('Tempoh (hari):', '30'), 10) || 30;
      var payload = { user: user, days: days };
      if (svcKey === 'ssh') {
        var pw = window.prompt('Password (kosong = auto):', '');
        if (pw) payload.password = pw;
      }
      API.createAccount(svcKey, payload).then(function (r) {
        var extra = svcKey === 'ss' && r.ports ? ' · port ' + r.ports.tls + '/' + r.ports.http : '';
        toast('User ' + r.user + ' dicipta · tamat ' + (r.exp || days + 'd') + extra, 'info');
        API.accounts(svcKey).then(function (res) { applyAccounts(svcKey, res.accounts); });
      }).catch(function (err) { toast(err.message, 'warn'); });
    }, true);

    // session check on load
    API.session().then(function (r) {
      if (r && r.authed) { authed = true; loadAll(); }
      else { showLogin(); }
    }).catch(function () {
      // api unreachable — stay in demo with a note
      showBanner(false);
      toast('API tidak dapat dihubungi — data simulasi', 'warn');
    });

    // mark the connection indicator as live
    var conn = document.querySelector('.conn');
    if (conn) conn.classList.add('is-live');
  })();
})();

