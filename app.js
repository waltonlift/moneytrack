/* MoneyTrack screens. Logic lives in core.js. */
(function () {
  'use strict';

  var SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbw_GaONuNDMJ_bg3dfXyyqlMYgwU5DVXplSPG3gUaEeYgHjwyWdwFVF4ygzCQmlorUy2g/exec';
  var VERSION = '1.0';

  var vault = MT.makeVault(window.localStorage);
  var post = MT.makePost(SCRIPT_URL, function (u, o) { return window.fetch(u, o); });
  var app = document.getElementById('app');

  var S = {
    unlocked: false, db: null, key: null, password: null,
    view: 'home', ym: MT.monthOf(MT.todayStr()),
    hist: { type: '', category: '', wallet: '', q: '' },
    form: null, editId: null, formErr: '', confirmDelete: false,
    syncing: false, syncError: '', syncAgain: false,
    lockMsg: '', busy: false, resetAsk: false, confirmReset: false, pwErr: ''
  };

  // ------------------------------------------------------------ small helpers

  var ICONS = {
    home: '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>',
    list: '<line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>',
    plus: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
    chart: '<path d="M21.21 15.89A10 10 0 1 1 8 2.83"/><path d="M22 12A10 10 0 0 0 12 2v10z"/>',
    sliders: '<line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/>',
    lock: '<rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
    eye: '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>',
    eyeoff: '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>',
    left: '<polyline points="15 18 9 12 15 6"/>',
    right: '<polyline points="9 18 15 12 9 6"/>',
    swap: '<polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>'
  };
  function ic(name) { return '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true">' + ICONS[name] + '</svg>'; }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function $(sel) { return app.querySelector(sel); }
  function money(n) { return MT.fmtMoney(n); }

  function normDigits(s) {   // Bengali digits to 0-9
    return String(s).replace(/[০-৯]/g, function (d) { return String(d.charCodeAt(0) - 0x09E6); });
  }
  function num(s) {
    var t = normDigits(s).replace(/[,\s]/g, '');
    return t === '' ? NaN : Number(t);
  }

  function hueOf(name) {
    var h = 0;
    for (var i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
    return h;
  }
  function bubble(t) {
    if (t.type === 'transfer') return '<span class="bubble" style="--h:210">' + ic('swap') + '</span>';
    var n = t.category || '?';
    return '<span class="bubble" style="--h:' + hueOf(n) + '">' + esc(Array.from(n)[0].toUpperCase()) + '</span>';
  }

  function shortDate(d) {
    var p = d.split('-').map(Number);
    return p[2] + ' ' + ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][p[1] - 1];
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
    toastTimer = setTimeout(function () { el.classList.remove('on'); }, 2600);
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
      case 'bad_response': return 'The script’s answer was unexpected. Check that access is set to Anyone.';
      case 'server': return 'The script reported a problem: ' + (d.message || 'unknown');
      default: return 'Something went wrong (' + (r.error || 'unknown') + ').';
    }
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
        S.syncError = r.error === 'wrong_password' ? 'wrong_password' : errorText(r);
        S.syncErrorText = errorText(r);
      } else {
        S.syncError = '';
      }
    } catch (e) {
      S.syncError = 'network';
      S.syncErrorText = 'Couldn’t reach the sheet. It will try again.';
    }
    S.syncing = false;
    if (key) { vault.save(key, db).catch(function () {}); }
    if (S.unlocked && S.db === db) {
      if (manual && !S.syncError) toast('Synced');
      refreshAfterSync();
      if (S.syncAgain) { S.syncAgain = false; scheduleSync(300); }
    }
  }

  function refreshAfterSync() {
    renderStatus();
    if (S.view === 'history') renderHistoryBody();
    else if (S.view === 'home' || S.view === 'reports' || S.view === 'settings') renderView();
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
      else resetIdle();
      hiddenAt = 0;
    }
  });

  function lockNow() {
    clearTimeout(idleTimer); clearTimeout(syncTimer);
    S.unlocked = false; S.db = null; S.key = null; S.password = null;
    S.form = null; S.editId = null; S.view = 'home'; S.lockMsg = ''; S.resetAsk = false; S.syncError = '';
    S.confirmReset = false; S.confirmDelete = false; S.syncing = false;
    S.hist = { type: '', category: '', wallet: '', q: '' };
    S.ym = MT.monthOf(MT.todayStr());
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
  function setLockBusy(b) {
    var btn = document.getElementById('lockBtn');
    if (!btn) return;
    btn.disabled = b;
    btn.textContent = b ? (vault.exists() ? 'Unlocking…' : 'Connecting…') : (vault.exists() ? 'Unlock' : 'Connect');
  }

  function startSession(db, key, pw) {
    S.db = db; S.key = key; S.password = pw; S.unlocked = true;
    S.view = 'home'; S.lockMsg = ''; S.syncError = '';
    resetIdle();
    render();
    doSync(false);
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
          startSession(opened.db, opened.key, pw);
        }
      } else {
        if (!navigator.onLine) { setLockMsg('No internet. The first sign-in on a device needs internet.'); return; }
        var db = MT.emptyDb();
        var r;
        try { r = await MT.runSync(db, pw, post); }
        catch (e) { setLockMsg('Couldn’t reach the sheet. Check your internet and try again.'); return; }
        if (!r.ok) { setLockMsg(errorText(r)); return; }
        var key = await vault.create(pw, db);
        startSession(db, key, pw);
      }
    } finally {
      S.busy = false; setLockBusy(false);
    }
  }

  function renderLock() {
    var setup = !vault.exists();
    var online = navigator.onLine;
    var hint = setup
      ? 'Use the password you set in the script. The first sign-in on a device needs internet.'
      : (online ? '' : 'You’re offline. Unlocking still works.');
    var h = '<form class="lock" id="lockForm" autocomplete="off" novalidate>' +
      '<div class="lock-ic">' + ic('lock') + '</div>' +
      '<h1>MoneyTrack</h1>' +
      '<p class="sub">' + (setup ? 'Set up this device' : 'Enter your password to unlock') + '</p>' +
      '<div class="pw"><input id="pw" type="password" placeholder="Password" autocomplete="current-password" autocapitalize="off" spellcheck="false" aria-label="Password">' +
      '<button type="button" class="eye" data-act="eye" aria-label="Show password">' + ic('eye') + '</button></div>' +
      '<p class="err" id="lockErr" role="alert">' + esc(S.lockMsg) + '</p>' +
      '<button class="btn primary block" id="lockBtn" type="submit">' + (setup ? 'Connect' : 'Unlock') + '</button>' +
      '<p class="hint">' + esc(hint) + '</p>';
    if (!setup) {
      if (!S.resetAsk) h += '<button type="button" class="link" data-act="reset-ask">Forgot password?</button>';
      else h += '<div class="banner warn" style="text-align:left">Resetting removes this device’s copy, including anything not yet synced. Your sheet keeps everything else, and you sign in again with the sheet’s password.</div>' +
        '<button type="button" class="btn danger block" data-act="reset-do">Reset this device</button>';
    }
    h += '</form>';
    app.innerHTML = h;
    var pwEl = document.getElementById('pw');
    if (pwEl) pwEl.focus();
  }

  // ------------------------------------------------------------ shell

  var TITLES = { home: 'MoneyTrack', history: 'History', add: 'Add transaction', reports: 'Reports', settings: 'Settings', password: 'Change password' };

  function render() {
    if (!S.unlocked) { renderLock(); return; }
    if (!document.getElementById('view')) {
      app.innerHTML = '<div id="top"><div><h1 id="title"></h1><small id="sub"></small></div><button class="pill" id="pill" data-act="pill"></button></div>' +
        '<main id="view"></main>' +
        '<nav id="nav" aria-label="Main">' +
        navBtn('home', 'Home', 'home') + navBtn('history', 'History', 'list') +
        '<button class="add" data-go="add" data-nav="add" aria-label="Add transaction"><span class="sq">' + ic('plus') + '</span><span>Add</span></button>' +
        navBtn('reports', 'Reports', 'chart') + navBtn('settings', 'Settings', 'sliders') + '</nav>';
    }
    renderView();
  }
  function navBtn(go, label, icon) {
    return '<button data-go="' + go + '" data-nav="' + go + '">' + ic(icon) + '<span>' + label + '</span></button>';
  }

  function renderView() {
    if (!S.unlocked) return;
    var title = S.view === 'add' && S.editId ? 'Edit transaction' : TITLES[S.view];
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
    document.getElementById('view').innerHTML = html;
    var navKey = S.view === 'password' ? 'settings' : S.view;
    app.querySelectorAll('[data-nav]').forEach(function (b) {
      if (b.getAttribute('data-nav') === navKey) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
    });
    renderStatus();
  }

  function statusInfo() {
    var p = MT.pendingCount(S.db);
    if (S.syncing) return { t: 'Syncing…', c: '' };
    if (S.syncError) return { t: 'Sync problem', c: 'bad' };
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

  // ------------------------------------------------------------ home

  function txRow(t, showDate) {
    var isT = t.type === 'transfer';
    var title = isT ? t.wallet + ' → ' + t.toWallet : t.category;
    var sub = (showDate ? shortDate(t.date) + ' · ' : '') + (isT ? 'Transfer' : t.wallet) + (t.note ? ' · ' + t.note : '');
    var amt;
    if (t.type === 'income') amt = '<span class="pos">+ ' + money(t.amount) + '</span>';
    else if (t.type === 'expense') amt = '<span class="neg">- ' + money(t.amount) + '</span>';
    else amt = '<span>' + money(t.amount) + '</span>' + (t.fee > 0 ? '<small>Fee ' + money(t.fee) + '</small>' : '');
    var flag = t.syncError ? '<span class="dot bad" title="Not accepted by the sheet: ' + esc(t.syncError) + '"></span>'
      : (t.dirty ? '<span class="dot" title="Not synced yet"></span>' : '');
    return '<button class="tx" data-edit="' + esc(t.id) + '">' + bubble(t) +
      '<span class="txm"><b>' + esc(title) + flag + '</b><small>' + esc(sub) + '</small></span>' +
      '<span class="txa">' + amt + '</span></button>';
  }

  function homeView() {
    var db = S.db, b = MT.balances(db), today = MT.todayStr();
    var s = MT.monthSummary(db, MT.monthOf(today), today);
    var recent = MT.filterTx(db, {}).slice(0, 5);
    var html = '';
    if (S.syncError === 'wrong_password') {
      html += '<div class="banner bad">The sheet no longer accepts this password. <button class="link" data-act="to-password">Change password</button></div>';
    } else if (S.syncError && S.syncError !== 'network') {
      html += '<div class="banner bad">' + esc(S.syncErrorText || 'Sync problem') + '</div>';
    }
    html += '<section class="hero"><p class="lbl">Total balance</p><p class="big">' + money(b.total) + '</p>' +
      '<div class="duo"><div><span>Income this month</span><b>' + money(s.income) + '</b></div>' +
      '<div><span>Spent this month</span><b>' + money(s.expense) + '</b></div></div></section>';
    var shown = b.wallets.filter(function (w) { return w.active || w.balance !== 0; });
    html += '<div class="sec-h"><h2>Wallets</h2></div>';
    if (!shown.length) html += '<p class="note">No wallets yet. Sync to load them from your sheet.</p>';
    else html += '<div class="wallets">' + shown.map(function (w) {
      return '<div class="card"><small>' + esc(w.name) + '</small><b class="' + (w.balance < 0 ? 'neg' : '') + '">' + money(w.balance) + '</b></div>';
    }).join('') + '</div>';
    html += '<div class="sec-h"><h2>Recent</h2><button class="link" data-go="history">See all</button></div>';
    if (!recent.length) {
      html += '<div class="card empty"><h2>Start with your first transaction</h2><p>Add an expense, income, or transfer.</p>' +
        '<button class="btn primary" data-go="add">Add transaction</button></div>';
    } else html += '<div class="card list">' + recent.map(function (t) { return txRow(t, true); }).join('') + '</div>';
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

  function chipRow(key, items, selected) {
    if (!items.length) return '<p class="note">None available. Sync to load them from your sheet.</p>';
    return '<div class="chips" role="group">' + items.map(function (n) {
      return '<button type="button" class="chip" data-chip="' + key + '" data-v="' + esc(n) + '" aria-pressed="' + (n === selected) + '">' + esc(n) + '</button>';
    }).join('') + '</div>';
  }

  function addView() {
    if (!S.form) S.form = newForm();
    var f = S.form, db = S.db, isT = f.type === 'transfer';
    var types = [['expense', 'Expense'], ['income', 'Income'], ['transfer', 'Transfer']];
    var html = '<form id="addForm" novalidate>' +
      '<div class="seg" role="group" aria-label="Type">' + types.map(function (t) {
        return '<button type="button" data-seg="' + t[0] + '" aria-pressed="' + (f.type === t[0]) + '">' + t[1] + '</button>';
      }).join('') + '</div>' +
      '<div class="amount"><span aria-hidden="true">৳</span><input id="f-amount" data-f="amount" inputmode="decimal" placeholder="0" autocomplete="off" aria-label="Amount" value="' + esc(f.amount) + '"></div>';
    if (!isT) {
      html += '<label>Category</label>' + chipRow('category', MT.categoriesFor(db, f.type, f.category), f.category) +
        '<label>Wallet</label>' + chipRow('wallet', MT.activeWallets(db, f.wallet), f.wallet);
    } else {
      html += '<label>From</label>' + chipRow('wallet', MT.activeWallets(db, f.wallet), f.wallet) +
        '<label>To</label>' + chipRow('toWallet', MT.activeWallets(db, f.toWallet), f.toWallet) +
        '<label for="f-fee">Charge (৳)</label><input id="f-fee" data-f="fee" inputmode="decimal" autocomplete="off" value="' + esc(f.fee) + '">' +
        '<p class="note" id="fee-note">' + esc(feeNote()) + '</p>';
    }
    html += '<label for="f-date">Date</label><input id="f-date" data-f="date" type="date" value="' + esc(f.date) + '">' +
      '<label for="f-note">Note (optional)</label><input id="f-note" data-f="note" maxlength="200" autocomplete="off" value="' + esc(f.note) + '">' +
      '<p class="err" id="formErr" role="alert">' + esc(S.formErr) + '</p>' +
      '<button class="btn primary block" type="submit">Save</button>';
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
    return monthNav() +
      '<div class="filters">' +
      '<select data-hf="type" aria-label="Type">' + [['', 'All types'], ['income', 'Income'], ['expense', 'Expense'], ['transfer', 'Transfer']].map(function (o) {
        return '<option value="' + o[0] + '"' + (o[0] === h.type ? ' selected' : '') + '>' + o[1] + '</option>';
      }).join('') + '</select>' +
      '<select data-hf="category" aria-label="Category">' + opts(Object.keys(cats), h.category, 'All categories') + '</select>' +
      '<select data-hf="wallet" aria-label="Wallet">' + opts(wallets, h.wallet, 'All wallets') + '</select></div>' +
      '<input id="hq" data-hf="q" type="search" placeholder="Search notes" aria-label="Search notes" value="' + esc(h.q) + '">' +
      '<div id="histBody">' + histBodyHtml() + '</div>';
  }

  function histBodyHtml() {
    var list = MT.filterTx(S.db, { ym: S.ym, type: S.hist.type, category: S.hist.category, wallet: S.hist.wallet, q: S.hist.q });
    if (!list.length) return '<div class="empty"><p>No transactions match.</p></div>';
    var t = MT.filteredTotals(list);
    var html = '<div class="tot"><span>In <b class="pos">' + money(t.income) + '</b></span><span>Out <b class="neg">' + money(t.expense) + '</b></span></div>';
    MT.groupByDate(list).forEach(function (g) {
      html += '<div class="gh"><span>' + MT.dayLabel(g.date) + '</span><span>' + (g.net > 0 ? '+ ' : g.net < 0 ? '- ' : '') + money(Math.abs(g.net)) + '</span></div>' +
        '<div class="card list">' + g.items.map(function (x) { return txRow(x, false); }).join('') + '</div>';
    });
    return html;
  }
  function renderHistoryBody() {
    var el = document.getElementById('histBody');
    if (el) el.innerHTML = histBodyHtml();
  }

  // ------------------------------------------------------------ reports

  var PALETTE = ['#0f6e56', '#185fa5', '#ba7517', '#993556', '#534ab7', '#993c1d', '#3b6d11', '#5f5e5a'];

  function reportsView() {
    var s = MT.monthSummary(S.db, S.ym), six = MT.lastMonths(S.db, S.ym, 6);
    var html = monthNav() +
      '<div class="metrics"><div class="card"><small>Income</small><b class="pos">' + money(s.income) + '</b></div>' +
      '<div class="card"><small>Spent</small><b class="neg">' + money(s.expense) + '</b></div>' +
      '<div class="card"><small>Left</small><b class="' + (s.left < 0 ? 'neg' : '') + '">' + money(s.left) + '</b></div></div>';

    html += '<div class="sec-h"><h2>Spending by category</h2></div><div class="card pad">';
    if (!s.byCategory.length) html += '<p class="note" style="margin:0">No spending this month.</p>';
    else {
      var slices = s.byCategory.slice(0, 7).map(function (c, i) { return { name: c.name, amount: c.amount, pct: c.pct, color: PALETTE[i] }; });
      if (s.byCategory.length > 7) {
        var rest = s.byCategory.slice(7);
        slices.push({ name: 'Other categories', amount: MT.round2(rest.reduce(function (a, c) { return a + c.amount; }, 0)),
          pct: rest.reduce(function (a, c) { return a + c.pct; }, 0), color: PALETTE[7] });
      }
      var acc = 0;
      var circles = slices.map(function (sl) {
        var d = '<circle r="15.9155" cx="21" cy="21" fill="none" stroke="' + sl.color + '" stroke-width="6" stroke-dasharray="' +
          sl.pct.toFixed(3) + ' ' + (100 - sl.pct).toFixed(3) + '" stroke-dashoffset="' + (25 - acc).toFixed(3) + '"></circle>';
        acc += sl.pct;
        return d;
      }).join('');
      html += '<div class="pie"><svg viewBox="0 0 42 42" role="img" aria-label="Spending by category">' + circles + '</svg><div class="legend">' +
        slices.map(function (sl) {
          return '<div><i style="background:' + sl.color + '"></i><span>' + esc(sl.name) + '</span><span>' + money(sl.amount) + '</span><small>' + sl.pct.toFixed(0) + '%</small></div>';
        }).join('') + '</div></div>';
    }
    html += '</div>';

    var max = 1;
    six.forEach(function (m) { max = Math.max(max, m.income, m.expense); });
    html += '<div class="sec-h"><h2>Last 6 months</h2></div><div class="card pad"><div class="bars">' + six.map(function (m) {
      return '<div class="bg" role="img" aria-label="' + m.label + ': income ' + money(m.income) + ', spent ' + money(m.expense) + '"><div class="bb">' +
        '<i class="bi" style="height:' + (m.income / max * 100).toFixed(1) + '%"></i><i class="be" style="height:' + (m.expense / max * 100).toFixed(1) + '%"></i></div><small>' + m.label + '</small></div>';
    }).join('') + '</div><div class="key"><span><i style="background:var(--pos)"></i>Income</span><span><i style="background:var(--neg)"></i>Spent</span></div></div>';

    html += '<div class="sec-h"><h2>Quick facts</h2></div><div class="card pad facts">';
    if (!s.biggest && !s.byCategory.length) html += '<p class="note" style="margin:0">Facts appear once you have spending this month.</p>';
    else {
      html += '<div><span>Biggest expense</span><span>' + (s.biggest ? money(s.biggest.amount) + '<br><small>' + esc(s.biggest.category) + ' · ' + shortDate(s.biggest.date) + '</small>' : '—') + '</span></div>' +
        '<div><span>Average per day</span><span>' + money(s.avgPerDay) + '</span></div>' +
        '<div><span>Top category</span><span>' + (s.topCategory ? esc(s.topCategory.name) + '<br><small>' + s.topCategory.pct.toFixed(0) + '% of spending</small>' : '—') + '</span></div>';
      if (s.fees > 0) html += '<div><span>Transfer charges</span><span>' + money(s.fees) + '</span></div>';
    }
    return html + '</div>';
  }

  // ------------------------------------------------------------ settings

  function settingsView() {
    var db = S.db, p = MT.pendingCount(db), lock = db.settings.autoLock;
    var html = '';
    if (S.syncError === 'wrong_password') {
      html += '<div class="banner bad">The sheet no longer accepts this password. If you changed PASSWORD in the script, set the same one here.</div>';
    } else if (S.syncError) html += '<div class="banner bad">' + esc(S.syncErrorText || 'Sync problem') + '</div>';
    if (Math.abs(db.skewMs || 0) > 120000) {
      html += '<div class="banner warn">This device’s clock is off by about ' + Math.round(Math.abs(db.skewMs) / 60000) + ' minutes. Edits are ordered by time, so please fix the clock.</div>';
    }
    html += '<h3>Security</h3><div class="card"><div class="row" style="display:block"><div style="margin-bottom:10px">Auto-lock</div><div class="seg" role="group" aria-label="Auto-lock">' +
      [[0, 'Instant'], [1, '1 min'], [5, '5 min'], [15, '15 min']].map(function (o) {
        return '<button type="button" data-lockmin="' + o[0] + '" aria-pressed="' + (lock === o[0]) + '">' + o[1] + '</button>';
      }).join('') + '</div></div>' +
      '<div class="row"><button class="rowbtn" data-act="to-password"><span>Change password</span>' + ic('right') + '</button></div>' +
      '<div class="row"><button class="rowbtn" data-act="lock"><span>Lock now</span>' + ic('lock') + '</button></div></div>' +
      '<p class="note" style="margin:8px 4px 0">Data on this device is encrypted with your password.</p>';
    html += '<h3>Sync</h3><div class="card"><div class="row"><span>Last synced</span><small>' + esc(timeAgo(db.lastSync)) + '</small></div>' +
      '<div class="row"><span>Waiting to sync</span><small>' + p + '</small></div>' +
      '<div class="row"><button class="rowbtn" data-act="sync"><span>Sync now</span><small>' + (S.syncing ? 'Syncing…' : '') + '</small></button></div></div>' +
      '<p class="note" style="margin:8px 4px 0">Wallets, categories, and transfer charges are edited in your Google Sheet and reach this app at the next sync.</p>';
    html += '<h3>Data</h3><div class="card"><div class="row"><button class="rowbtn" data-act="export"><span>Export to CSV</span></button></div>' +
      '<div class="row"><button class="rowbtn" data-act="reset-device" style="color:var(--neg)"><span>' + (S.confirmReset ? 'Tap again to reset this device' : 'Reset this device') + '</span></button></div></div>';
    if (S.confirmReset) html += '<p class="note" style="margin:8px 4px 0">' + (p ? 'This device still has ' + p + ' item' + (p === 1 ? '' : 's') + ' waiting to sync, and they would be lost. ' : '') + 'Your sheet keeps everything that has synced.</p>';
    return html + '<p class="note" style="text-align:center;margin-top:24px">MoneyTrack ' + VERSION + '</p>';
  }

  function passwordView() {
    return '<form id="pwForm" novalidate autocomplete="off">' +
      '<p class="note">This changes the password on this device. Set the same value as PASSWORD in your script’s Script properties, or syncing will stop working.</p>' +
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
    if (v !== 'settings') S.confirmReset = false;
    S.view = v;
    render();
    window.scrollTo(0, 0);
  }

  app.addEventListener('click', function (e) {
    var el = e.target.closest('[data-act],[data-go],[data-edit],[data-chip],[data-seg],[data-lockmin]');
    if (!el || !app.contains(el)) return;
    var act = el.getAttribute('data-act');

    if (el.hasAttribute('data-go')) { go(el.getAttribute('data-go')); return; }
    if (el.hasAttribute('data-edit')) {
      var t = S.db.tx[el.getAttribute('data-edit')];
      if (!t) return;
      S.editId = t.id; S.form = formFromTx(t); S.formErr = ''; S.confirmDelete = false; S.view = 'add';
      render(); window.scrollTo(0, 0); return;
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
    if (el.hasAttribute('data-chip')) {
      var k = el.getAttribute('data-chip'), v = el.getAttribute('data-v');
      S.form[k] = v; S.formErr = '';
      if (S.form.type === 'transfer' && S.form.wallet === S.form.toWallet) {
        var other = MT.activeWallets(S.db, k === 'wallet' ? S.form.toWallet : S.form.wallet).filter(function (x) { return x !== v; })[0] || '';
        if (k === 'wallet') S.form.toWallet = other; else S.form.wallet = other;
      }
      if (k === 'wallet' || k === 'toWallet') recalcFee();
      renderView();
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
      case 'reset-ask': S.resetAsk = true; renderLock(); break;
      case 'reset-do': vault.wipe(); clearThrottle(); S.resetAsk = false; S.lockMsg = ''; renderLock(); break;
      case 'pill': if (S.syncError) go('settings'); else doSync(true); break;
      case 'mprev': S.ym = MT.addMonths(S.ym, -1); renderView(); break;
      case 'mnext': S.ym = MT.addMonths(S.ym, 1); renderView(); break;
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
    else if (e.target.id === 'pwForm') savePassword();
  });

  // ------------------------------------------------------------ start

  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    navigator.serviceWorker.register('sw.js').catch(function () { /* the app still works without it */ });
  }
  render();
})();
