(function () {
  'use strict';
  window.NB = window.NB || {};
  const A = window.OSAlgo;

  const KEY = 'meridian.core.ops.v2';
  const RESOURCE_CODES = ['DB', 'SVC', 'LOCK'];
  const RESOURCE_NAMES = ['Database pool', 'Transaction threads', 'Ledger locks'];
  const PALETTE = ['#5B8CFF', '#34D399', '#F4B740', '#FB7185', '#38BDF8', '#A78BFA', '#FB923C', '#94A3B8'];

  const ALGO_META = {
    FCFS: { label: 'FCFS', short: 'FCFS', name: 'First come, first served' },
    SJF: { label: 'SJF', short: 'SJF', name: 'Shortest job first' },
    SRTF: { label: 'SRTF', short: 'SRTF', name: 'Shortest remaining time' },
    PRIORITY: { label: 'Priority', short: 'Priority', name: 'Priority · non-preemptive' },
    PRIORITY_P: { label: 'Priority+', short: 'Priority+', name: 'Priority · preemptive' },
    RR: { label: 'Round robin', short: 'RR', name: 'Round robin' }
  };

  const DEFAULTS = {
    version: 1,
    txns: [
      { id: 'T1', name: 'ATM Withdrawal', channel: 'ATM', arrival: 0, burst: 5, priority: 2, size: 212 },
      { id: 'T2', name: 'Fund Transfer', channel: 'Mobile', arrival: 1, burst: 3, priority: 1, size: 417 },
      { id: 'T3', name: 'Cheque Deposit', channel: 'Branch', arrival: 2, burst: 8, priority: 3, size: 112 },
      { id: 'T4', name: 'Balance Inquiry', channel: 'ATM', arrival: 3, burst: 2, priority: 4, size: 426 },
      { id: 'T5', name: 'Statement Export', channel: 'Batch', arrival: 4, burst: 6, priority: 5, size: 90 }
    ],
    scheduler: { algo: 'PRIORITY_P', quantum: 2 },
    queueCfg: { capacity: 6, producers: 2, consumers: 2, prodPeriod: 2, consPeriod: 3 },
    speed: 650,
    banker: {
      alloc: [[0, 1, 0], [2, 0, 0], [3, 0, 2], [2, 1, 1], [0, 0, 2]],
      max: [[7, 5, 3], [3, 2, 2], [9, 0, 2], [2, 2, 2], [4, 3, 3]],
      avail: [3, 3, 2]
    },
    memory: { blocks: [100, 500, 200, 300, 600], mode: 'fixed', strategy: 'best' },
    batchSeq: 48217
  };

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function isNum(value) {
    return typeof value === 'number' && Number.isFinite(value);
  }

  function int(value, fallback, min, max) {
    const n = parseInt(value, 10);
    if (!Number.isFinite(n)) return fallback;
    return Math.min(max === undefined ? Number.MAX_SAFE_INTEGER : max, Math.max(min === undefined ? 0 : min, n));
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function esc(value) {
    return String(value).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  }

  function fmt(value, digits) {
    const d = digits === undefined ? 1 : digits;
    if (!Number.isFinite(value)) return '—';
    return (Math.round(value * Math.pow(10, d)) / Math.pow(10, d)).toFixed(d).replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1');
  }

  function num(value) {
    return Number(value || 0).toLocaleString('en-US');
  }

  function vec(v) {
    return '(' + v.join(', ') + ')';
  }

  function pct(value, digits) {
    return fmt((value || 0) * 100, digits === undefined ? 0 : digits) + '%';
  }

  function hashString(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
    return Math.abs(h);
  }

  function colorFor(id) {
    const digits = String(id).match(/\d+/);
    const index = digits ? (parseInt(digits[0], 10) - 1) : hashString(String(id));
    return PALETTE[Math.abs(index) % PALETTE.length];
  }

  function textOn(hex) {
    const raw = hex.replace('#', '');
    const r = parseInt(raw.slice(0, 2), 16);
    const g = parseInt(raw.slice(2, 4), 16);
    const b = parseInt(raw.slice(4, 6), 16);
    const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    return luminance > 0.62 ? '#08101b' : '#ffffff';
  }

  function shortAlgo(key) {
    return (ALGO_META[key] || { short: key }).short;
  }

  function algoName(key) {
    return (ALGO_META[key] || { name: key, label: key }).name;
  }

  function priorityClass(priority) {
    if (priority <= 1) return 'p-critical';
    if (priority === 2) return 'p-high';
    if (priority === 3) return 'p-medium';
    return 'p-normal';
  }

  function pad(n) {
    return String(n).padStart(2, '0');
  }

  function timestamp(date) {
    const d = date ? new Date(date) : new Date();
    return pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
  }

  function timeAgo(date) {
    const diff = Math.max(0, Date.now() - new Date(date).getTime());
    if (diff < 15000) return 'just now';
    if (diff < 60000) return Math.floor(diff / 1000) + 's ago';
    if (diff < 3600000) return Math.floor(diff / 60000) + 'm ago';
    if (diff < 86400000) return Math.floor(diff / 3600000) + 'h ago';
    return Math.floor(diff / 86400000) + 'd ago';
  }

  function emptySchedule() {
    return { timeline: [], rows: [], avgWT: 0, avgTAT: 0, avgRT: 0, totalTime: 0, utilization: 0, order: [] };
  }

  function validTxn(t) {
    return t && typeof t.name === 'string' && t.name.trim() &&
      isNum(t.arrival) && isNum(t.burst) && isNum(t.priority) && isNum(t.size) &&
      t.arrival >= 0 && t.burst >= 1 && t.priority >= 1 && t.size >= 1;
  }

  function sanitizeTxns(input) {
    const fallback = DEFAULTS.txns;
    const list = Array.isArray(input) && input.length >= 1 && input.length <= 8 ? input : fallback;
    const used = new Set();
    return list.map((t, i) => {
      const base = validTxn(t) ? t : fallback[i % fallback.length];
      let id = typeof t.id === 'string' && /^T\d+$/.test(t.id) ? t.id : 'T' + (i + 1);
      if (used.has(id)) id = 'T' + (i + 1) + '-' + Math.random().toString(36).slice(2, 4);
      used.add(id);
      return {
        id,
        name: String(base.name).slice(0, 42),
        channel: String(t.channel || base.channel || 'API').slice(0, 16),
        arrival: clamp(Math.round(base.arrival), 0, 999),
        burst: clamp(Math.round(base.burst), 1, 99),
        priority: clamp(Math.round(base.priority), 1, 9),
        size: clamp(Math.round(base.size), 1, 65536)
      };
    });
  }

  function sanitizeMatrix(matrix, n, fallbackRows) {
    if (!Array.isArray(matrix) || matrix.length < n) return null;
    const rows = [];
    for (let i = 0; i < n; i++) {
      const row = matrix[i];
      if (!Array.isArray(row) || row.length !== 3 || row.some(v => !isNum(v) || v < 0 || v > 999)) return null;
      rows.push(row.map(v => Math.round(v)));
    }
    if (fallbackRows && fallbackRows.length === n) return rows;
    return rows;
  }

  function defaultBankerRows(n) {
    const alloc = [];
    const max = [];
    for (let i = 0; i < n; i++) {
      const baseAlloc = DEFAULTS.banker.alloc[i] || [0, 0, 0];
      const baseMax = DEFAULTS.banker.max[i] || [2, 1, 1];
      alloc.push(baseAlloc.slice());
      max.push(baseMax.slice());
    }
    return { alloc, max };
  }

  function load() {
    let saved = null;
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) saved = JSON.parse(raw);
    } catch (err) {
      saved = null;
    }

    const state = clone(DEFAULTS);
    state.txns = sanitizeTxns(saved && saved.txns);
    const n = state.txns.length;

    const base = defaultBankerRows(n);
    let alloc = base.alloc;
    let max = base.max;
    let avail = DEFAULTS.banker.avail.slice();
    if (saved && saved.banker) {
      const a = sanitizeMatrix(saved.banker.alloc, n);
      const m = sanitizeMatrix(saved.banker.max, n);
      if (a) alloc = a;
      if (m) max = m;
      if (Array.isArray(saved.banker.avail) && saved.banker.avail.length === 3 && saved.banker.avail.every(v => isNum(v) && v >= 0 && v <= 999)) {
        avail = saved.banker.avail.map(v => Math.round(v));
      }
    }

    if (saved && saved.scheduler) {
      if (A.cpu.ALGOS[saved.scheduler.algo]) state.scheduler.algo = saved.scheduler.algo;
      state.scheduler.quantum = int(saved.scheduler.quantum, 2, 1, 64);
    }

    if (saved && saved.queueCfg) {
      const q = saved.queueCfg;
      state.queueCfg = {
        capacity: int(q.capacity, 6, 2, 12),
        producers: int(q.producers, 2, 1, 4),
        consumers: int(q.consumers, 2, 1, 4),
        prodPeriod: int(q.prodPeriod, 2, 1, 9),
        consPeriod: int(q.consPeriod, 3, 1, 9)
      };
    }

    if (saved && saved.memory) {
      if (Array.isArray(saved.memory.blocks) && saved.memory.blocks.length >= 1 && saved.memory.blocks.length <= 16 && saved.memory.blocks.every(v => isNum(v) && v >= 1)) {
        state.memory.blocks = saved.memory.blocks.map(v => Math.round(v));
      }
      if (saved.memory.mode === 'fixed' || saved.memory.mode === 'dynamic') state.memory.mode = saved.memory.mode;
      if (['first', 'best', 'worst'].includes(saved.memory.strategy)) state.memory.strategy = saved.memory.strategy;
    }

    state.speed = int(saved && saved.speed, 650, 150, 2000);
    state.batchSeq = int(saved && saved.batchSeq, 48217, 1, 999999);

    state.banker = { alloc, max, avail, req: { pid: 0, vec: [0, 0, 0] }, result: null };
    state.batch = { id: 'MRD-' + String(state.batchSeq).padStart(5, '0'), lastRun: Date.now() };
    state.activity = [];
    state.queue = { sim: A.pc.create(state.queueCfg) };
    return state;
  }

  function serialize() {
    return {
      version: 1,
      txns: state.txns,
      scheduler: state.scheduler,
      queueCfg: state.queueCfg,
      speed: state.speed,
      banker: { alloc: state.banker.alloc, max: state.banker.max, avail: state.banker.avail },
      memory: state.memory,
      batchSeq: state.batchSeq
    };
  }

  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(serialize()));
      document.dispatchEvent(new CustomEvent('nb:saved'));
    } catch (err) {
      document.dispatchEvent(new CustomEvent('nb:save-failed'));
    }
  }

  let saveTimer = null;
  function scheduleSave() {
    document.dispatchEvent(new CustomEvent('nb:saving'));
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      saveTimer = null;
      save();
    }, 260);
  }

  const state = load();

  function initRuntime(seedTicks) {
    state.queue.sim = A.pc.run(state.queueCfg, seedTicks === undefined ? 24 : seedTicks);
    state.batch.lastRun = Date.now();
    if (!state.activity.length) seedActivity();
  }

  function addActivity(type, title, meta) {
    state.activity.unshift({ type, title, meta, at: new Date().toISOString() });
    if (state.activity.length > 42) state.activity.length = 42;
  }

  function seedActivity() {
    const a = analysis();
    const now = Date.now();
    state.activity = [
      {
        type: 'scheduler',
        title: 'Dispatch plan compiled',
        meta: a.admitted.length + ' cleared · ' + algoName(state.scheduler.algo),
        at: new Date(now - 8000).toISOString()
      },
      {
        type: 'queue',
        title: 'Request stream synchronized',
        meta: a.queue.buffer.length + '/' + a.queue.capacity + ' buffered · ' + a.queue.consumed + ' settled',
        at: new Date(now - 21000).toISOString()
      },
      {
        type: 'memory',
        title: 'Memory map refreshed',
        meta: a.mem.placements.filter(p => p.ok).length + '/' + state.txns.length + ' mapped · ' + a.mem.strategy + ' fit',
        at: new Date(now - 40000).toISOString()
      },
      {
        type: 'guard',
        title: a.effectiveSafe ? 'Safety state verified' : 'Safety state requires review',
        meta: a.effectiveSafe ? (a.bk.sequence.length + '-step recovery path available') : 'New admissions paused',
        at: new Date(now - 64000).toISOString()
      },
      {
        type: 'intake',
        title: 'Batch loaded',
        meta: state.txns.length + ' transactions · ' + num(state.txns.reduce((sum, t) => sum + t.size, 0)) + ' KB working set',
        at: new Date(now - 90000).toISOString()
      }
    ];
  }

  function analysis() {
    const txns = state.txns;
    const procs = txns.map(t => ({ id: t.id, arrival: t.arrival, burst: t.burst, priority: t.priority }));
    const cpu = A.cpu.run(procs, state.scheduler.algo, state.scheduler.quantum);
    const benchmark = Object.keys(A.cpu.ALGOS).map(key => ({
      key,
      result: A.cpu.run(procs, key, state.scheduler.quantum)
    }));
    const best = benchmark.reduce((acc, item) => item.result.avgWT < acc.result.avgWT ? item : acc, benchmark[0]);

    const memAll = A.memory.compare(state.memory.blocks, txns.map(t => ({ id: t.id, size: t.size })), state.memory.mode);
    const mem = memAll.find(r => r.strategy === state.memory.strategy) || memAll[0];

    const bk = A.bankers.safety(state.banker.alloc, state.banker.max, state.banker.avail);
    const invalidBanker = state.banker.alloc.some((row, i) => row.some((v, j) => v > (state.banker.max[i] ? state.banker.max[i][j] : Infinity)));
    const effectiveSafe = bk.safe && !invalidBanker;

    const placedMap = {};
    mem.placements.forEach(p => { placedMap[p.pid] = p; });

    const statuses = txns.map(t => {
      const placed = placedMap[t.id];
      if (invalidBanker) return { key: 'invalid', label: 'Invalid claim', tone: 'bad', placed: !!(placed && placed.ok), safe: false };
      if (!effectiveSafe) return { key: 'held', label: 'On hold', tone: 'bad', placed: !!(placed && placed.ok), safe: false };
      if (!placed || !placed.ok) return { key: 'memory', label: 'Awaiting memory', tone: 'warn', placed: false, safe: true };
      return { key: 'cleared', label: 'Cleared', tone: 'good', placed: true, safe: true };
    });

    const admitted = txns.filter((t, i) => statuses[i].key === 'cleared');
    const dispatch = admitted.length
      ? A.cpu.run(admitted.map(t => ({ id: t.id, arrival: t.arrival, burst: t.burst, priority: t.priority })), state.scheduler.algo, state.scheduler.quantum)
      : emptySchedule();

    const dispatchRows = {};
    dispatch.rows.forEach(row => { dispatchRows[row.id] = row; });
    const orderIndex = {};
    dispatch.order.forEach((id, i) => { orderIndex[id] = i; });

    const queue = state.queue.sim;
    const resourceTotals = [0, 1, 2].map(j => state.banker.avail[j] + state.banker.alloc.reduce((sum, row) => sum + row[j], 0));
    const resourceUsed = [0, 1, 2].map(j => state.banker.alloc.reduce((sum, row) => sum + row[j], 0));

    const safePositions = {};
    bk.sequence.forEach((index, i) => { safePositions[txns[index].id] = i + 1; });

    const alerts = [];
    if (invalidBanker) {
      alerts.push({ tone: 'bad', title: 'Allocation ledger invalid', detail: 'One or more allocations exceed the declared claim.', route: 'resources', action: 'Review ledger' });
    } else if (!bk.safe) {
      alerts.push({ tone: 'bad', title: 'Allocation state unsafe', detail: 'Admissions are paused until a safe recovery path exists.', route: 'resources', action: 'Open resource guard' });
    }
    if (mem.unallocated.length) {
      alerts.push({
        tone: 'warn',
        title: mem.unallocated.length + (mem.unallocated.length > 1 ? ' transactions awaiting memory' : ' transaction awaiting memory'),
        detail: mem.unallocated.join(', ') + ' cannot be mapped in the current address space.',
        route: 'memory',
        action: 'Open memory manager'
      });
    }
    if (queue.buffer.length >= queue.capacity) {
      alerts.push({ tone: 'warn', title: 'Ingress backpressure active', detail: 'The request buffer is at capacity; source terminals are throttled.', route: 'queue', action: 'Open request queue' });
    }
    if (!A.pc.invariant(queue)) {
      alerts.push({ tone: 'bad', title: 'Queue integrity warning', detail: 'Synchronization invariants are not holding.', route: 'queue', action: 'Inspect queue' });
    }

    return {
      txns,
      cpu,
      benchmark,
      best,
      mem,
      memAll,
      bk,
      invalidBanker,
      effectiveSafe,
      placedMap,
      statuses,
      admitted,
      admittedIds: admitted.map(t => t.id),
      dispatch,
      dispatchRows,
      orderIndex,
      queue,
      resourceTotals,
      resourceUsed,
      safePositions,
      alerts,
      urgent: txns.filter(t => t.priority <= 2).length,
      totalBurst: txns.reduce((sum, t) => sum + t.burst, 0),
      totalMemory: txns.reduce((sum, t) => sum + t.size, 0)
    };
  }

  function updateSidebar(a) {
    const navQueue = document.getElementById('nav-queue');
    const navCount = document.getElementById('nav-count');
    const navGuard = document.getElementById('nav-guard');
    if (navQueue) navQueue.textContent = a.queue.buffer.length;
    if (navCount) navCount.textContent = a.txns.length;
    if (navGuard) {
      navGuard.className = 'nav-status ' + (a.effectiveSafe ? 'is-safe' : 'is-risk');
      navGuard.title = a.effectiveSafe ? 'Safety state verified' : 'Safety state requires review';
    }
  }

  NB.Store = {
    state,
    KEY,
    initRuntime,
    save,
    scheduleSave,
    addActivity,
    analysis,
    updateSidebar,
    resetRuntimeQueue: (ticks) => { state.queue.sim = A.pc.run(state.queueCfg, ticks === undefined ? 24 : ticks); },
    baselineBanker: () => {
      const n = state.txns.length;
      state.banker.alloc = Array.from({ length: n }, (_, i) => (DEFAULTS.banker.alloc[i] || [0, 0, 0]).slice());
      state.banker.max = Array.from({ length: n }, (_, i) => (DEFAULTS.banker.max[i] || [2, 1, 1]).slice());
      state.banker.avail = DEFAULTS.banker.avail.slice();
      state.banker.req = { pid: 0, vec: [0, 0, 0] };
      state.banker.result = null;
    }
  };
  NB.analysis = analysis;
  NB.updateSidebar = updateSidebar;
  NB.ALGO_META = ALGO_META;
  NB.RESOURCES = { codes: RESOURCE_CODES, names: RESOURCE_NAMES };
  NB.colors = { palette: PALETTE, colorFor, textOn };
  NB.util = {
    clone, int, clamp, esc, fmt, num, vec, pct, shortAlgo, algoName, priorityClass, timestamp, timeAgo, emptySchedule,
    isNum, colorFor, textOn
  };
})();
