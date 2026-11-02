/* MoneyTrack core: logic only, no screen code. Used by app.js and by the tests. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.MT = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var ITER = 250000;
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // ------------------------------------------------------------ helpers

  function round2(n) { return Math.round((Number(n) || 0) * 100) / 100; }

  function fmtMoney(n) {
    var v = round2(n);
    var s = Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
    return (v < 0 ? '-' : '') + '৳ ' + s;
  }

  function pad(n) { return String(n).padStart(2, '0'); }

  function todayStr(d) {
    d = d || new Date();
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  function validDate(s) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(s))) return false;
    var d = new Date(s + 'T00:00:00');
    return !isNaN(d.getTime()) && todayStr(d) === s;
  }

  function monthOf(date) { return String(date).slice(0, 7); }

  function addMonths(ym, k) {
    var p = ym.split('-').map(Number);
    var idx = p[0] * 12 + (p[1] - 1) + k;
    return Math.floor(idx / 12) + '-' + pad((idx % 12) + 1);
  }

  function monthLabel(ym) {
    var p = ym.split('-').map(Number);
    return MONTHS[p[1] - 1] + ' ' + p[0];
  }

  function daysInMonth(ym) {
    var p = ym.split('-').map(Number);
    return new Date(p[0], p[1], 0).getDate();
  }

  function dayLabel(date, today) {
    today = today || todayStr();
    if (date === today) return 'Today';
    var t = new Date(today + 'T00:00:00');
    t.setDate(t.getDate() - 1);
    if (date === todayStr(t)) return 'Yesterday';
    var p = date.split('-').map(Number);
    var d = new Date(p[0], p[1] - 1, p[2]);
    return DAYS[d.getDay()] + ', ' + p[2] + ' ' + MONTHS[p[1] - 1].slice(0, 3);
  }

  function uid() {
    var c = typeof crypto !== 'undefined' ? crypto : null;
    if (c && c.randomUUID) return c.randomUUID();
    var b = new Uint8Array(16);
    if (c && c.getRandomValues) c.getRandomValues(b);
    else for (var i = 0; i < 16; i++) b[i] = Math.floor(Math.random() * 256);
    return Array.prototype.map.call(b, function (x) { return pad(x.toString(16)); }).join('');
  }

  // ------------------------------------------------------------ crypto

  var enc = new TextEncoder();
  var dec = new TextDecoder();

  function b64enc(bytes) {
    var s = '';
    var CH = 0x8000;
    for (var i = 0; i < bytes.length; i += CH) s += String.fromCharCode.apply(null, bytes.subarray(i, i + CH));
    return btoa(s);
  }

  function b64dec(str) {
    var s = atob(str);
    var out = new Uint8Array(s.length);
    for (var i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
    return out;
  }

  async function deriveKey(password, salt, iterations) {
    var base = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt: salt, iterations: iterations, hash: 'SHA-256' },
      base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  }

  async function encryptJSON(key, obj) {
    var iv = crypto.getRandomValues(new Uint8Array(12));
    var ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv }, key, enc.encode(JSON.stringify(obj)));
    return { iv: b64enc(iv), ct: b64enc(new Uint8Array(ct)) };
  }

  async function decryptJSON(key, blob) {
    var pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64dec(blob.iv) }, key, b64dec(blob.ct));
    return JSON.parse(dec.decode(pt));
  }

  // The vault keeps one encrypted copy of the whole database in storage.
  // A wrong password cannot decrypt it, so opening it is also the password check.
  function makeVault(storage) {
    function meta() {
      var m = storage.getItem('mt_meta');
      return m ? JSON.parse(m) : null;
    }
    async function writeAll(password, db) {
      var salt = crypto.getRandomValues(new Uint8Array(16));
      var key = await deriveKey(password, salt, ITER);
      var blob = await encryptJSON(key, db);
      storage.setItem('mt_data', JSON.stringify(blob));
      storage.setItem('mt_meta', JSON.stringify({ v: 1, salt: b64enc(salt), iter: ITER }));
      return key;
    }
    return {
      exists: function () { return !!meta() && !!storage.getItem('mt_data'); },
      create: function (password, db) { return writeAll(password, db); },
      rekey: function (password, db) { return writeAll(password, db); },
      open: async function (password) {
        var m = meta();
        var raw = storage.getItem('mt_data');
        if (!m || !raw) throw new Error('empty');
        var key = await deriveKey(password, b64dec(m.salt), m.iter);
        var db = await decryptJSON(key, JSON.parse(raw));   // throws if the password is wrong
        return { key: key, db: ensureDb(db) };
      },
      save: async function (key, db) {
        var blob = await encryptJSON(key, db);
        storage.setItem('mt_data', JSON.stringify(blob));
      },
      wipe: function () {
        storage.removeItem('mt_meta');
        storage.removeItem('mt_data');
      }
    };
  }

  // ------------------------------------------------------------ database

  function emptyDb() {
    return {
      v: 1, lastRev: 0, lastSync: null, skewMs: 0,
      tx: {}, wallets: [], categories: [], fees: [],
      settings: { autoLock: 5, lastWallet: '' }
    };
  }

  function ensureDb(db) {
    var e = emptyDb();
    Object.keys(e).forEach(function (k) { if (db[k] === undefined) db[k] = e[k]; });
    Object.keys(e.settings).forEach(function (k) { if (db.settings[k] === undefined) db.settings[k] = e.settings[k]; });
    return db;
  }

  function liveTx(db) {
    return Object.keys(db.tx).map(function (id) { return db.tx[id]; }).filter(function (t) { return !t.deleted; });
  }

  function pendingCount(db) {
    return Object.keys(db.tx).filter(function (id) { return db.tx[id].dirty; }).length;
  }

  function percentFor(db, from, to) {
    for (var i = 0; i < db.fees.length; i++) {
      if (db.fees[i].from === from && db.fees[i].to === to) return db.fees[i].percent;
    }
    return 0;
  }

  function feeFor(db, from, to, amount) {
    return round2(Number(amount) * percentFor(db, from, to) / 100);
  }

  function activeWallets(db, keep) {
    var names = db.wallets.filter(function (w) { return w.active; }).map(function (w) { return w.name; });
    if (keep && names.indexOf(keep) < 0) names.push(keep);
    return names;
  }

  function categoriesFor(db, type, keep) {
    var names = db.categories.filter(function (c) { return c.type === type; }).map(function (c) { return c.name; });
    if (keep && names.indexOf(keep) < 0) names.push(keep);
    return names;
  }

  // Balance of every wallet, and the total. Transfers move money between wallets;
  // the source pays amount + fee, the destination gets amount.
  function balances(db) {
    var map = {};
    var order = [];
    function slot(name) {
      if (!map[name]) { map[name] = { name: name, opening: 0, balance: 0, active: true, listed: false }; order.push(name); }
      return map[name];
    }
    db.wallets.forEach(function (w) {
      var s = slot(w.name);
      s.opening = w.openingBalance; s.balance = w.openingBalance; s.active = w.active; s.listed = true;
    });
    liveTx(db).forEach(function (t) {
      if (t.type === 'income') slot(t.wallet).balance += t.amount;
      else if (t.type === 'expense') slot(t.wallet).balance -= t.amount;
      else if (t.type === 'transfer') {
        slot(t.wallet).balance -= t.amount + t.fee;
        slot(t.toWallet).balance += t.amount;
      }
    });
    var list = order.map(function (n) { map[n].balance = round2(map[n].balance); return map[n]; });
    var total = round2(list.reduce(function (a, w) { return a + w.balance; }, 0));
    return { wallets: list, total: total };
  }

  function monthSummary(db, ym, today) {
    today = today || todayStr();
    var income = 0, expense = 0, fees = 0, biggest = null, cat = {};
    liveTx(db).forEach(function (t) {
      if (monthOf(t.date) !== ym) return;
      if (t.type === 'income') income += t.amount;
      else if (t.type === 'expense') {
        expense += t.amount;
        cat[t.category] = (cat[t.category] || 0) + t.amount;
        if (!biggest || t.amount > biggest.amount) biggest = { amount: t.amount, category: t.category, date: t.date, note: t.note };
      } else if (t.type === 'transfer' && t.fee > 0) fees += t.fee;
    });
    if (fees > 0) cat['Transfer fee'] = (cat['Transfer fee'] || 0) + fees;
    expense += fees;
    var byCategory = Object.keys(cat).map(function (n) {
      return { name: n, amount: round2(cat[n]), pct: expense > 0 ? cat[n] / expense * 100 : 0 };
    }).sort(function (a, b) { return b.amount - a.amount; });
    var divisor = ym === monthOf(today) ? Number(today.slice(8, 10)) : daysInMonth(ym);
    return {
      ym: ym, income: round2(income), expense: round2(expense), left: round2(income - expense),
      fees: round2(fees), byCategory: byCategory, biggest: biggest,
      avgPerDay: round2(expense / divisor), topCategory: byCategory[0] || null
    };
  }

  function lastMonths(db, endYm, n, today) {
    var out = [];
    for (var i = n - 1; i >= 0; i--) {
      var ym = addMonths(endYm, -i);
      var s = monthSummary(db, ym, today);
      out.push({ ym: ym, label: MONTHS[Number(ym.slice(5, 7)) - 1].slice(0, 3), income: s.income, expense: s.expense });
    }
    return out;
  }

  function filterTx(db, f) {
    var q = (f.q || '').trim().toLowerCase();
    return liveTx(db).filter(function (t) {
      if (f.ym && monthOf(t.date) !== f.ym) return false;
      if (f.type && t.type !== f.type) return false;
      if (f.category && t.category !== f.category) return false;
      if (f.wallet && t.wallet !== f.wallet && t.toWallet !== f.wallet) return false;
      if (q && (t.note + ' ' + t.category + ' ' + t.wallet + ' ' + t.toWallet).toLowerCase().indexOf(q) < 0) return false;
      return true;
    }).sort(function (a, b) {
      if (a.date !== b.date) return a.date < b.date ? 1 : -1;
      return a.updatedAt < b.updatedAt ? 1 : -1;
    });
  }

  function net(t) {
    if (t.type === 'income') return t.amount;
    if (t.type === 'expense') return -t.amount;
    return -t.fee;
  }

  function groupByDate(list) {
    var groups = [];
    var byDate = {};
    list.forEach(function (t) {
      if (!byDate[t.date]) { byDate[t.date] = { date: t.date, items: [], net: 0 }; groups.push(byDate[t.date]); }
      byDate[t.date].items.push(t);
      byDate[t.date].net += net(t);
    });
    groups.forEach(function (g) { g.net = round2(g.net); });
    return groups;
  }

  function filteredTotals(list) {
    var inn = 0, out = 0;
    list.forEach(function (t) {
      if (t.type === 'income') inn += t.amount;
      else if (t.type === 'expense') out += t.amount;
      else out += t.fee;
    });
    return { income: round2(inn), expense: round2(out) };
  }

  // ------------------------------------------------------------ edits

  // Returns a message for the first problem, or '' when the input is fine.
  function checkInput(db, f) {
    if (!(Number(f.amount) > 0)) return 'Enter an amount';
    if (!validDate(f.date)) return 'Enter a valid date';
    if (!f.wallet) return 'Choose a wallet';
    if (f.type === 'transfer') {
      if (!f.toWallet) return 'Choose the wallet to send to';
      if (f.toWallet === f.wallet) return 'Choose two different wallets';
      if (f.fee !== '' && f.fee != null && !(Number(f.fee) >= 0)) return 'Enter a valid fee';
    } else if (!f.category) return 'Choose a category';
    return '';
  }

  function applyFields(t, f) {
    t.date = f.date;
    t.type = f.type;
    t.amount = round2(f.amount);
    t.wallet = f.wallet;
    t.note = String(f.note || '').trim().slice(0, 200);
    if (f.type === 'transfer') {
      t.category = '';
      t.toWallet = f.toWallet;
      t.fee = round2(f.fee === '' || f.fee == null ? 0 : f.fee);
    } else {
      t.category = f.category;
      t.toWallet = '';
      t.fee = 0;
    }
    t.updatedAt = new Date().toISOString();
    t.deleted = false;
    t.dirty = true;
    t.syncError = '';
    return t;
  }

  function saveTx(db, f, id) {
    var t = id && db.tx[id] ? db.tx[id] : { id: uid(), rev: 0 };
    applyFields(t, f);
    db.tx[t.id] = t;
    db.settings.lastWallet = f.wallet;
    return t;
  }

  function deleteTx(db, id) {
    var t = db.tx[id];
    if (!t) return;
    t.deleted = true;
    t.updatedAt = new Date().toISOString();
    t.dirty = true;
    t.syncError = '';
  }

  // ------------------------------------------------------------ sync

  function wire(t) {
    return {
      id: t.id, date: t.date, type: t.type, category: t.category, amount: t.amount, fee: t.fee,
      wallet: t.wallet, toWallet: t.toWallet, note: t.note, updatedAt: t.updatedAt, deleted: !!t.deleted
    };
  }

  function mergeServerTx(db, c) {
    var local = db.tx[c.id];
    if (local && local.dirty && Date.parse(local.updatedAt) > Date.parse(c.updatedAt)) return;   // our edit is newer
    db.tx[c.id] = {
      id: c.id, date: c.date, type: c.type, category: c.category, amount: c.amount, fee: c.fee,
      wallet: c.wallet, toWallet: c.toWallet, note: c.note, rev: c.rev, updatedAt: c.updatedAt,
      deleted: !!c.deleted, dirty: false, syncError: ''
    };
  }

  // Pushes waiting changes, pulls newer ones, refreshes wallets/categories/fees.
  // `post(body)` sends one request and returns the parsed answer (it may throw when offline).
  async function runSync(db, password, post) {
    var result = { ok: true, pushed: 0, pulled: 0, error: '', detail: null };
    var rounds = 0;
    var again = true;
    while (again && rounds++ < 40) {
      again = false;
      var pending = Object.keys(db.tx).map(function (id) { return db.tx[id]; })
        .filter(function (t) { return t.dirty; }).slice(0, 500);
      var sent = {};
      pending.forEach(function (t) { sent[t.id] = t.updatedAt; });

      var res = await post({ action: 'sync', password: password, since: db.lastRev, changes: pending.map(wire) });
      if (!res || !res.ok) {
        result.ok = false;
        result.error = (res && res.error) || 'bad_response';
        result.detail = res || null;
        return result;
      }
      if (res.reset) {
        Object.keys(db.tx).forEach(function (id) { if (!db.tx[id].dirty) delete db.tx[id]; });
      }
      var progress = 0;
      (res.accepted || []).forEach(function (a) {
        var t = db.tx[a.id];
        if (t && t.updatedAt === sent[a.id]) { t.dirty = false; t.rev = a.rev; t.syncError = ''; }
        progress++;
      });
      (res.rejected || []).forEach(function (r) {
        var t = db.tx[r.id];
        if (t && t.updatedAt === sent[r.id]) { t.dirty = false; t.syncError = r.reason; }
        progress++;
      });
      var repull = false;
      (res.skipped || []).forEach(function (id) {
        var t = db.tx[id];
        if (t && t.updatedAt === sent[id]) { t.dirty = false; repull = true; }
        progress++;
      });
      (res.changes || []).forEach(function (c) { mergeServerTx(db, c); });

      result.pushed += (res.accepted || []).length;
      result.pulled += (res.changes || []).length;
      db.lastRev = repull ? 0 : res.cursor;
      db.wallets = res.wallets || [];
      db.categories = res.categories || [];
      db.fees = res.fees || [];
      db.lastSync = new Date().toISOString();
      if (res.serverTime) db.skewMs = Date.parse(res.serverTime) - Date.now();

      var stillDirty = Object.keys(db.tx).some(function (id) { return db.tx[id].dirty; });
      again = !!res.more || repull || (stillDirty && progress > 0);
    }
    return result;
  }

  function makePost(url, fetchFn, timeoutMs) {
    return async function (body) {
      var ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
      var timer = ctl ? setTimeout(function () { ctl.abort(); }, timeoutMs || 30000) : null;
      try {
        var r = await fetchFn(url, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify(body),
          redirect: 'follow',
          signal: ctl ? ctl.signal : undefined
        });
        var text = await r.text();
        try { return JSON.parse(text); } catch (e) { return { ok: false, error: 'bad_response' }; }
      } finally {
        if (timer) clearTimeout(timer);
      }
    };
  }

  // ------------------------------------------------------------ export

  function csvCell(v) {
    var s = String(v == null ? '' : v);
    if (/^[=+\-@]/.test(s)) s = "'" + s;
    return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }

  function toCsv(db) {
    var rows = [['date', 'type', 'category', 'amount', 'fee', 'wallet', 'toWallet', 'note']];
    liveTx(db).sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; }).forEach(function (t) {
      rows.push([t.date, t.type, t.category, t.amount, t.type === 'transfer' ? t.fee : '', t.wallet, t.toWallet, t.note]);
    });
    return rows.map(function (r) { return r.map(csvCell).join(','); }).join('\r\n');
  }

  return {
    ITER: ITER, round2: round2, fmtMoney: fmtMoney, todayStr: todayStr, validDate: validDate, monthOf: monthOf,
    addMonths: addMonths, monthLabel: monthLabel, daysInMonth: daysInMonth, dayLabel: dayLabel, uid: uid,
    b64enc: b64enc, b64dec: b64dec, deriveKey: deriveKey, encryptJSON: encryptJSON, decryptJSON: decryptJSON,
    makeVault: makeVault, emptyDb: emptyDb, ensureDb: ensureDb, liveTx: liveTx, pendingCount: pendingCount,
    percentFor: percentFor, feeFor: feeFor, activeWallets: activeWallets, categoriesFor: categoriesFor,
    balances: balances, monthSummary: monthSummary, lastMonths: lastMonths, filterTx: filterTx,
    groupByDate: groupByDate, filteredTotals: filteredTotals, checkInput: checkInput, saveTx: saveTx,
    deleteTx: deleteTx, runSync: runSync, makePost: makePost, mergeServerTx: mergeServerTx, toCsv: toCsv
  };
});
