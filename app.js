/* MoneyTrack screens. Logic lives in core.js. */
(function () {
  'use strict';

  var SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbw_GaONuNDMJ_bg3dfXyyqlMYgwU5DVXplSPG3gUaEeYgHjwyWdwFVF4ygzCQmlorUy2g/exec';
  var VERSION = '1.2';
  var NEED_SCRIPT = 3;          // the script version this app expects
  var LOGIN_SYNC_MS = 8000;     // how long sign-in waits for the first sync

  var vault = MT.makeVault(window.localStorage);
  var post = MT.makePost(SCRIPT_URL, function (u, o) { return window.fetch(u, o); });
  var app = document.getElementById('app');

  var S = {
    unlocked: false, db: null, key: null, password: null,
    view: 'home', ym: MT.monthOf(MT.todayStr()),
    hist: { type: '', category: '', wallet: '', q: '' },
    rscope: 'month', rm: MT.monthOf(MT.todayStr()), ry: MT.todayStr().slice(0, 4), rsel: null,
    form: null, editId: null, formErr: '', confirmDelete: false,
    wtab: 'loans', person: null, lf: null, lEditId: null, lback: 'worth', lErr: '', af: null, aEditId: null, aErr: '',
    syncing: false, syncError: '', syncErrorText: '', syncAgain: false, enter: false,
    lockMsg: '', busy: false, resetAsk: false, confirmReset: false, pwErr: ''
  };

  // ------------------------------------------------------------ small helpers

  var ICONS = {
    home: '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>',
    list: '<line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>',
    plus: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
    chart: '<line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>',
    sliders: '<line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/>',
    lock: '<rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
    eye: '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>',
    eyeoff: '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>',
    left: '<polyline points="15 18 9 12 15 6"/>',
    right: '<polyline points="9 18 15 12 9 6"/>',
    swap: '<polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>',
    out: '<line x1="7" y1="17" x2="17" y2="7"/><polyline points="7 7 17 7 17 17"/>',
    inn: '<line x1="17" y1="7" x2="7" y2="17"/><polyline points="17 17 7 17 7 7"/>',
    external: '<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>',
    alert: '<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>',
    sheet: '<rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
    key: '<circle cx="8" cy="15" r="4"/><line x1="10.85" y1="12.15" x2="21" y2="2"/><line x1="18" y1="5" x2="21" y2="8"/>',
    clock: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
    trash: '<polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/>',
    refresh: '<polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>',
    chev: '<polyline points="6 9 12 15 18 9"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h0a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h0a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v0a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
    worth: '<path d="M12 2l9 5-9 5-9-5z"/><path d="M3 12l9 5 9-5"/><path d="M3 17l9 5 9-5"/>',
    people: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    plus2: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>'
  };
  function ic(name) { return '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true">' + ICONS[name] + '</svg>'; }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function $(sel) { return app.querySelector(sel); }
  function money(n) { return MT.fmtMoney(n); }
  function plain(n) { return MT.fmtMoney(n).replace('৳ ', ''); }
  function hidden() { return !!(S.db && S.db.settings.hideBalance); }
  function secret(n) { return hidden() ? '৳ ••••' : money(n); }
  function short(n) {
    n = Math.abs(n);
    if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
    if (n >= 1e4) return Math.round(n / 1e3) + 'K';
    if (n >= 1e3) return (n / 1e3).toFixed(1).replace(/\.0$/, '') + 'K';
    return String(Math.round(n));
  }

  function normDigits(s) {   // Bengali digits to 0-9
    return String(s).replace(/[০-৯]/g, function (d) { return String(d.charCodeAt(0) - 0x09E6); });
  }
  function num(s) {
    var t = normDigits(s).replace(/[,\s]/g, '');
    return t === '' ? NaN : Number(t);
  }

  var EMOJI = {
    food: '🍽️', transport: '🚌', education: '📚', bills: '🧾', medical: '💊', shopping: '🛍️', other: '📦',
    salary: '💼', freelance: '💻', gift: '🎁', 'transfer fee': '💸', rent: '🏠', groceries: '🛒', fuel: '⛽',
    mobile: '📱', internet: '🌐', travel: '✈️', health: '💊', entertainment: '🎬', charity: '🤲', donation: '🤲', family: '👪'
  };
  function emojiFor(name) { return EMOJI[String(name || '').toLowerCase()] || ''; }

  function hueOf(name) {
    var h = 0;
    for (var i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
    return h;
  }
  function catBubble(name, small) {
    var n = name || '?';
    return '<span class="bubble' + (small ? ' sm' : '') + '" style="--h:' + hueOf(n) + '" aria-hidden="true">' +
      (emojiFor(n) || esc(Array.from(n)[0].toUpperCase())) + '</span>';
  }
  function personBubble(name, small) {
    var n = String(name || '?').trim() || '?';
    return '<span class="bubble' + (small ? ' sm' : '') + '" style="--h:' + hueOf(n.toLowerCase()) + '" aria-hidden="true">' + esc(Array.from(n)[0].toUpperCase()) + '</span>';
  }
  function bubble(t, small) {
    if (t.type === 'transfer') return '<span class="bubble' + (small ? ' sm' : '') + '" style="--h:215" aria-hidden="true">' + ic('swap') + '</span>';
    if (MT.isLoanType(t.type)) return personBubble(t.person, small);
    return catBubble(t.category, small);
  }

  // Each group keeps its own colour: Cash amber, MFS pink, Bank blue, then violet and grey.
  // Accounts in the same group are lighter shades of it.
  function groupColor(g) {
    var k = String(g).toLowerCase();
    if (k === 'cash') return 'var(--w-cash)';
    if (k === 'mfs') return 'var(--w-mfs)';
    if (k === 'bank') return 'var(--w-bank)';
    var others = [];
    S.db.wallets.forEach(function (w) { var x = MT.groupOfWallet(w); if (MT.GROUP_ORDER.indexOf(x) < 0 && others.indexOf(x) < 0) others.push(x); });
    return others.indexOf(g) === 0 ? 'var(--w-x)' : 'var(--w-n)';
  }
  function wcolor(name) {
    var g = MT.groupOf(S.db, name), base = groupColor(g);
    var mates = S.db.wallets.filter(function (w) { return MT.groupOfWallet(w) === g; }).map(function (w) { return w.name; });
    var idx = mates.indexOf(name);
    if (idx <= 0) return base;
    return 'color-mix(in srgb,' + base + ' ' + Math.max(40, 100 - idx * 24) + '%,#fff)';
  }

  var SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function shortDate(d) {
    var p = d.split('-').map(Number);
    return p[2] + ' ' + SHORT_MONTHS[p[1] - 1];
  }

  function timeAgo(iso) {
    if (!iso) return 'Never';
    var m = Math.round((Date.now() - Date.parse(iso)) / 60000);
    if (m < 1) return 'Just now';
    if (m < 60) return m + ' min ago';
    if (m < 1440) return Math.round(m / 60) + ' h ago';
    return MT.dayLabel(MT.todayStr(new Date(iso)));
  }

  var toastTimer = null;
  function toast(msg) {
    var el = document.getElementById('toast');
    el.textContent = msg;
    el.classList.add('on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove('on'); }, 2800);
  }

  // ------------------------------------------------------------ saving and syncing

  var saveChain = Promise.resolve();
  function persist() {
    var db = S.db, key = S.key;
    if (!db || !key) return saveChain;
    saveChain = saveChain.then(function () { return vault.save(key, db); }).catch(function () {
      toast('Could not save on this device. Storage may be full.');
    });
    return saveChain;
  }

  function errorText(r) {
    var d = r.detail || {};
    switch (r.error) {
      case 'wrong_password':
        return 'Wrong password' + (typeof d.attemptsLeft === 'number' ? '. ' + d.attemptsLeft + ' attempt' + (d.attemptsLeft === 1 ? '' : 's') + ' left.' : '.');
      case 'locked': return 'Too many wrong attempts. Try again in ' + (d.retryMinutes || 15) + ' minutes.';
      case 'not_configured': return 'The script has no PASSWORD yet. Add it in the script’s Script properties.';
      case 'no_sheet': return 'The Transactions tab is missing. Run setup in the script.';
      case 'no_spreadsheet': return 'The script is not attached to your Google Sheet. Open it from the sheet (Extensions, then Apps Script), or add a SHEET_ID script property.';
      case 'write_failed': return 'The sheet did not keep the new rows. Nothing is lost: they are still on this device and will be sent again.';
      case 'bad_response': return 'The script’s answer was unexpected. Check that access is set to Anyone and that you deployed the latest version.';
      case 'server': return 'The script reported a problem: ' + (d.message || 'unknown');
      default: return 'Something went wrong (' + (r.error || 'unknown') + ').';
    }
  }

  function rejectText(code) {
    return ({
      bad_date: 'the date is not valid', bad_amount: 'the amount is not valid', bad_wallet: 'no account was set',
      bad_toWallet: 'the destination account is missing or the same as the source', bad_category: 'no category was set',
      bad_type: 'the type is not valid', bad_id: 'the entry id is not valid', bad_updatedAt: 'the edit time is not valid', bad_fee: 'the charge is not valid',
      bad_person: 'the person’s name is missing', bad_due: 'the due date is not valid', bad_name: 'the name is missing', bad_value: 'the value is not valid'
    })[code] || code;
  }

  var syncTimer = null;
  function scheduleSync(ms) {
    clearTimeout(syncTimer);
    syncTimer = setTimeout(function () { doSync(false); }, ms || 600);
  }

  async function doSync(manual) {
    if (!S.unlocked) return;
    if (S.syncing) { S.syncAgain = true; return; }
    if (!navigator.onLine) { renderStatus(); if (manual) toast('You’re offline. It will sync when you’re back online.'); return; }
    var db = S.db, key = S.key, pw = S.password;
    S.syncing = true; S.syncError = '';
    renderStatus();
    try {
      var r = await MT.runSync(db, pw, post);
      if (!r.ok) {
        S.syncError = r.error === 'wrong_password' ? 'wrong_password' : (r.error || 'error');
        S.syncErrorText = errorText(r);
      } else {
        S.syncError = '';
      }
    } catch (e) {
      S.syncError = 'network';
      S.syncErrorText = 'Couldn’t reach the sheet. Your entries are safe on this device and will be sent when it answers.';
    }
    S.syncing = false;
    if (key) { vault.save(key, db).catch(function () {}); }
    if (S.unlocked && S.db === db) {
      if (manual && !S.syncError) {
        toast(db.sheet ? 'Synced · ' + db.sheet.live + ' entr' + (db.sheet.live === 1 ? 'y' : 'ies') + ' in your sheet' : 'Synced');
      }
      refreshAfterSync();
      if (S.syncAgain) { S.syncAgain = false; scheduleSync(300); }
    }
  }

  function refreshAfterSync() {
    if (!document.getElementById('view')) return;   // still on the sign-in screen
    renderStatus();
    if (S.view === 'history') renderHistoryBody();
    else if (['home', 'reports', 'settings', 'worth', 'person'].indexOf(S.view) >= 0) renderView();
  }

  window.addEventListener('online', function () { renderStatus(); if (S.unlocked) scheduleSync(300); });
  window.addEventListener('offline', function () { renderStatus(); });
  setInterval(function () {
    if (S.unlocked && !document.hidden && navigator.onLine) doSync(false);
  }, 5 * 60 * 1000);

  // ------------------------------------------------------------ lock and unlock

  var idleTimer = null, hiddenAt = 0;
  function lockMinutes() { return S.db ? S.db.settings.autoLock : 5; }

  function resetIdle() {
    clearTimeout(idleTimer);
    if (!S.unlocked) return;
    var m = lockMinutes() || 5;
    idleTimer = setTimeout(function () { lockNow(); }, m * 60000);
  }
  ['pointerdown', 'keydown', 'scroll', 'touchstart'].forEach(function (ev) {
    document.addEventListener(ev, function () { if (S.unlocked) resetIdle(); }, { passive: true });
  });
  document.addEventListener('visibilitychange', function () {
    if (!S.unlocked) return;
    if (document.hidden) {
      hiddenAt = Date.now();
      if (lockMinutes() === 0) lockNow();
    } else {
      if (hiddenAt && Date.now() - hiddenAt >= lockMinutes() * 60000) lockNow();
      else { resetIdle(); if (navigator.onLine && document.getElementById('view')) scheduleSync(400); }
      hiddenAt = 0;
    }
  });

  function lockNow() {
    clearTimeout(idleTimer); clearTimeout(syncTimer); clearTimeout(toastTimer);
    var tEl = document.getElementById('toast'); if (tEl) tEl.classList.remove('on');
    S.unlocked = false; S.db = null; S.key = null; S.password = null;
    S.form = null; S.editId = null; S.view = 'home'; S.lockMsg = ''; S.resetAsk = false; S.syncError = '';
    S.lf = null; S.lEditId = null; S.af = null; S.aEditId = null; S.person = null; S.wtab = 'loans'; S.lErr = ''; S.aErr = '';
    S.confirmReset = false; S.confirmDelete = false; S.syncing = false; S.enter = false; S.rsel = null;
    S.hist = { type: '', category: '', wallet: '', q: '' };
    S.ym = MT.monthOf(MT.todayStr());
    S.rscope = 'month'; S.rm = S.ym; S.ry = MT.todayStr().slice(0, 4);
    render();
  }

  function throttleLeft() {
    try {
      var t = JSON.parse(localStorage.getItem('mt_throttle') || 'null');
      if (t && t.until > Date.now()) return Math.ceil((t.until - Date.now()) / 1000);
    } catch (e) { /* ignore */ }
    return 0;
  }
  function noteFail() {
    var t = { n: 0, until: 0 };
    try { t = JSON.parse(localStorage.getItem('mt_throttle') || 'null') || t; } catch (e) { /* ignore */ }
    t.n = (t.n || 0) + 1;
    var left = 5 - t.n;
    if (t.n >= 5) { t.until = Date.now() + 60000; t.n = 0; }
    localStorage.setItem('mt_throttle', JSON.stringify(t));
    return left;
  }
  function clearThrottle() { localStorage.removeItem('mt_throttle'); }

  function setLockMsg(msg) {
    S.lockMsg = msg;
    var el = document.getElementById('lockErr');
    if (el) el.textContent = msg;
  }
  function setLockBusy(b, label) {
    var btn = document.getElementById('lockBtn');
    if (!btn) return;
    btn.disabled = b;
    btn.textContent = b ? (label || (vault.exists() ? 'Unlocking…' : 'Connecting…')) : (vault.exists() ? 'Unlock' : 'Connect');
  }
  function setLockHint(t) {
    var el = document.querySelector('.lock .hint');
    if (el) el.textContent = t;
  }

  // Opens the app. When online, the first sync happens as part of signing in,
  // so the home screen already shows what the sheet and your other devices hold.
  async function beginSession(db, key, pw, alreadySynced) {
    S.db = db; S.key = key; S.password = pw; S.unlocked = true;
    S.view = 'home'; S.lockMsg = ''; S.syncError = ''; S.enter = true;
    resetIdle();
    if (!alreadySynced && navigator.onLine) {
      setLockBusy(true, 'Syncing…');
      setLockHint('Signed in. Syncing your latest entries…');
      await Promise.race([doSync(false), new Promise(function (r) { setTimeout(r, LOGIN_SYNC_MS); })]);
    }
    if (!S.unlocked) return;   // locked again while waiting
    render();
  }

  async function onLockSubmit() {
    if (S.busy) return;
    var pw = document.getElementById('pw').value;
    if (!pw) { setLockMsg('Enter your password'); return; }
    var wait = throttleLeft();
    if (wait > 0) { setLockMsg('Too many attempts. Try again in ' + wait + ' seconds.'); return; }
    S.busy = true; setLockMsg(''); setLockBusy(true);
    try {
      if (vault.exists()) {
        var opened = null;
        try { opened = await vault.open(pw); } catch (e) { opened = null; }
        if (!opened) {
          var left = noteFail();
          setLockMsg(left > 0 ? 'Wrong password. ' + left + ' attempt' + (left === 1 ? '' : 's') + ' left.' : 'Too many attempts. Try again in 60 seconds.');
        } else {
          clearThrottle();
          await beginSession(opened.db, opened.key, pw, false);
        }
      } else {
        if (!navigator.onLine) { setLockMsg('No internet. The first sign-in on a device needs internet.'); return; }
        var db = MT.emptyDb();
        var r;
        try { r = await MT.runSync(db, pw, post); }
        catch (e) { setLockMsg('Couldn’t reach the sheet. Check your internet and try again.'); return; }
        if (!r.ok) { setLockMsg(errorText(r)); return; }
        var key = await vault.create(pw, db);
        await beginSession(db, key, pw, true);
      }
    } finally {
      S.busy = false; setLockBusy(false);
    }
  }

  var LOGO = '<svg viewBox="0 0 48 48" aria-hidden="true"><rect x="8" y="27" width="8" height="13" rx="2.5" fill="#8de3c3"/><rect x="20" y="19" width="8" height="21" rx="2.5" fill="#8de3c3"/><rect x="32" y="8" width="8" height="32" rx="2.5" fill="#fff"/></svg>';

  function renderLock() {
    document.body.classList.add('locked');
    var setup = !vault.exists();
    var online = navigator.onLine;
    var hint = setup
      ? 'Use the password you set in the script. The first sign-in on a device needs internet.'
      : (online ? 'When you’re online, signing in also syncs your entries.' : 'You’re offline. Unlocking still works.');
    var h = '<form class="lock" id="lockForm" autocomplete="off" novalidate>' +
      '<div class="logo">' + LOGO + '</div>' +
      '<h1>MoneyTrack</h1>' +
      '<p class="sub">' + (setup ? 'Set up this device' : 'Enter your password to unlock') + '</p>' +
      '<div class="pw"><input id="pw" type="password" placeholder="Password" autocomplete="current-password" autocapitalize="off" spellcheck="false" aria-label="Password">' +
      '<button type="button" class="eye" data-act="eye" aria-label="Show password">' + ic('eye') + '</button></div>' +
      '<p class="err" id="lockErr" role="alert">' + esc(S.lockMsg) + '</p>' +
      '<button class="btn primary block" id="lockBtn" type="submit">' + (setup ? 'Connect' : 'Unlock') + '</button>' +
      '<p class="hint">' + esc(hint) + '</p>';
    if (!setup) {
      if (!S.resetAsk) h += '<button type="button" class="link" data-act="reset-ask">Forgot password?</button>';
      else h += '<div class="banner warn">Resetting removes this device’s copy, including anything not yet synced. Your sheet keeps everything else, and you sign in again with the sheet’s password.</div>' +
        '<button type="button" class="btn danger block" data-act="reset-do">Reset this device</button>';
    }
    h += '</form>';
    app.innerHTML = h;
    var pwEl = document.getElementById('pw');
    if (pwEl) pwEl.focus();
  }

  // ------------------------------------------------------------ shell

  var TITLES = { home: 'MoneyTrack', history: 'History', add: 'Add transaction', reports: 'Reports', settings: 'Settings', password: 'Change password',
    worth: 'Net worth', person: 'Loan', loan: 'Loan entry', asset: 'Asset' };

  function render() {
    if (!S.unlocked) { renderLock(); return; }
    document.body.classList.remove('locked');
    if (!document.getElementById('view')) {
      app.innerHTML = '<div id="top"><div><h1 id="title"></h1><small id="sub"></small></div><div class="topr"><button class="pill" id="pill" data-act="pill"></button>' +
        '<button class="gear" data-go="settings" data-nav="settings" aria-label="Settings">' + ic('gear') + '</button></div></div>' +
        '<main id="view"></main>' +
        '<nav id="nav" aria-label="Main">' +
        navBtn('home', 'Home', 'home') + navBtn('history', 'History', 'list') +
        '<button class="add" data-go="add" data-nav="add" aria-label="Add transaction"><span class="sq">' + ic('plus') + '</span><span>Add</span></button>' +
        navBtn('worth', 'Worth', 'worth') + navBtn('reports', 'Reports', 'chart') + '</nav>';
    }
    renderView();
  }
  function navBtn(go, label, icon) {
    return '<button data-go="' + go + '" data-nav="' + go + '">' + ic(icon) + '<span>' + label + '</span></button>';
  }

  function renderView() {
    if (!S.unlocked || !document.getElementById('view')) return;
    var title = S.view === 'add' && S.editId ? 'Edit transaction' : S.view === 'loan' && S.lEditId ? 'Edit loan entry' : S.view === 'asset' && S.aEditId ? 'Edit asset' : TITLES[S.view];
    if (S.view === 'person') { var pp = personFind(S.person); title = pp ? pp.name : 'Loan'; }
    document.getElementById('title').textContent = title;
    document.getElementById('sub').textContent = S.view === 'home' ? MT.monthLabel(MT.monthOf(MT.todayStr())) : '';
    document.getElementById('sub').style.display = S.view === 'home' ? 'block' : 'none';
    var html = '';
    if (S.view === 'home') html = homeView();
    else if (S.view === 'history') html = historyView();
    else if (S.view === 'add') html = addView();
    else if (S.view === 'reports') html = reportsView();
    else if (S.view === 'settings') html = settingsView();
    else if (S.view === 'password') html = passwordView();
    else if (S.view === 'worth') html = worthView();
    else if (S.view === 'person') html = personView();
    else if (S.view === 'loan') html = loanView();
    else if (S.view === 'asset') html = assetView();
    document.getElementById('view').innerHTML = html;
    if (S.view === 'home') S.enter = false;
    var navKey = S.view === 'password' ? 'settings' : (['person', 'loan', 'asset'].indexOf(S.view) >= 0 ? 'worth' : S.view);
    app.querySelectorAll('[data-nav]').forEach(function (b) {
      if (b.getAttribute('data-nav') === navKey) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
    });
    renderStatus();
  }

  function statusInfo() {
    var p = MT.pendingCount(S.db), bad = MT.rejectedTx(S.db).length + MT.rejectedAssets(S.db).length;
    if (S.syncing) return { t: 'Syncing…', c: '' };
    if (S.syncError) return { t: 'Sync problem', c: 'bad' };
    if (bad) return { t: bad + ' not saved', c: 'bad' };
    if (!navigator.onLine) return { t: p ? 'Offline · ' + p + ' pending' : 'Offline', c: 'warn' };
    if (p) return { t: p + ' pending', c: 'warn' };
    return { t: 'Synced', c: '' };
  }
  function renderStatus() {
    var el = document.getElementById('pill');
    if (!el || !S.db) return;
    var s = statusInfo();
    el.textContent = s.t;
    el.className = 'pill' + (s.c ? ' ' + s.c : '');
  }

  function syncBanners() {
    var html = '';
    if (S.syncError === 'wrong_password') {
      html += '<div class="banner bad">' + ic('alert') + '<span>The sheet no longer accepts this password. <button class="link" data-act="to-password">Change password</button></span></div>';
    } else if (S.syncError) {
      html += '<div class="banner bad">' + ic('alert') + '<span>' + esc(S.syncErrorText || 'Sync problem') + '</span></div>';
    }
    var bad = MT.rejectedTx(S.db).concat(MT.rejectedAssets(S.db));
    if (bad.length) {
      html += '<div class="banner bad">' + ic('alert') + '<span>' + bad.length + ' entr' + (bad.length === 1 ? 'y was' : 'ies were') +
        ' not accepted by the sheet, so ' + (bad.length === 1 ? 'it is' : 'they are') + ' not in it yet. <button class="link" data-act="review">Fix ' + (bad.length === 1 ? 'it' : 'the first one') + '</button></span></div>';
    }
    return html;
  }

  // ------------------------------------------------------------ home

  function txRow(t, showDate) {
    var isT = t.type === 'transfer', isL = MT.isLoanType(t.type);
    var title = isT ? t.wallet + ' → ' + t.toWallet : isL ? t.person : t.category;
    var kind = isT ? 'Transfer' : isL ? MT.LOAN_LABEL[t.type] + ' · ' + t.wallet : t.wallet;
    var sub = (showDate ? shortDate(t.date) + ' · ' : '') + kind + (t.note ? ' · ' + t.note : '');
    var amt;
    if (t.type === 'income') amt = '<span class="pos">+ ' + money(t.amount) + '</span>';
    else if (t.type === 'expense') amt = '<span class="exp">- ' + money(t.amount) + '</span>';
    else if (isL) amt = '<span>' + (t.type === 'borrow' || t.type === 'collect' ? '+ ' : '- ') + money(t.amount) + '</span>';
    else amt = '<span>' + money(t.amount) + '</span>' + (t.fee > 0 ? '<small>Fee ' + money(t.fee) + '</small>' : '');
    var flag = t.syncError ? '<span class="dot bad" title="Not accepted by the sheet: ' + esc(rejectText(t.syncError)) + '"></span>'
      : (t.dirty ? '<span class="dot" title="Not synced yet"></span>' : '');
    return '<button class="tx" data-edit="' + esc(t.id) + '">' + bubble(t) +
      '<span class="txm"><b>' + esc(title) + flag + '</b><small>' + esc(sub) + '</small></span>' +
      '<span class="txa">' + amt + '</span></button>';
  }

  function spineHtml(groups) {
    var pos = groups.filter(function (g) { return g.total > 0; });
    var total = pos.reduce(function (a, g) { return a + g.total; }, 0);
    if (!total) return '<div class="spine empty" aria-hidden="true"></div>';
    return '<div class="spine' + (S.enter ? ' enter' : '') + '" role="img" aria-label="Share of your money in each wallet">' +
      pos.map(function (g) { return '<i style="flex:' + g.total + ';background:' + groupColor(g.name) + '"></i>'; }).join('') + '</div>';
  }

  function homeView() {
    var db = S.db, b = MT.balances(db), today = MT.todayStr();
    var s = MT.monthSummary(db, MT.monthOf(today), today);
    var recent = MT.filterTx(db, {}).slice(0, 5);
    var html = syncBanners();
    var shown = b.wallets.filter(function (w) { return w.active || w.balance !== 0; });
    var groups = MT.groupWallets(shown);
    var posTotal = groups.reduce(function (a, g) { return a + (g.total > 0 ? g.total : 0); }, 0);
    function share(v) { return posTotal > 0 && v > 0 ? Math.round(v / posTotal * 100) + '%' : ''; }

    html += '<section class="hero"><div class="hero-top"><span class="lbl">Total balance</span>' +
      '<button class="eye" data-act="hide" aria-label="' + (hidden() ? 'Show balances' : 'Hide balances') + '">' + ic(hidden() ? 'eyeoff' : 'eye') + '</button></div>' +
      '<p class="big num">' + secret(b.total) + '</p>' +
      '<div class="month"><span class="in">In this month <b>' + money(s.income) + '</b></span><span>Spent <b>' + money(s.expense) + '</b></span></div>';
    if (groups.length) {
      html += spineHtml(groups) + '<div class="skey">' + groups.map(function (g) {
        var pct = share(g.total);
        return '<span><i style="background:' + groupColor(g.name) + '"></i>' + esc(g.name) + (pct ? ' ' + pct : '') + '</span>';
      }).join('') + '</div>';
    }
    html += '</section>';

    html += '<div class="quick">' +
      '<button class="q-exp" data-quick="expense">' + ic('out') + 'Expense</button>' +
      '<button class="q-inc" data-quick="income">' + ic('inn') + 'Income</button>' +
      '<button class="q-tr" data-quick="transfer">' + ic('swap') + 'Transfer</button></div>';

    var multi = groups.filter(function (g) { return !(g.wallets.length === 1 && g.wallets[0].name.toLowerCase() === g.name.toLowerCase()); });
    var folded = db.settings.collapsed || {};
    var allFolded = multi.length > 0 && multi.every(function (g) { return folded[g.name]; });
    html += '<div class="sec-h"><h2>Where your money is</h2>' +
      (multi.length ? '<button class="link" data-gall="' + (allFolded ? 'open' : 'close') + '">' + (allFolded ? 'Expand all' : 'Collapse all') + '</button>' : '') + '</div>';
    if (!groups.length) html += '<p class="note">No accounts yet. Sync to load them from your sheet.</p>';
    else html += '<div class="sheet wallets">' + groups.map(function (g) {
      var single = g.wallets.length === 1 && g.wallets[0].name.toLowerCase() === g.name.toLowerCase();
      if (single) {
        var w = g.wallets[0];
        return '<button class="wrow" data-wallet-go="' + esc(w.name) + '"><i class="wdot" style="background:' + groupColor(g.name) + '"></i>' +
          '<span class="wn">' + esc(w.name) + '</span><span class="wshare">' + share(w.balance) + '</span>' +
          '<b class="wb' + (w.balance < 0 ? ' neg' : '') + '">' + secret(w.balance) + '</b></button>';
      }
      var closed = !!folded[g.name];
      return '<div class="gblock' + (closed ? ' closed' : '') + '"><button type="button" class="ghrow" data-gtoggle="' + esc(g.name) + '" aria-expanded="' + (!closed) + '">' +
        '<span class="chev" aria-hidden="true">' + ic('chev') + '</span>' +
        '<i class="wdot" style="background:' + groupColor(g.name) + '"></i><span class="wn">' + esc(g.name) +
        (closed ? '<small class="cnt">' + g.wallets.length + ' accounts</small>' : '') + '</span>' +
        '<span class="wshare">' + share(g.total) + '</span><b class="wb' + (g.total < 0 ? ' neg' : '') + '">' + secret(g.total) + '</b></button>' +
        (closed ? '' : g.wallets.map(function (w) {
          return '<button class="wrow acct" data-wallet-go="' + esc(w.name) + '"><i class="wdot sm" style="background:' + wcolor(w.name) + '"></i>' +
            '<span class="wn">' + esc(w.name) + '</span><b class="wb' + (w.balance < 0 ? ' neg' : '') + '">' + secret(w.balance) + '</b></button>';
        }).join('')) + '</div>';
    }).join('') + '</div>';

    // loans and assets at a glance
    var L = MT.loanLedger(db, today).totals, A = MT.assetSummary(db);
    html += '<div class="duo">' +
      '<button class="mini" data-worth="loans"><small>Loans</small>' +
      (L.toGet || L.toPay
        ? (L.toGet ? '<b class="pos">' + secret(L.toGet) + '</b><small>owed to you</small>' : '') + (L.toPay ? '<b class="exp">' + secret(L.toPay) + '</b><small>you owe</small>' : '')
        : '<b>None open</b><small>Track money you gave or took</small>') + '</button>' +
      '<button class="mini" data-worth="assets"><small>Assets</small>' +
      (A.list.length ? '<b>' + secret(A.value) + '</b><small>' + A.list.length + ' item' + (A.list.length === 1 ? '' : 's') + '</small>' : '<b>None yet</b><small>Gold, land, shares…</small>') + '</button></div>';

    var week = MT.lastDays(db, 7, today), wmax = 0, wsum = 0;
    week.forEach(function (d) { wmax = Math.max(wmax, d.spent); wsum += d.spent; });
    html += '<div class="sec-h"><h2>Last 7 days</h2><small class="num">' + (wsum > 0 ? money(wsum) + ' spent' : 'Nothing spent') + '</small></div>' +
      '<div class="sheet pad"><div class="spark">' + week.map(function (d) {
        var hgt = wmax > 0 ? Math.max(d.spent / wmax * 100, d.spent > 0 ? 4 : 0) : 0;
        return '<div class="sp' + (d.today ? ' today' : '') + '" role="img" aria-label="' + esc(d.label + ': ' + money(d.spent)) + '"><div class="bar"><i' + (d.spent > 0 ? '' : ' class="z"') +
          ' style="height:' + (d.spent > 0 ? hgt : 2) + (d.spent > 0 ? '%' : 'px') + '"></i></div><small>' + d.label + '</small></div>';
      }).join('') + '</div></div>';

    html += '<div class="sec-h"><h2>Recent</h2><button class="link" data-go="history">See all</button></div>';
    if (!recent.length) {
      html += '<div class="sheet empty"><h2>Start with your first entry</h2><p>Add an expense, income, or transfer.</p>' +
        '<button class="btn primary" data-go="add">Add transaction</button></div>';
    } else html += '<div class="sheet list">' + recent.map(function (t) { return txRow(t, true); }).join('') + '</div>';
    return html;
  }

  // ------------------------------------------------------------ add / edit

  function newForm(type) {
    var db = S.db;
    type = type || 'expense';
    var ws = MT.activeWallets(db);
    var w = ws.indexOf(db.settings.lastWallet) >= 0 ? db.settings.lastWallet : (ws[0] || '');
    var to = ws.filter(function (x) { return x !== w; })[0] || '';
    var cats = MT.categoriesFor(db, type === 'income' ? 'income' : 'expense');
    return { type: type, amount: '', category: type === 'transfer' ? '' : (cats[0] || ''), wallet: w, toWallet: to, fee: '', date: MT.todayStr(), note: '' };
  }
  function formFromTx(t) {
    return { type: t.type, amount: String(t.amount), category: t.category, wallet: t.wallet, toWallet: t.toWallet,
      fee: t.type === 'transfer' ? String(t.fee) : '', date: t.date, note: t.note };
  }

  function recalcFee() {
    var f = S.form;
    if (f.type !== 'transfer') return;
    var a = num(f.amount);
    f.fee = a > 0 ? String(MT.feeFor(S.db, f.wallet, f.toWallet, a)) : '';
  }
  function feeNote() {
    var f = S.form, a = num(f.amount), pct = MT.percentFor(S.db, f.wallet, f.toWallet);
    if (!(a > 0)) return 'Charge rate for this pair: ' + pct + '%';
    var fee = f.fee === '' || isNaN(num(f.fee)) ? 0 : num(f.fee);
    return f.wallet + ' pays ' + money(a + fee) + ', ' + f.toWallet + ' gets ' + money(a) + (pct ? ' (rate ' + pct + '%)' : '');
  }
  function updateTransferPreview() {
    var fe = document.getElementById('f-fee'), fn = document.getElementById('fee-note');
    if (fe && document.activeElement !== fe) fe.value = S.form.fee;
    if (fn) fn.textContent = feeNote();
  }

  // Two steps: first the wallet type (Cash, MFS, Bank...), then only the accounts of that type.
  // A type with a single account picks it straight away.
  function acctPicker(key, selected, attr) {
    var db = S.db, obj = attr === 'lchip' ? S.lf : S.form, gk = attr + ':' + key;
    obj._g = obj._g || {};
    var names = MT.activeWallets(db, selected);
    if (!names.length) return '<p class="note">None available. Sync to load them from your sheet.</p>';
    var groups = MT.groupWallets(names.map(function (n) { return { name: n, group: MT.groupOf(db, n), balance: 0 }; }));
    var selG = selected ? MT.groupOf(db, selected) : '';
    var openG = obj._g[gk] || selG;
    var html = '<div class="chips" role="group" aria-label="Wallet type">' + groups.map(function (g) {
      var one = g.wallets.length === 1;
      var label = one ? g.wallets[0].name : g.name;
      return '<button type="button" class="chip" data-gpick="' + gk + '" data-v="' + esc(g.name) + '" aria-pressed="' + (g.name === openG || (one && g.wallets[0].name === selected)) + '">' +
        '<i class="wdot" style="background:' + groupColor(g.name) + '"></i>' + esc(label) +
        (one ? '' : '<span class="n">' + g.wallets.length + '</span>') + '</button>';
    }).join('') + '</div>';
    var open = groups.filter(function (g) { return g.name === openG; })[0];
    if (open && open.wallets.length > 1) {
      html += '<p class="subl">' + esc(open.name) + ' accounts</p>' +
        chipRow(key, open.wallets.map(function (w) { return w.name; }), selected, attr);
    }
    return html;
  }

  function chipRow(key, items, selected, attr) {
    attr = attr || 'chip';
    if (!items.length) return '<p class="note">None available. Sync to load them from your sheet.</p>';
    return '<div class="chips" role="group">' + items.map(function (n) {
      var lead = key === 'category' ? (emojiFor(n) ? '<span class="e" aria-hidden="true">' + emojiFor(n) + '</span>' : '')
        : attr === 'achip' ? (ASSET_EMOJI[String(n).toLowerCase()] ? '<span class="e" aria-hidden="true">' + ASSET_EMOJI[String(n).toLowerCase()] + '</span>' : '')
        : '<i class="wdot" style="background:' + wcolor(n) + '"></i>';
      return '<button type="button" class="chip" data-' + attr + '="' + key + '" data-v="' + esc(n) + '" aria-pressed="' + (n === selected) + '">' + lead + esc(n) + '</button>';
    }).join('') + '</div>';
  }

  function addView() {
    if (!S.form) S.form = newForm();
    var f = S.form, db = S.db, isT = f.type === 'transfer';
    var types = [['expense', 'Expense'], ['income', 'Income'], ['transfer', 'Transfer']];
    var html = '';
    var cur = S.editId ? db.tx[S.editId] : null;
    if (cur && cur.syncError) {
      html += '<div class="banner bad">' + ic('alert') + '<span>The sheet did not accept this entry because ' + esc(rejectText(cur.syncError)) + '. Check it and save again.</span></div>';
    }
    var yesterday = (function () { var d = new Date(); d.setDate(d.getDate() - 1); return MT.todayStr(d); })();
    html += '<form id="addForm" novalidate>' +
      '<div class="seg t-' + f.type + '" role="group" aria-label="Type">' + types.map(function (t) {
        return '<button type="button" data-seg="' + t[0] + '" aria-pressed="' + (f.type === t[0]) + '">' + t[1] + '</button>';
      }).join('') + '</div>' +
      '<div class="amount t-' + f.type + '"><span aria-hidden="true">৳</span><input id="f-amount" data-f="amount" inputmode="decimal" placeholder="0" autocomplete="off" aria-label="Amount" value="' + esc(f.amount) + '"></div>';
    if (!isT) {
      html += '<label>Category</label>' + chipRow('category', MT.categoriesFor(db, f.type, f.category), f.category) +
        '<label>Account</label>' + acctPicker('wallet', f.wallet, 'chip');
    } else {
      html += '<label>From</label>' + acctPicker('wallet', f.wallet, 'chip') +
        '<label>To</label>' + acctPicker('toWallet', f.toWallet, 'chip') +
        '<label for="f-fee">Charge (৳)</label><input id="f-fee" data-f="fee" inputmode="decimal" autocomplete="off" value="' + esc(f.fee) + '">' +
        '<p class="note" id="fee-note">' + esc(feeNote()) + '</p>';
    }
    html += '<label for="f-date">Date</label>' +
      '<div class="datechips"><button type="button" class="chip" data-datechip="today" aria-pressed="' + (f.date === MT.todayStr()) + '">Today</button>' +
      '<button type="button" class="chip" data-datechip="yesterday" aria-pressed="' + (f.date === yesterday) + '">Yesterday</button></div>' +
      '<div style="margin-top:8px"><input id="f-date" data-f="date" type="date" value="' + esc(f.date) + '"></div>' +
      '<label for="f-note">Note (optional)</label><input id="f-note" data-f="note" maxlength="200" autocomplete="off" value="' + esc(f.note) + '">' +
      '<p class="err" id="formErr" role="alert">' + esc(S.formErr) + '</p>' +
      '<button class="btn primary block" type="submit">Save ' + f.type + '</button>';
    if (S.editId) {
      html += '<div style="display:flex;gap:8px;margin-top:10px">' +
        '<button type="button" class="btn" style="flex:1" data-act="cancel-edit">Cancel</button>' +
        '<button type="button" class="btn danger" style="flex:1" data-act="delete">' + (S.confirmDelete ? 'Tap again to delete' : 'Delete') + '</button></div>';
    }
    return html + '</form>';
  }

  function onField(el) {
    var f = S.form;
    if (!f) return;
    var k = el.getAttribute('data-f');
    f[k] = el.value;
    S.formErr = '';
    var err = document.getElementById('formErr'); if (err) err.textContent = '';
    if (k === 'amount') { recalcFee(); updateTransferPreview(); }
    else if (k === 'fee') { var fn = document.getElementById('fee-note'); if (fn) fn.textContent = feeNote(); }
    else if (k === 'date') {
      var today = MT.todayStr(), y = new Date(); y.setDate(y.getDate() - 1);
      var chips = app.querySelectorAll('[data-datechip]');
      chips.forEach(function (c) {
        var d = c.getAttribute('data-datechip') === 'today' ? today : MT.todayStr(y);
        c.setAttribute('aria-pressed', String(f.date === d));
      });
    }
  }

  function onSave() {
    var f = S.form;
    var payload = { type: f.type, amount: num(f.amount), category: f.category, wallet: f.wallet, toWallet: f.toWallet,
      fee: f.type === 'transfer' ? (f.fee === '' ? '' : num(f.fee)) : '', date: f.date, note: f.note };
    var msg = MT.checkInput(S.db, payload);
    if (msg) { S.formErr = msg; var e = document.getElementById('formErr'); if (e) e.textContent = msg; return; }
    var editing = !!S.editId;
    MT.saveTx(S.db, payload, S.editId);
    persist();
    S.form = null; S.editId = null; S.formErr = ''; S.confirmDelete = false;
    S.view = editing ? 'history' : 'home';
    render();
    window.scrollTo(0, 0);
    toast(navigator.onLine ? 'Saved' : 'Saved on this device. Will sync when online.');
    scheduleSync(500);
  }

  function onDelete() {
    if (!S.confirmDelete) { S.confirmDelete = true; renderView(); return; }
    MT.deleteTx(S.db, S.editId);
    persist();
    S.form = null; S.editId = null; S.confirmDelete = false; S.view = 'history';
    render();
    toast('Deleted');
    scheduleSync(500);
  }

  function openAdd(type) {
    S.editId = null; S.form = newForm(type); S.formErr = ''; S.confirmDelete = false;
    S.view = 'add'; render(); window.scrollTo(0, 0);
  }
  function openEdit(id) {
    var t = S.db.tx[id];
    if (!t) return;
    if (MT.isLoanType(t.type)) { openLoanEdit(t); return; }
    S.editId = t.id; S.form = formFromTx(t); S.formErr = ''; S.confirmDelete = false; S.view = 'add';
    render(); window.scrollTo(0, 0);
  }

  // ------------------------------------------------------------ history

  function monthNav() {
    return '<div class="mnav"><button data-act="mprev" aria-label="Previous month">' + ic('left') + '</button><b>' + MT.monthLabel(S.ym) +
      '</b><button data-act="mnext" aria-label="Next month">' + ic('right') + '</button></div>';
  }

  function historyView() {
    var db = S.db, h = S.hist;
    var cats = {};
    db.categories.forEach(function (c) { cats[c.name] = 1; });
    MT.liveTx(db).forEach(function (t) { if (t.category) cats[t.category] = 1; });
    var wallets = MT.balances(db).wallets.map(function (w) { return w.name; });
    function opts(list, sel, all) {
      return '<option value="">' + all + '</option>' + list.map(function (n) {
        return '<option value="' + esc(n) + '"' + (n === sel ? ' selected' : '') + '>' + esc(n) + '</option>';
      }).join('');
    }
    return monthNav() + '<div id="histTotals">' + histTotalsHtml() + '</div>' +
      '<div class="filters">' +
      '<select data-hf="type" aria-label="Type">' + [['', 'Type'], ['income', 'Income'], ['expense', 'Expense'], ['transfer', 'Transfer'], ['loan', 'Loan']].map(function (o) {
        return '<option value="' + o[0] + '"' + (o[0] === h.type ? ' selected' : '') + '>' + o[1] + '</option>';
      }).join('') + '</select>' +
      '<select data-hf="category" aria-label="Category">' + opts(Object.keys(cats), h.category, 'Category') + '</select>' +
      '<select data-hf="wallet" aria-label="Account">' + opts(wallets, h.wallet, 'Account') + '</select></div>' +
      '<input id="hq" data-hf="q" type="search" placeholder="Search notes" aria-label="Search notes" value="' + esc(h.q) + '">' +
      '<div id="histBody">' + histBodyHtml() + '</div>';
  }

  function histList() {
    return MT.filterTx(S.db, { ym: S.ym, type: S.hist.type, category: S.hist.category, wallet: S.hist.wallet, q: S.hist.q });
  }

  function histTotalsHtml() {
    var t = MT.filteredTotals(histList()), net = MT.round2(t.income - t.expense);
    return '<div class="sheet"><div class="stats3">' +
      '<div><small>In</small><b class="pos">' + money(t.income) + '</b></div>' +
      '<div><small>Out</small><b class="exp">' + money(t.expense) + '</b></div>' +
      '<div><small>Net</small><b class="' + (net < 0 ? 'neg' : '') + '">' + money(net) + '</b></div></div></div>';
  }

  function histBodyHtml() {
    var list = histList();
    if (!list.length) return '<div class="empty"><p>No transactions match.</p></div>';
    var html = '';
    MT.groupByDate(list).forEach(function (g) {
      html += '<div class="gh"><span>' + MT.dayLabel(g.date) + '</span><span>' + (g.net === 0 ? '' : (g.net > 0 ? '+ ' : '- ') + money(Math.abs(g.net))) + '</span></div>' +
        '<div class="sheet list">' + g.items.map(function (x) { return txRow(x, false); }).join('') + '</div>';
    });
    return html;
  }
  function renderHistoryBody() {
    var el = document.getElementById('histBody');
    if (el) el.innerHTML = histBodyHtml();
    var tt = document.getElementById('histTotals');
    if (tt) tt.innerHTML = histTotalsHtml();
  }

  // ------------------------------------------------------------ reports

  var DAYNAMES = ['Sundays', 'Mondays', 'Tuesdays', 'Wednesdays', 'Thursdays', 'Fridays', 'Saturdays'];

  function deltaTag(pct, upIsGood) {
    if (pct === null || pct === undefined || !isFinite(pct)) return '';
    if (Math.abs(pct) < 0.5) return '<span class="dl flat">no change</span>';
    var up = pct > 0;
    var cls = up === upIsGood ? 'good' : 'bad';
    return '<span class="dl ' + cls + '">' + (up ? '▲ ' : '▼ ') + Math.abs(pct).toFixed(0) + '%</span>';
  }
  function amountDelta(delta) {   // spending in a category vs before: up is bad
    if (delta === null || delta === undefined) return '';
    if (delta === 0) return '<span class="dl flat">same</span>';
    return '<span class="dl ' + (delta > 0 ? 'bad' : 'good') + '">' + (delta > 0 ? '▲ ' : '▼ ') + plain(Math.abs(delta)) + '</span>';
  }

  function periodLabel(r) {
    if (r.scope === 'month') return MT.monthLabel(r.key);
    if (r.scope === 'year') return r.key;
    return 'All time';
  }
  function prevLabel(r) {
    if (r.scope === 'month') return SHORT_MONTHS[Number(r.prevKey.slice(5, 7)) - 1] + (r.isCurrent ? ' (same days)' : '');
    if (r.scope === 'year') return r.prevKey + (r.isCurrent ? ' (same days)' : '');
    return '';
  }

  function prevShort(r) {
    return r.scope === 'month' ? SHORT_MONTHS[Number(r.prevKey.slice(5, 7)) - 1] : r.prevKey;
  }

  function periodNav(scope) {
    var key = scope === 'month' ? S.rm : S.ry;
    var cur = scope === 'month' ? MT.monthOf(MT.todayStr()) : MT.todayStr().slice(0, 4);
    return '<div class="mnav"><button data-act="rprev" aria-label="Previous">' + ic('left') + '</button><b>' + (scope === 'month' ? MT.monthLabel(key) : key) +
      '</b><button data-act="rnext" aria-label="Next"' + (key >= cur ? ' disabled' : '') + '>' + ic('right') + '</button></div>';
  }

  function tableView(head, rows) {
    return '<details class="tbl"><summary>Show as table</summary><table><thead><tr>' + head.map(function (h) { return '<th>' + esc(h) + '</th>'; }).join('') +
      '</tr></thead><tbody>' + rows.map(function (r) { return '<tr>' + r.map(function (c) { return '<td>' + esc(c) + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table></details>';
  }

  function pick(k) { return S.rsel && S.rsel.k === k ? S.rsel.i : null; }

  function dailyChart(r) {
    var max = 0;
    r.daily.forEach(function (d) { if (d.spent > max) max = d.spent; });
    var sel = pick('d');
    if (sel === null) sel = r.busiest ? Number(r.busiest.date.slice(8, 10)) - 1 : (r.isCurrent ? Number(MT.todayStr().slice(8, 10)) - 1 : 0);
    var n = r.daily.length;
    var d = r.daily[sel];
    var readout = '<b>' + MT.dayLabel(d.date) + '</b> · ' + (d.spent > 0 ? money(d.spent) + ' spent' : 'nothing spent') +
      (d.income > 0 ? ' · ' + money(d.income) + ' in' : '') + (d.count ? ' · ' + d.count + ' entr' + (d.count === 1 ? 'y' : 'ies') : '');
    var cols = r.daily.map(function (x, i) {
      var h = max > 0 ? x.spent / max * 100 : 0;
      return '<button type="button" class="col' + (x.future ? ' fut' : '') + '" data-pick="d" data-i="' + i + '" aria-pressed="' + (i === sel) + '" aria-label="' +
        esc(MT.dayLabel(x.date) + ': ' + money(x.spent)) + '"><i style="height:' + (x.spent > 0 ? Math.max(h, 2) : 0) + '%"></i></button>';
    }).join('');
    var avgPos = max > 0 && r.avgPerDay > 0 ? Math.min(100, r.avgPerDay / max * 100) : null;
    var ticks = [1, 5, 10, 15, 20, 25, n].filter(function (v, i, a) { return v <= n && a.indexOf(v) === i; });
    return '<p class="readout num">' + readout + '</p><div class="chart gutter"><div class="plot">' +
      (max > 0 ? '<div class="gl" style="bottom:100%"><span>' + short(max) + '</span></div>' : '') +
      (avgPos !== null && avgPos < 92 ? '<div class="gl avg" style="bottom:' + avgPos + '%"><span>avg ' + short(r.avgPerDay) + '</span></div>' : '') +
      '<div class="cols">' + cols + '</div></div><div class="xaxis">' + ticks.map(function (v) {
        return '<span style="left:' + ((v - 0.5) / n * 100) + '%">' + v + '</span>';
      }).join('') + '</div></div>' +
      tableView(['Day', 'Spent', 'Entries'], r.daily.filter(function (x) { return x.count > 0; }).map(function (x) { return [MT.dayLabel(x.date), plain(x.spent), String(x.count)]; }));
  }

  function monthsChart(r) {
    var max = 0;
    r.months.forEach(function (m) { max = Math.max(max, m.income, m.spent); });
    var sel = pick('m');
    if (sel === null) {
      sel = r.months.length - 1;
      if (r.scope === 'year') {
        for (var i = r.months.length - 1; i >= 0; i--) { if (!r.months[i].future) { sel = i; break; } }
      }
    }
    var m = r.months[sel];
    var readout = '<b>' + SHORT_MONTHS[Number(m.ym.slice(5, 7)) - 1] + ' ' + m.ym.slice(0, 4) + '</b><br>In ' + money(m.income) + ' · Spent ' + money(m.spent) + ' · Net ' + money(m.net);
    var cols = r.months.map(function (x, i) {
      return '<button type="button" class="col g" data-pick="m" data-i="' + i + '" aria-pressed="' + (i === sel) + '" aria-label="' +
        esc(x.label + ': in ' + money(x.income) + ', spent ' + money(x.spent)) + '">' +
        '<i class="bi" style="height:' + (max > 0 && x.income > 0 ? Math.max(x.income / max * 100, 2) : 0) + '%"></i>' +
        '<i class="be" style="height:' + (max > 0 && x.spent > 0 ? Math.max(x.spent / max * 100, 2) : 0) + '%"></i></button>';
    }).join('');
    return '<p class="readout num">' + readout + '</p><div class="chart gutter"><div class="plot">' +
      (max > 0 ? '<div class="gl" style="bottom:100%"><span>' + short(max) + '</span></div>' : '') +
      '<div class="cols">' + cols + '</div></div><div class="xlabels">' + r.months.map(function (x, i) {
        return '<span' + (i === sel ? ' class="on"' : '') + '>' + x.label + '</span>';
      }).join('') + '</div></div>' +
      '<div class="legend"><span><i class="sw inc"></i>Income</span><span><i class="sw exp"></i>Spent</span>' +
      (r.avgMonthSpent > 0 ? '<span class="num" style="margin-left:auto">Average spent ' + money(r.avgMonthSpent) + '</span>' : '') + '</div>' +
      tableView(['Month', 'Income', 'Spent', 'Net'], r.months.filter(function (x) { return !x.future; }).map(function (x) { return [x.label + ' ' + x.ym.slice(0, 4), plain(x.income), plain(x.spent), plain(x.net)]; }));
  }

  function weekdayChart(r) {
    var max = 0, top = -1;
    r.weekdays.forEach(function (w, i) { if (w.avg > max) { max = w.avg; top = i; } });
    var cols = r.weekdays.map(function (w, i) {
      return '<div class="col wk' + (i === top ? ' top' : '') + '" role="img" style="cursor:default" aria-label="' + esc(w.name + ': about ' + money(w.avg) + ' a day') + '">' +
        '<i style="height:' + (max > 0 && w.avg > 0 ? Math.max(w.avg / max * 100, 2) : 0) + '%"></i></div>';
    }).join('');
    return '<p class="readout num">You spend the most on <b>' + DAYNAMES[top] + '</b>, about ' + money(max) + ' a day.</p>' +
      '<div class="chart"><div class="plot"><div class="cols">' + cols + '</div></div><div class="xlabels">' + r.weekdays.map(function (w, i) {
        return '<span' + (i === top ? ' class="on"' : '') + '>' + w.name + '</span>';
      }).join('') + '</div></div>' +
      tableView(['Day', 'Spent a day', 'Total'], r.weekdays.map(function (w) { return [w.name, plain(w.avg), plain(w.total)]; }));
  }

  function categoryRows(list, kind, r) {
    var showDelta = kind === 'exp' && r.prev !== null && r.prev.spent > 0;
    return list.map(function (c) {
      var sub = '<span>' + c.count + ' entr' + (c.count === 1 ? 'y' : 'ies') + '</span><span>' + c.pct.toFixed(0) + '%</span>';
      if (showDelta) sub += '<span>' + amountDelta(c.delta) + ' vs ' + esc(prevShort(r)) + '</span>';
      return '<div class="crow">' + catBubble(c.name, true) + '<div class="cmid"><div class="cl"><b>' + esc(c.name) + '</b><span class="amt">' + money(c.amount) + '</span></div>' +
        '<div class="cbar' + (kind === 'inc' ? ' inc' : '') + '" role="img" aria-label="' + c.pct.toFixed(0) + '% of the total"><i style="width:' + Math.max(c.pct, 0.8).toFixed(1) + '%"></i></div>' +
        '<div class="csub">' + sub + '</div></div></div>';
    }).join('');
  }

  function reportsView() {
    var today = MT.todayStr(), scope = S.rscope;
    var key = scope === 'month' ? S.rm : scope === 'year' ? S.ry : '';
    var r = MT.report(S.db, scope, key, today);
    var html = '<div class="seg plain rseg" role="group" aria-label="Period">' + [['month', 'Month'], ['year', 'Year'], ['all', 'All time']].map(function (o) {
      return '<button type="button" data-rscope="' + o[0] + '" aria-pressed="' + (scope === o[0]) + '">' + o[1] + '</button>';
    }).join('') + '</div>';
    if (scope !== 'all') html += periodNav(scope);

    if (!r.counts.all) {
      return html + '<div class="sheet empty"><h2>Nothing recorded in ' + esc(periodLabel(r)) + '</h2><p>Reports fill in as you add entries.</p>' +
        '<button class="btn primary" data-go="add">Add transaction</button></div>';
    }

    // headline
    html += '<div class="sheet"><div class="stats3">' +
      '<div><small>Income</small><b class="pos">' + money(r.income) + '</b>' + (r.prev ? '<small>' + deltaTag(r.incomeChange, true) + '</small>' : '') + '</div>' +
      '<div><small>Spent</small><b class="exp">' + money(r.spent) + '</b>' + (r.prev ? '<small>' + deltaTag(r.spentChange, false) + '</small>' : '') + '</div>' +
      '<div><small>Net</small><b class="' + (r.net < 0 ? 'neg' : '') + '">' + money(r.net) + '</b></div></div></div>';
    if (r.prev && (r.prev.spent > 0 || r.prev.income > 0)) html += '<p class="cap">Changes compare with ' + esc(prevLabel(r)) + '.</p>';

    // where the income went
    if (r.income > 0) {
      var spentPct = Math.min(100, r.spent / r.income * 100), keepPct = Math.max(0, 100 - spentPct);
      html += '<div class="sec-h"><h2>Where your income went</h2></div><div class="sheet pad">' +
        '<p class="lead-text num">' + (r.net >= 0
          ? 'You kept <b>' + keepPct.toFixed(0) + '%</b> of what came in (' + money(r.net) + ').'
          : 'You spent <b class="neg">' + money(-r.net) + '</b> more than came in.') + '</p>' +
        '<div class="meter" role="img" aria-label="Spent ' + spentPct.toFixed(0) + '%, kept ' + keepPct.toFixed(0) + '%"><i class="m-exp" style="width:' + spentPct + '%"></i><i class="m-keep" style="width:' + keepPct + '%"></i></div>' +
        '<div class="mkey"><span><i class="sw exp"></i>Spent ' + spentPct.toFixed(0) + '%</span><span><i class="sw inc"></i>Kept ' + keepPct.toFixed(0) + '%</span></div></div>';
    }

    // pace for the running month
    if (r.projection) {
      var last = MT.report(S.db, 'month', r.prevKey, today);
      html += '<div class="sec-h"><h2>At this pace</h2></div><div class="sheet pad"><p class="lead-text num">You are on track to spend about <b class="exp">' + money(r.projection.amount) +
        '</b> this month, with ' + r.projection.daysLeft + ' day' + (r.projection.daysLeft === 1 ? '' : 's') + ' left.' +
        (last.spent > 0 ? ' Last month’s total was ' + money(last.spent) + '.' : '') + '</p></div>';
    }

    // by day
    if (r.daily && r.spent > 0) {
      html += '<div class="sec-h"><h2>Spending by day</h2><small class="num">' + money(r.avgPerDay) + ' a day</small></div><div class="sheet pad">' + dailyChart(r) + '</div>';
    }

    // by category
    if (r.byCategory.length) {
      html += '<div class="sec-h"><h2>Where it went</h2><small>' + r.byCategory.length + ' categor' + (r.byCategory.length === 1 ? 'y' : 'ies') + '</small></div>' +
        '<div class="sheet">' + categoryRows(r.byCategory, 'exp', r) + '</div>';
    }
    if (r.incomeByCategory.length) {
      html += '<div class="sec-h"><h2>Where it came from</h2></div><div class="sheet">' + categoryRows(r.incomeByCategory, 'inc', r) + '</div>';
    }

    // months
    html += '<div class="sec-h"><h2>' + (scope === 'month' ? 'Last 6 months' : scope === 'year' ? 'Month by month' : 'Last 12 months') + '</h2></div><div class="sheet pad">' + monthsChart(r) + '</div>';

    // weekdays
    if (r.spent > 0 && r.days >= 7) {
      html += '<div class="sec-h"><h2>Which days cost most</h2></div><div class="sheet pad">' + weekdayChart(r) + '</div>';
    }

    // wallets
    var active = r.wallets.filter(function (w) { return w.in > 0 || w.out > 0 || w.balance !== 0; });
    if (active.length) {
      html += '<div class="sec-h"><h2>Accounts</h2><small>Balance now, and movement in ' + esc(periodLabel(r)) + '</small></div><div class="sheet">' +
        active.map(function (w) {
          return '<div class="crow"><i class="wdot" style="background:' + wcolor(w.name) + ';margin-top:9px"></i><div class="cmid"><div class="cl"><b>' + esc(w.name) + '</b>' +
            '<span class="amt' + (w.balance < 0 ? ' neg' : '') + '">' + secret(w.balance) + '</span></div>' +
            '<div class="csub num"><span>In ' + plain(w.in) + '</span><span>Out ' + plain(w.out) + '</span><span class="' + (w.net < 0 ? 'neg' : w.net > 0 ? 'pos' : '') + '">Net ' + (w.net > 0 ? '+' : '') + plain(w.net) + '</span></div></div></div>';
        }).join('') + '</div>';
      if (r.counts.loan) html += '<p class="cap">Loan entries change an account’s balance but are not counted as income or spending.</p>';
      if (r.moved > 0) html += '<p class="cap">' + money(r.moved) + ' moved between accounts' + (r.fees > 0 ? ', costing ' + money(r.fees) + ' in charges (' + (r.fees / r.moved * 100).toFixed(1) + '%)' : '') + '.</p>';
    }

    // biggest expenses
    if (r.top.length) {
      html += '<div class="sec-h"><h2>Biggest expenses</h2></div><div class="sheet list">' + r.top.map(function (t) { return txRow(t, true); }).join('') + '</div>';
    }

    // facts
    var facts = '<div><span>Entries</span><span>' + r.counts.all + '<small>' + r.counts.expense + ' expense, ' + r.counts.income + ' income, ' + r.counts.transfer + ' transfer' + (r.counts.loan ? ', ' + r.counts.loan + ' loan' : '') + '</small></span></div>';
    if (r.counts.expense) facts += '<div><span>Average expense</span><span>' + money(r.avgExpense) + '</span></div>';
    if (r.busiest) facts += '<div><span>Costliest day</span><span>' + money(r.busiest.amount) + '<small>' + shortDate(r.busiest.date) + '</small></span></div>';
    if (r.days >= 3) facts += '<div><span>Days with no spending</span><span>' + r.noSpendDays + ' of ' + r.days + '<small>longest run ' + r.longestNoSpend + ' day' + (r.longestNoSpend === 1 ? '' : 's') + '</small></span></div>';
    if (r.frequent) facts += '<div><span>Most often</span><span>' + esc(r.frequent.name) + '<small>' + r.frequent.count + ' time' + (r.frequent.count === 1 ? '' : 's') + '</small></span></div>';
    if (r.biggestIncome) facts += '<div><span>Biggest income</span><span>' + money(r.biggestIncome.amount) + '<small>' + esc(r.biggestIncome.category) + ' · ' + shortDate(r.biggestIncome.date) + '</small></span></div>';
    if (r.fees > 0) facts += '<div><span>Transfer charges</span><span>' + money(r.fees) + '</span></div>';
    html += '<div class="sec-h"><h2>Quick facts</h2></div><div class="sheet facts">' + facts + '</div>';
    return html;
  }

  // ------------------------------------------------------------ net worth: loans and assets

  var ASSET_EMOJI = { gold: '🪙', land: '🏞️', property: '🏠', shares: '📈', 'savings certificate': '📜', 'fdr / dps': '🏦', vehicle: '🚗', business: '🏪', other: '📦' };
  function assetBubble(type, small) {
    var e = ASSET_EMOJI[String(type || '').toLowerCase()];
    return '<span class="bubble' + (small ? ' sm' : '') + '" style="--h:' + hueOf(String(type || '?')) + '" aria-hidden="true">' +
      (e || esc(Array.from(String(type || '?'))[0].toUpperCase())) + '</span>';
  }

  function personFind(key) {
    var list = MT.loanLedger(S.db).people;
    for (var i = 0; i < list.length; i++) if (list[i].key === key) return list[i];
    return null;
  }

  function daysUntil(date, today) {
    var a = date.split('-').map(Number), b = today.split('-').map(Number);
    return Math.round((Date.UTC(a[0], a[1] - 1, a[2]) - Date.UTC(b[0], b[1] - 1, b[2])) / 86400000);
  }
  function dueText(due, today) {
    var d = daysUntil(due, today);
    if (d < 0) return { t: 'Overdue by ' + (-d) + ' day' + (d === -1 ? '' : 's'), late: true };
    if (d === 0) return { t: 'Due today', late: false };
    if (d === 1) return { t: 'Due tomorrow', late: false };
    return { t: 'Due ' + shortDate(due), late: false };
  }

  function scriptBanner() {
    var db = S.db;
    if (db.lastSync && db.srvVersion < NEED_SCRIPT) {
      return '<div class="banner warn">' + ic('alert') + '<span>Loans and assets need the newest script. Paste the latest Code.gs into your Google script and deploy a new version. Until then, assets wait on this device and loan entries may be refused.</span></div>';
    }
    return '';
  }

  function worthView() {
    var db = S.db, today = MT.todayStr(), w = MT.netWorth(db, today);
    var html = syncBanners() + scriptBanner();
    html += '<section class="hero"><div class="hero-top"><span class="lbl">Net worth</span>' +
      '<button class="eye" data-act="hide" aria-label="' + (hidden() ? 'Show balances' : 'Hide balances') + '">' + ic(hidden() ? 'eyeoff' : 'eye') + '</button></div>' +
      '<p class="big num">' + secret(w.total) + '</p>' +
      '<div class="wgrid">' +
      '<div><small>In accounts</small><b>' + secret(w.wallets) + '</b></div>' +
      '<div><small>Assets</small><b>' + secret(w.assets) + '</b></div>' +
      '<div><small>Owed to you</small><b class="g">' + secret(w.toGet) + '</b></div>' +
      '<div><small>You owe</small><b class="o">' + secret(w.toPay) + '</b></div></div></section>';
    html += '<div class="seg plain wseg" role="group" aria-label="Section">' + [['loans', 'Loans'], ['assets', 'Assets']].map(function (o) {
      return '<button type="button" data-wtab="' + o[0] + '" aria-pressed="' + (S.wtab === o[0]) + '">' + o[1] + '</button>';
    }).join('') + '</div>';
    return html + (S.wtab === 'assets' ? assetsTab() : loansTab());
  }

  function loansTab() {
    var db = S.db, today = MT.todayStr(), L = MT.loanLedger(db, today), T = L.totals;
    var html = '<div class="sheet"><div class="stats3 two">' +
      '<div><small>Owed to you</small><b class="pos">' + secret(T.toGet) + '</b>' + (T.overdueGet > 0 ? '<small class="late">' + secret(T.overdueGet) + ' overdue</small>' : '') + '</div>' +
      '<div><small>You owe</small><b class="exp">' + secret(T.toPay) + '</b>' + (T.overduePay > 0 ? '<small class="late">' + secret(T.overduePay) + ' overdue</small>' : '') + '</div></div></div>';
    html += '<div class="quick two"><button data-lnew="lend">' + ic('out') + 'I gave</button><button data-lnew="borrow">' + ic('inn') + 'I took</button></div>';
    if (!L.people.length) {
      return html + '<div class="sheet empty"><h2>No loans yet</h2><p>Record money you gave or took. Part payments are tracked person by person, and the money moves in and out of the account you choose.</p></div>';
    }
    html += '<div class="sec-h"><h2>People</h2><small>' + T.open + ' open</small></div><div class="sheet list">' + L.people.map(function (p) {
      var amt, lab, cls;
      if (p.settled) { amt = '<span class="mute">Settled</span>'; lab = ''; }
      else {
        var net = p.net;
        cls = net > 0 ? 'pos' : net < 0 ? 'exp' : '';
        lab = p.toGet > 0 && p.toPay > 0 ? (net > 0 ? 'owes you, net' : net < 0 ? 'you owe, net' : 'both ways') : (p.toGet > 0 ? 'owes you' : 'you owe');
        amt = '<span class="' + cls + '">' + secret(Math.abs(net) || Math.max(p.toGet, p.toPay)) + '</span><small>' + lab + '</small>';
      }
      var late = p.overdueGet + p.overduePay > 0, sub;
      if (p.settled) sub = 'Last entry ' + shortDate(p.last);
      else if (late) sub = '<span class="late">Overdue</span>' + (p.nextDue ? ' · was due ' + shortDate(p.nextDue) : '');
      else if (p.nextDue) sub = esc(dueText(p.nextDue, today).t);
      else sub = p.items.length + ' entr' + (p.items.length === 1 ? 'y' : 'ies');
      return '<button class="tx" data-person="' + esc(p.key) + '">' + personBubble(p.name) +
        '<span class="txm"><b>' + esc(p.name) + '</b><small>' + sub + '</small></span><span class="txa">' + amt + '</span></button>';
    }).join('') + '</div>';
    return html;
  }

  function personView() {
    var db = S.db, today = MT.todayStr(), p = personFind(S.person);
    if (!p) return '<div class="sheet empty"><h2>Nothing here</h2><p>This person has no loan entries.</p><button class="btn primary" data-go="worth">Back to loans</button></div>';
    var html = syncBanners();
    var status = p.settled ? 'All settled' : (p.net > 0 ? 'Owes you ' + money(p.net) : p.net < 0 ? 'You owe ' + money(-p.net) : 'Even, both ways');
    html += '<div class="sheet pad phead">' + personBubble(p.name) + '<div><b class="pname">' + esc(p.name) + '</b><small>' + (hidden() ? 'Hidden' : esc(status)) + '</small></div></div>';
    var rows = '';
    if (p.lent > 0) rows += '<div><span>You gave</span><span>' + secret(p.lent) + '</span></div><div><span>Got back</span><span>' + secret(p.collected) + '</span></div>' +
      '<div><span>Still owed to you</span><span class="' + (p.toGet > 0 ? 'pos' : '') + '">' + secret(p.toGet) + (p.extraIn > 0 ? '<small>' + secret(p.extraIn) + ' more came back than was lent</small>' : '') + '</span></div>';
    if (p.borrowed > 0) rows += '<div><span>You took</span><span>' + secret(p.borrowed) + '</span></div><div><span>You paid back</span><span>' + secret(p.repaid) + '</span></div>' +
      '<div><span>You still owe</span><span class="' + (p.toPay > 0 ? 'exp' : '') + '">' + secret(p.toPay) + (p.extraOut > 0 ? '<small>' + secret(p.extraOut) + ' more was paid than borrowed</small>' : '') + '</span></div>';
    if (rows) html += '<div class="sheet facts" style="margin-top:12px">' + rows + '</div>';

    var qn = esc(p.name), btns = '';
    if (p.toGet > 0) btns += '<button data-lnew="collect" data-lperson="' + qn + '">' + ic('inn') + 'Got back</button>';
    if (p.toPay > 0) btns += '<button data-lnew="repay" data-lperson="' + qn + '">' + ic('out') + 'I paid back</button>';
    btns += '<button data-lnew="lend" data-lperson="' + qn + '">' + ic('out') + 'I gave more</button><button data-lnew="borrow" data-lperson="' + qn + '">' + ic('inn') + 'I took more</button>';
    html += '<div class="quick two">' + btns + '</div>';

    var open = p.openGet.map(function (o) { return { o: o, kind: 'Gave' }; }).concat(p.openPay.map(function (o) { return { o: o, kind: 'Took' }; }));
    if (open.length) {
      html += '<div class="sec-h"><h2>Still open</h2><small>oldest is settled first</small></div><div class="sheet">' + open.map(function (x) {
        var o = x.o, d = o.due ? dueText(o.due, today) : null;
        return '<div class="crow"><div class="cmid"><div class="cl"><b>' + x.kind + ' on ' + shortDate(o.date) + '</b><span class="amt ' + (x.kind === 'Gave' ? 'pos' : 'exp') + '">' + secret(o.remaining) + '</span></div>' +
          '<div class="csub num">' + (o.remaining < o.original ? '<span>of ' + secret(o.original) + '</span>' : '') +
          (d ? '<span class="' + (d.late ? 'late' : '') + '">' + esc(d.t) + '</span>' : '<span>No due date</span>') + '</div></div></div>';
      }).join('') + '</div>';
    }
    html += '<div class="sec-h"><h2>Entries</h2><small>' + p.items.length + '</small></div><div class="sheet list">' + p.items.map(function (t) { return txRow(t, true); }).join('') + '</div>';
    return html;
  }

  // ---- loan form

  function newLoanForm(type, person) {
    var db = S.db, ws = MT.activeWallets(db);
    var w = ws.indexOf(db.settings.lastWallet) >= 0 ? db.settings.lastWallet : (ws[0] || '');
    var f = { type: type || 'lend', person: person || '', amount: '', wallet: w, date: MT.todayStr(), due: '', note: '' };
    if (person && (f.type === 'collect' || f.type === 'repay')) {
      var p = personFind(MT.personKey(person));
      var out = p ? (f.type === 'collect' ? p.toGet : p.toPay) : 0;
      if (out > 0) f.amount = String(out);
    }
    return f;
  }
  function openLoan(type, person) {
    S.lEditId = null; S.lf = newLoanForm(type, person); S.lErr = ''; S.confirmDelete = false;
    S.lback = S.view === 'person' ? 'person' : 'worth';
    S.view = 'loan'; render(); window.scrollTo(0, 0);
  }
  function openLoanEdit(t) {
    S.lEditId = t.id; S.lErr = ''; S.confirmDelete = false;
    S.lf = { type: t.type, person: t.person, amount: String(t.amount), wallet: t.wallet, date: t.date, due: t.due || '', note: t.note };
    S.lback = S.view === 'person' ? 'person' : (S.view === 'history' ? 'history' : (S.view === 'settings' ? 'settings' : (S.view === 'home' ? 'home' : 'worth')));
    S.view = 'loan'; render(); window.scrollTo(0, 0);
  }

  var LOAN_TYPES_UI = [['lend', 'I gave'], ['borrow', 'I took'], ['collect', 'Got back'], ['repay', 'I paid back']];

  function loanHintHtml() {
    var f = S.lf, name = String(f.person || '').trim();
    if (!name) return '';
    var p = personFind(MT.personKey(name)), a = num(f.amount), h = '';
    if (f.type === 'collect') {
      if (p && p.toGet > 0) {
        h = esc(p.name) + ' still owes you ' + money(p.toGet) + '.' + (a > p.toGet ? ' That is more than they owe.' : '') +
          (a !== p.toGet ? ' <button type="button" class="link" data-lfull="' + p.toGet + '">Use ' + plain(p.toGet) + '</button>' : '');
      } else h = p ? esc(p.name) + ' does not owe you anything right now.' : 'You have not lent anything to this person yet.';
    } else if (f.type === 'repay') {
      if (p && p.toPay > 0) {
        h = 'You still owe ' + esc(p.name) + ' ' + money(p.toPay) + '.' + (a > p.toPay ? ' That is more than you owe.' : '') +
          (a !== p.toPay ? ' <button type="button" class="link" data-lfull="' + p.toPay + '">Use ' + plain(p.toPay) + '</button>' : '');
      } else h = p ? 'You do not owe ' + esc(p.name) + ' anything right now.' : 'You have not borrowed from this person yet.';
    }
    return h;
  }
  function updateLoanHint() {
    var el = document.getElementById('lhint');
    if (el) el.innerHTML = loanHintHtml();
  }

  function loanView() {
    if (!S.lf) S.lf = newLoanForm('lend');
    var f = S.lf, db = S.db, hasDue = f.type === 'lend' || f.type === 'borrow';
    var yesterday = (function () { var d = new Date(); d.setDate(d.getDate() - 1); return MT.todayStr(d); })();
    var L = MT.loanLedger(db, MT.todayStr());
    var help = { lend: 'Money you gave to someone. It leaves the account you pick.', borrow: 'Money someone gave you. It goes into the account you pick.',
      collect: 'Money that came back to you. It goes into the account you pick.', repay: 'Money you gave back. It leaves the account you pick.' }[f.type];
    var html = '<form id="loanForm" novalidate>' +
      '<div class="seg t-loan" role="group" aria-label="Kind of loan entry">' + LOAN_TYPES_UI.map(function (t) {
        return '<button type="button" data-lseg="' + t[0] + '" aria-pressed="' + (f.type === t[0]) + '">' + t[1] + '</button>';
      }).join('') + '</div><p class="note">' + esc(help) + '</p>' +
      '<div class="amount t-loan"><span aria-hidden="true">৳</span><input id="lf-amount" data-lf="amount" inputmode="decimal" placeholder="0" autocomplete="off" aria-label="Amount" value="' + esc(f.amount) + '"></div>' +
      '<label for="lf-person">Person</label><input id="lf-person" data-lf="person" list="people-list" maxlength="60" autocomplete="off" placeholder="Name" value="' + esc(f.person) + '">' +
      '<datalist id="people-list">' + MT.personNames(db).map(function (n) { return '<option value="' + esc(n) + '"></option>'; }).join('') + '</datalist>';
    if (f.type === 'collect' || f.type === 'repay') {
      var who = L.people.filter(function (p) { return f.type === 'collect' ? p.toGet > 0 : p.toPay > 0; });
      if (who.length) html += '<div class="chips" style="margin-top:10px">' + who.map(function (p) {
        return '<button type="button" class="chip" data-lpchip="' + esc(p.name) + '" aria-pressed="' + (MT.personKey(p.name) === MT.personKey(f.person)) + '">' + esc(p.name) + ' · ' + plain(f.type === 'collect' ? p.toGet : p.toPay) + '</button>';
      }).join('') + '</div>';
    }
    html += '<p class="note" id="lhint">' + loanHintHtml() + '</p>' +
      '<label>Account</label>' + acctPicker('wallet', f.wallet, 'lchip') +
      '<label for="lf-date">Date</label>' +
      '<div class="datechips"><button type="button" class="chip" data-ldatechip="today" aria-pressed="' + (f.date === MT.todayStr()) + '">Today</button>' +
      '<button type="button" class="chip" data-ldatechip="yesterday" aria-pressed="' + (f.date === yesterday) + '">Yesterday</button></div>' +
      '<div style="margin-top:8px"><input id="lf-date" data-lf="date" type="date" value="' + esc(f.date) + '"></div>';
    if (hasDue) {
      html += '<label for="lf-due">' + (f.type === 'lend' ? 'Expected back by' : 'Pay back by') + ' (optional)</label>' +
        '<div class="datechips"><button type="button" class="chip" data-ldue="7">In a week</button><button type="button" class="chip" data-ldue="30">In a month</button>' +
        '<button type="button" class="chip" data-ldue="0">No date</button></div>' +
        '<div style="margin-top:8px"><input id="lf-due" data-lf="due" type="date" value="' + esc(f.due) + '"></div>';
    }
    html += '<label for="lf-note">Note (optional)</label><input id="lf-note" data-lf="note" maxlength="200" autocomplete="off" value="' + esc(f.note) + '">' +
      '<p class="err" id="lerr" role="alert">' + esc(S.lErr) + '</p>' +
      '<button class="btn primary block" type="submit">Save</button>';
    html += '<div style="display:flex;gap:8px;margin-top:10px"><button type="button" class="btn" style="flex:1" data-act="cancel-loan">Cancel</button>' +
      (S.lEditId ? '<button type="button" class="btn danger" style="flex:1" data-act="delete-loan">' + (S.confirmDelete ? 'Tap again to delete' : 'Delete') + '</button>' : '') + '</div>';
    return html + '</form>';
  }

  function backFromLoan() {
    var back = S.lback;
    S.lf = null; S.lEditId = null; S.lErr = ''; S.confirmDelete = false;
    if (back === 'person' && personFind(S.person)) S.view = 'person';
    else if (back === 'history') S.view = 'history';
    else if (back === 'settings') S.view = 'settings';
    else if (back === 'home') S.view = 'home';
    else S.view = 'worth';
    S.wtab = 'loans';
    render(); window.scrollTo(0, 0);
  }

  function onSaveLoan() {
    var f = S.lf;
    var payload = { type: f.type, person: f.person, amount: num(f.amount), wallet: f.wallet, date: f.date, due: f.type === 'lend' || f.type === 'borrow' ? f.due : '', note: f.note, category: '', toWallet: '', fee: '' };
    var msg = MT.checkInput(S.db, payload);
    if (msg) { S.lErr = msg; var e = document.getElementById('lerr'); if (e) e.textContent = msg; return; }
    var more = '';
    var p = personFind(MT.personKey(payload.person));
    if (!S.lEditId && p) {
      if (f.type === 'collect' && payload.amount > p.toGet) more = ' That is more than was owed.';
      if (f.type === 'repay' && payload.amount > p.toPay) more = ' That is more than you owed.';
    }
    var t = MT.saveTx(S.db, payload, S.lEditId);
    persist();
    if (S.lback === 'person' && S.person && !personFind(S.person)) S.person = MT.personKey(t.person);
    backFromLoan();
    toast((navigator.onLine ? 'Saved' : 'Saved on this device. Will sync when online.') + more);
    scheduleSync(500);
  }

  function onDeleteLoan() {
    if (!S.confirmDelete) { S.confirmDelete = true; renderView(); return; }
    MT.deleteTx(S.db, S.lEditId);
    persist();
    backFromLoan();
    toast('Deleted');
    scheduleSync(500);
  }

  function onLoanField(el) {
    var f = S.lf;
    if (!f) return;
    var k = el.getAttribute('data-lf');
    f[k] = el.value;
    S.lErr = '';
    var err = document.getElementById('lerr'); if (err) err.textContent = '';
    if (k === 'amount' || k === 'person') updateLoanHint();
    if (k === 'person') {
      app.querySelectorAll('[data-lpchip]').forEach(function (c) { c.setAttribute('aria-pressed', String(MT.personKey(c.getAttribute('data-lpchip')) === MT.personKey(f.person))); });
    }
    if (k === 'date') {
      var y = new Date(); y.setDate(y.getDate() - 1);
      app.querySelectorAll('[data-ldatechip]').forEach(function (c) {
        c.setAttribute('aria-pressed', String(f.date === (c.getAttribute('data-ldatechip') === 'today' ? MT.todayStr() : MT.todayStr(y))));
      });
    }
  }

  // ---- assets

  function assetsTab() {
    var db = S.db, A = MT.assetSummary(db);
    var html = '<button class="btn primary block" style="margin-top:12px" data-anew="1">' + ic('plus2') + ' Add asset</button>';
    if (!A.list.length) {
      return html + '<div class="sheet empty" style="margin-top:12px"><h2>No assets yet</h2><p>List things you own, such as gold, land, shares or savings certificates. You enter their current value yourself and update it when prices change.</p></div>';
    }
    var pct = A.gainPct;
    html += '<div class="sheet" style="margin-top:12px"><div class="stats3 two">' +
      '<div><small>Worth now</small><b>' + secret(A.value) + '</b></div>' +
      '<div><small>Gain or loss</small>' + (A.cost > 0
        ? '<b class="' + (A.gain < 0 ? 'neg' : A.gain > 0 ? 'pos' : '') + '">' + (hidden() ? '৳ ••••' : (A.gain > 0 ? '+ ' : A.gain < 0 ? '- ' : '') + money(Math.abs(A.gain))) + '</b>' +
          (!hidden() ? '<small>' + (pct >= 0 ? '+' : '') + pct.toFixed(0) + '% on ' + money(A.cost) + ' paid</small>' : '')
        : '<b class="mute">—</b><small>Add what you paid to see it</small>') + '</div></div></div>';
    A.groups.forEach(function (g) {
      var share = A.value > 0 ? Math.round(g.value / A.value * 100) : 0;
      html += '<div class="sec-h"><h2>' + esc(g.type) + '</h2><small class="num">' + secret(g.value) + (share ? ' · ' + share + '%' : '') + '</small></div><div class="sheet list">' +
        g.items.map(assetRow).join('') + '</div>';
    });
    return html + '<p class="note" style="margin:12px 4px 0">Values are the ones you enter. Tap an asset to update its value.' + (A.unpriced ? ' Gain or loss leaves out ' + A.unpriced + ' item' + (A.unpriced === 1 ? '' : 's') + ' with no price.' : '') + '</p>';
  }

  function assetRow(a) {
    var gain = a.buyPrice > 0 ? MT.round2(a.value - a.buyPrice) : null;
    var flag = a.syncError ? '<span class="dot bad" title="Not accepted by the sheet: ' + esc(rejectText(a.syncError)) + '"></span>' : (a.dirty ? '<span class="dot" title="Not synced yet"></span>' : '');
    var sub = (a.buyPrice > 0 ? 'Paid ' + plain(a.buyPrice) + ' · ' : '') + (a.valueDate ? 'as of ' + shortDate(a.valueDate) : 'value set') + (a.note ? ' · ' + a.note : '');
    return '<button class="tx" data-asset="' + esc(a.id) + '">' + assetBubble(a.type) + '<span class="txm"><b>' + esc(a.name) + flag + '</b><small>' + esc(sub) + '</small></span>' +
      '<span class="txa"><span>' + secret(a.value) + '</span>' + (gain !== null && !hidden() ? '<small class="' + (gain < 0 ? 'neg' : gain > 0 ? 'pos' : '') + '">' + (gain > 0 ? '+ ' : gain < 0 ? '- ' : '') + plain(Math.abs(gain)) + '</small>' : '') + '</span></button>';
  }

  function openAsset(id) {
    var a = id ? S.db.assets[id] : null;
    S.aEditId = a ? a.id : null; S.aErr = ''; S.confirmDelete = false;
    S.af = a ? { name: a.name, type: a.type, value: String(a.value), buyPrice: a.buyPrice ? String(a.buyPrice) : '', buyDate: a.buyDate || '', note: a.note || '' }
      : { name: '', type: MT.assetTypes(S.db)[0] || 'Other', value: '', buyPrice: '', buyDate: '', note: '' };
    S.view = 'asset'; render(); window.scrollTo(0, 0);
  }

  function assetView() {
    if (!S.af) openAsset(null);
    var f = S.af, db = S.db, cur = S.aEditId ? db.assets[S.aEditId] : null;
    var html = '';
    if (cur && cur.syncError) html += '<div class="banner bad">' + ic('alert') + '<span>The sheet did not accept this asset because ' + esc(rejectText(cur.syncError)) + '. Check it and save again.</span></div>';
    html += '<form id="assetForm" novalidate>' +
      '<label for="af-name" style="margin-top:4px">Name</label><input id="af-name" data-af="name" maxlength="60" autocomplete="off" placeholder="For example, Gold ring or Plot in Rajshahi" value="' + esc(f.name) + '">' +
      '<label>Type</label>' + chipRow('type', MT.assetTypes(db, f.type), f.type, 'achip') +
      '<label for="af-value">Worth now (৳)</label><div class="amount t-asset" style="margin-top:0"><span aria-hidden="true">৳</span><input id="af-value" data-af="value" inputmode="decimal" placeholder="0" autocomplete="off" value="' + esc(f.value) + '"></div>' +
      (cur && cur.valueDate ? '<p class="note">Value last set on ' + esc(shortDate(cur.valueDate)) + '. Change it any time prices move.</p>' : '<p class="note">Your own estimate or the market price today.</p>') +
      '<label for="af-price">What you paid (৳, optional)</label><input id="af-price" data-af="buyPrice" inputmode="decimal" autocomplete="off" value="' + esc(f.buyPrice) + '">' +
      '<label for="af-date">Bought on (optional)</label><input id="af-date" data-af="buyDate" type="date" value="' + esc(f.buyDate) + '">' +
      '<label for="af-note">Note (optional)</label><input id="af-note" data-af="note" maxlength="200" autocomplete="off" value="' + esc(f.note) + '">' +
      '<p class="err" id="aerr" role="alert">' + esc(S.aErr) + '</p>' +
      '<button class="btn primary block" type="submit">Save asset</button>' +
      '<div style="display:flex;gap:8px;margin-top:10px"><button type="button" class="btn" style="flex:1" data-act="cancel-asset">Cancel</button>' +
      (S.aEditId ? '<button type="button" class="btn danger" style="flex:1" data-act="delete-asset">' + (S.confirmDelete ? 'Tap again to delete' : 'Delete') + '</button>' : '') + '</div></form>';
    return html;
  }

  function backFromAsset() {
    S.af = null; S.aEditId = null; S.aErr = ''; S.confirmDelete = false;
    S.view = 'worth'; S.wtab = 'assets';
    render(); window.scrollTo(0, 0);
  }

  function onSaveAsset() {
    var f = S.af;
    var payload = { name: f.name, type: f.type, value: f.value === '' ? '' : num(f.value), buyPrice: f.buyPrice === '' ? '' : num(f.buyPrice), buyDate: f.buyDate, note: f.note };
    var msg = MT.checkAsset(payload);
    if (msg) { S.aErr = msg; var e = document.getElementById('aerr'); if (e) e.textContent = msg; return; }
    MT.saveAsset(S.db, payload, S.aEditId);
    persist();
    backFromAsset();
    toast(navigator.onLine ? 'Saved' : 'Saved on this device. Will sync when online.');
    scheduleSync(500);
  }

  function onDeleteAsset() {
    if (!S.confirmDelete) { S.confirmDelete = true; renderView(); return; }
    MT.deleteAsset(S.db, S.aEditId);
    persist();
    backFromAsset();
    toast('Deleted');
    scheduleSync(500);
  }

  // ------------------------------------------------------------ settings

  function settingsView() {
    var db = S.db, p = MT.pendingCount(db), lock = db.settings.autoLock;
    var html = syncBanners();
    if (Math.abs(db.skewMs || 0) > 120000) {
      html += '<div class="banner warn">' + ic('clock') + '<span>This device’s clock is off by about ' + Math.round(Math.abs(db.skewMs) / 60000) + ' minutes. Edits are ordered by time, so please fix the clock.</span></div>';
    }
    if (db.lastSync && db.srvVersion < NEED_SCRIPT) {
      html += '<div class="banner warn">' + ic('alert') + '<span>Your Google script is an older version. Paste the newest Code.gs into it and deploy a new version. Loans and assets need it.</span></div>';
    }

    // the sheet
    var sh = db.sheet, url = sh && /^https:\/\/docs\.google\.com\/spreadsheets\//.test(sh.url) ? sh.url : '';
    html += '<h3>Google Sheet</h3><div class="sheet">' +
      '<div class="row"><span class="lead">' + ic('sheet') + '<span>' + (sh ? esc(sh.name) : 'Not connected yet') + '<small>' + (sh ? 'Transactions tab' : 'Sync to connect') + '</small></span></span>' +
      (url ? '<a class="link" href="' + esc(url) + '" target="_blank" rel="noopener">Open</a>' : '') + '</div>' +
      '<div class="row"><span>Entries in the sheet</span><small class="num">' + (sh ? sh.live : '—') + '</small></div>' +
      '<div class="row"><span>Entries on this device</span><small class="num">' + MT.liveTx(db).length + '</small></div>' +
      '<div class="row"><span>Assets (sheet / device)</span><small class="num">' + (sh && sh.assets !== undefined ? sh.assets : '—') + ' / ' + MT.liveAssets(db).length + '</small></div>' +
      '<div class="row"><span>Waiting to sync</span><small class="num">' + p + '</small></div>' +
      '<div class="row"><span>Last synced</span><small>' + esc(timeAgo(db.lastSync)) + '</small></div>' +
      '<div class="row"><button class="rowbtn" data-act="sync"><span class="lead">' + ic('refresh') + 'Sync now</span><small>' + (S.syncing ? 'Syncing…' : '') + '</small></button></div></div>' +
      '<p class="note" style="margin:8px 4px 0">Accounts (with their group), categories, asset types, and transfer charges are edited in your Google Sheet and reach this app at the next sync.</p>';

    var bad = MT.rejectedTx(db), badA = MT.rejectedAssets(db);
    if (bad.length || badA.length) {
      html += '<h3>Needs attention</h3><div class="sheet list">' + bad.map(function (t) { return txRow(t, true); }).join('') + badA.map(assetRow).join('') + '</div>' +
        '<p class="note" style="margin:8px 4px 0">The sheet refused these because the data was not valid. Open one, check it, and save again.</p>';
    }

    html += '<h3>Security</h3><div class="sheet"><div class="row stack"><div style="margin-bottom:10px">Lock automatically after</div><div class="seg plain" role="group" aria-label="Auto-lock">' +
      [[0, 'Instant'], [1, '1 min'], [5, '5 min'], [15, '15 min']].map(function (o) {
        return '<button type="button" data-lockmin="' + o[0] + '" aria-pressed="' + (lock === o[0]) + '">' + o[1] + '</button>';
      }).join('') + '</div></div>' +
      '<div class="row"><button class="rowbtn" data-act="to-password"><span class="lead">' + ic('key') + 'Change password</span>' + ic('right') + '</button></div>' +
      '<div class="row"><button class="rowbtn" data-act="lock"><span class="lead">' + ic('lock') + 'Lock now</span></button></div></div>' +
      '<p class="note" style="margin:8px 4px 0">Data on this device is encrypted with your password.</p>';

    html += '<h3>Data</h3><div class="sheet"><div class="row"><button class="rowbtn" data-act="export"><span class="lead">' + ic('download') + 'Export to CSV</span></button></div>' +
      '<div class="row"><button class="rowbtn" data-act="reset-device" style="color:var(--bad)"><span class="lead">' + ic('trash') + (S.confirmReset ? 'Tap again to reset this device' : 'Reset this device') + '</span></button></div></div>';
    if (S.confirmReset) html += '<p class="note" style="margin:8px 4px 0">' + (p ? 'This device still has ' + p + ' item' + (p === 1 ? '' : 's') + ' waiting to sync, and they would be lost. ' : '') + 'Your sheet keeps everything that has synced.</p>';
    return html + '<p class="note" style="text-align:center;margin-top:24px">MoneyTrack ' + VERSION + (db.srvVersion ? ' · script ' + db.srvVersion : '') + '</p>';
  }

  function passwordView() {
    return '<form id="pwForm" novalidate autocomplete="off">' +
      '<p class="note" style="margin-top:0">This changes the password on this device. Set the same value as PASSWORD in your script’s Script properties, or syncing will stop working.</p>' +
      '<label for="np1">New password</label><div class="pw"><input id="np1" type="password" autocomplete="new-password" autocapitalize="off" spellcheck="false">' +
      '<button type="button" class="eye" data-act="eye" aria-label="Show password">' + ic('eye') + '</button></div>' +
      '<label for="np2">Repeat new password</label><input id="np2" type="password" autocomplete="new-password" autocapitalize="off" spellcheck="false">' +
      '<p class="err" id="pwErr" role="alert">' + esc(S.pwErr) + '</p>' +
      '<button class="btn primary block" id="pwBtn" type="submit">Change password</button>' +
      '<button type="button" class="btn block" style="margin-top:10px" data-go="settings">Cancel</button></form>';
  }

  async function savePassword() {
    var a = document.getElementById('np1').value, b = document.getElementById('np2').value;
    var err = document.getElementById('pwErr');
    if (a.length < 8) { err.textContent = 'Use at least 8 characters'; return; }
    if (a !== b) { err.textContent = 'The two passwords don’t match'; return; }
    var btn = document.getElementById('pwBtn'); btn.disabled = true; btn.textContent = 'Changing…';
    try {
      S.key = await vault.rekey(a, S.db);
      S.password = a; S.syncError = ''; S.pwErr = '';
      S.view = 'settings';
      render();
      toast('Password changed on this device');
      doSync(false);
    } catch (e) {
      btn.disabled = false; btn.textContent = 'Change password';
      err.textContent = 'Could not change the password. Try again.';
    }
  }

  function exportCsv() {
    var blob = new Blob(['﻿' + MT.toCsv(S.db)], { type: 'text/csv;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'moneytrack-' + MT.todayStr() + '.csv';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1500);
  }

  // ------------------------------------------------------------ events

  function go(v) {
    if (v === 'add' && S.view !== 'add') { S.editId = null; S.form = newForm(); S.formErr = ''; S.confirmDelete = false; }
    if (v !== 'add' && S.view === 'add') { S.form = null; S.editId = null; S.confirmDelete = false; }
    if (v !== 'loan' && S.view === 'loan') { S.lf = null; S.lEditId = null; S.lErr = ''; S.confirmDelete = false; }
    if (v !== 'asset' && S.view === 'asset') { S.af = null; S.aEditId = null; S.aErr = ''; S.confirmDelete = false; }
    if (v !== 'settings') S.confirmReset = false;
    S.view = v;
    render();
    window.scrollTo(0, 0);
  }

  function fireChip(k, v) {
    S.form[k] = v; S.formErr = '';
    if (S.form.type === 'transfer' && v && S.form.wallet === S.form.toWallet) {
      var other = MT.activeWallets(S.db, k === 'wallet' ? S.form.toWallet : S.form.wallet).filter(function (x) { return x !== v; })[0] || '';
      if (k === 'wallet') S.form.toWallet = other; else S.form.wallet = other;
    }
    if (k === 'wallet' || k === 'toWallet') recalcFee();
    renderView();
  }

  var CLICKABLE = '[data-act],[data-go],[data-edit],[data-chip],[data-seg],[data-lockmin],[data-pick],[data-quick],[data-rscope],[data-datechip],[data-wallet-go],[data-gpick],[data-gtoggle],[data-gall],[data-wtab],[data-worth],[data-person],[data-lnew],[data-lseg],[data-lchip],[data-lpchip],[data-ldatechip],[data-ldue],[data-lfull],[data-asset],[data-anew],[data-achip]';

  app.addEventListener('click', function (e) {
    var el = e.target.closest(CLICKABLE);
    if (!el || !app.contains(el)) return;
    var act = el.getAttribute('data-act');

    if (el.hasAttribute('data-go')) { go(el.getAttribute('data-go')); return; }
    if (el.hasAttribute('data-edit')) { openEdit(el.getAttribute('data-edit')); return; }
    if (el.hasAttribute('data-quick')) { openAdd(el.getAttribute('data-quick')); return; }
    if (el.hasAttribute('data-wallet-go')) {
      S.hist = { type: '', category: '', wallet: el.getAttribute('data-wallet-go'), q: '' };
      S.ym = MT.monthOf(MT.todayStr());
      go('history');
      return;
    }
    if (el.hasAttribute('data-gtoggle')) {
      var gn = el.getAttribute('data-gtoggle'), cl = S.db.settings.collapsed || {};
      if (cl[gn]) delete cl[gn]; else cl[gn] = true;
      S.db.settings.collapsed = cl; persist(); renderView(); return;
    }
    if (el.hasAttribute('data-gall')) {
      var closeAll = el.getAttribute('data-gall') === 'close', cl2 = {};
      if (closeAll) MT.balances(S.db).groups.forEach(function (g) { cl2[g.name] = true; });
      S.db.settings.collapsed = cl2; persist(); renderView(); return;
    }
    if (el.hasAttribute('data-wtab')) { S.wtab = el.getAttribute('data-wtab'); renderView(); return; }
    if (el.hasAttribute('data-worth')) { S.wtab = el.getAttribute('data-worth'); go('worth'); return; }
    if (el.hasAttribute('data-person')) { S.person = el.getAttribute('data-person'); go('person'); return; }
    if (el.hasAttribute('data-lnew')) { openLoan(el.getAttribute('data-lnew'), el.getAttribute('data-lperson') || ''); return; }
    if (el.hasAttribute('data-anew')) { openAsset(null); return; }
    if (el.hasAttribute('data-asset')) { openAsset(el.getAttribute('data-asset')); return; }
    if (el.hasAttribute('data-lseg')) {
      var lt = el.getAttribute('data-lseg');
      if (S.lf.type !== lt) {
        S.lf.type = lt; S.lErr = '';
        if (lt === 'collect' || lt === 'repay') S.lf.due = '';
        renderView();
      }
      return;
    }
    if (el.hasAttribute('data-lchip')) { S.lf.wallet = el.getAttribute('data-v'); S.lErr = ''; renderView(); return; }
    if (el.hasAttribute('data-achip')) { S.af.type = el.getAttribute('data-v'); S.aErr = ''; renderView(); return; }
    if (el.hasAttribute('data-lpchip')) {
      S.lf.person = el.getAttribute('data-lpchip');
      var pp = personFind(MT.personKey(S.lf.person));
      var owe = pp ? (S.lf.type === 'collect' ? pp.toGet : pp.toPay) : 0;
      if (owe > 0 && (S.lf.amount === '' || num(S.lf.amount) > owe)) S.lf.amount = String(owe);
      S.lErr = ''; renderView(); return;
    }
    if (el.hasAttribute('data-lfull')) {
      S.lf.amount = el.getAttribute('data-lfull');
      var la = document.getElementById('lf-amount'); if (la) la.value = S.lf.amount;
      updateLoanHint(); return;
    }
    if (el.hasAttribute('data-ldatechip')) {
      var ld = new Date();
      if (el.getAttribute('data-ldatechip') === 'yesterday') ld.setDate(ld.getDate() - 1);
      S.lf.date = MT.todayStr(ld); S.lErr = '';
      var ldi = document.getElementById('lf-date'); if (ldi) ldi.value = S.lf.date;
      app.querySelectorAll('[data-ldatechip]').forEach(function (c) { c.setAttribute('aria-pressed', String(c === el)); });
      return;
    }
    if (el.hasAttribute('data-ldue')) {
      var n = Number(el.getAttribute('data-ldue'));
      if (n === 0) S.lf.due = '';
      else { var base = MT.validDate(S.lf.date) ? new Date(S.lf.date + 'T00:00:00') : new Date(); base.setDate(base.getDate() + n); S.lf.due = MT.todayStr(base); }
      var dui = document.getElementById('lf-due'); if (dui) dui.value = S.lf.due;
      return;
    }
    if (el.hasAttribute('data-rscope')) { S.rscope = el.getAttribute('data-rscope'); S.rsel = null; renderView(); return; }
    if (el.hasAttribute('data-pick')) { S.rsel = { k: el.getAttribute('data-pick'), i: Number(el.getAttribute('data-i')) }; renderView(); return; }
    if (el.hasAttribute('data-datechip')) {
      var d = new Date();
      if (el.getAttribute('data-datechip') === 'yesterday') d.setDate(d.getDate() - 1);
      S.form.date = MT.todayStr(d); S.formErr = '';
      var di = document.getElementById('f-date'); if (di) di.value = S.form.date;
      app.querySelectorAll('[data-datechip]').forEach(function (c) { c.setAttribute('aria-pressed', String(c === el)); });
      return;
    }
    if (el.hasAttribute('data-seg')) {
      var type = el.getAttribute('data-seg');
      if (S.form.type !== type) {
        var keep = { amount: S.form.amount, date: S.form.date, note: S.form.note, wallet: S.form.wallet };
        S.form = newForm(type);
        S.form.amount = keep.amount; S.form.date = keep.date; S.form.note = keep.note;
        if (MT.activeWallets(S.db, keep.wallet).indexOf(keep.wallet) >= 0) S.form.wallet = keep.wallet;
        if (S.form.toWallet === S.form.wallet) S.form.toWallet = MT.activeWallets(S.db).filter(function (x) { return x !== S.form.wallet; })[0] || '';
        recalcFee();
        S.formErr = '';
        renderView();
      }
      return;
    }
    if (el.hasAttribute('data-gpick')) {
      var gk = el.getAttribute('data-gpick'), gv = el.getAttribute('data-v');
      var ga = gk.split(':')[0], gkey = gk.split(':')[1];
      var obj = ga === 'lchip' ? S.lf : S.form;
      obj._g = obj._g || {};
      obj._g[gk] = gv;
      var inGroup = MT.activeWallets(S.db).filter(function (n) { return MT.groupOf(S.db, n) === gv; });
      if (inGroup.length === 1) {
        if (ga === 'lchip') { S.lf.wallet = inGroup[0]; S.lErr = ''; renderView(); }
        else { fireChip(gkey, inGroup[0]); }
        return;
      }
      if (inGroup.indexOf(obj[gkey]) < 0) { obj[gkey] = ''; if (ga === 'chip') { S.formErr = ''; recalcFee(); } }
      renderView();
      return;
    }
    if (el.hasAttribute('data-chip')) {
      fireChip(el.getAttribute('data-chip'), el.getAttribute('data-v'));
      return;
    }
    if (el.hasAttribute('data-lockmin')) {
      S.db.settings.autoLock = Number(el.getAttribute('data-lockmin'));
      persist(); resetIdle(); renderView(); return;
    }

    switch (act) {
      case 'eye': {
        var inp = el.parentNode.querySelector('input');
        var show = inp.type === 'password';
        inp.type = show ? 'text' : 'password';
        el.innerHTML = ic(show ? 'eyeoff' : 'eye');
        el.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
        break;
      }
      case 'hide': S.db.settings.hideBalance = !S.db.settings.hideBalance; persist(); renderView(); break;
      case 'reset-ask': S.resetAsk = true; renderLock(); break;
      case 'reset-do': vault.wipe(); clearThrottle(); S.resetAsk = false; S.lockMsg = ''; renderLock(); break;
      case 'pill': if (S.syncError || MT.rejectedTx(S.db).length || MT.rejectedAssets(S.db).length) go('settings'); else doSync(true); break;
      case 'mprev': S.ym = MT.addMonths(S.ym, -1); renderView(); break;
      case 'mnext': S.ym = MT.addMonths(S.ym, 1); renderView(); break;
      case 'rprev':
        if (S.rscope === 'month') S.rm = MT.addMonths(S.rm, -1); else S.ry = String(Number(S.ry) - 1);
        S.rsel = null; renderView(); break;
      case 'rnext':
        if (S.rscope === 'month') { if (S.rm < MT.monthOf(MT.todayStr())) S.rm = MT.addMonths(S.rm, 1); }
        else if (S.ry < MT.todayStr().slice(0, 4)) S.ry = String(Number(S.ry) + 1);
        S.rsel = null; renderView(); break;
      case 'review': {
        var first = MT.rejectedTx(S.db)[0], firstA = MT.rejectedAssets(S.db)[0];
        if (first) openEdit(first.id); else if (firstA) openAsset(firstA.id);
        break;
      }
      case 'cancel-loan': backFromLoan(); break;
      case 'delete-loan': onDeleteLoan(); break;
      case 'cancel-asset': backFromAsset(); break;
      case 'delete-asset': onDeleteAsset(); break;
      case 'cancel-edit': go('history'); break;
      case 'delete': onDelete(); break;
      case 'to-password': S.pwErr = ''; S.view = 'password'; render(); window.scrollTo(0, 0); break;
      case 'lock': lockNow(); break;
      case 'sync': doSync(true); break;
      case 'export': exportCsv(); break;
      case 'reset-device':
        if (!S.confirmReset) { S.confirmReset = true; renderView(); }
        else { vault.wipe(); clearThrottle(); lockNow(); }
        break;
    }
  });

  function onInput(e) {
    var t = e.target;
    if (t.hasAttribute('data-f')) { onField(t); return; }
    if (t.hasAttribute('data-lf')) { onLoanField(t); return; }
    if (t.hasAttribute('data-af')) {
      if (!S.af) return;
      S.af[t.getAttribute('data-af')] = t.value; S.aErr = '';
      var ae = document.getElementById('aerr'); if (ae) ae.textContent = '';
      return;
    }
    if (t.hasAttribute('data-hf')) {
      S.hist[t.getAttribute('data-hf')] = t.value;
      renderHistoryBody();
    }
  }
  app.addEventListener('input', onInput);
  app.addEventListener('change', onInput);

  app.addEventListener('submit', function (e) {
    e.preventDefault();
    if (e.target.id === 'lockForm') onLockSubmit();
    else if (e.target.id === 'addForm') onSave();
    else if (e.target.id === 'loanForm') onSaveLoan();
    else if (e.target.id === 'assetForm') onSaveAsset();
    else if (e.target.id === 'pwForm') savePassword();
  });

  // ------------------------------------------------------------ start

  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    navigator.serviceWorker.register('sw.js').catch(function () { /* the app still works without it */ });
  }
  render();
})();
