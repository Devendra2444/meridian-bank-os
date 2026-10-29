/*
 * OS Algorithm Visualizer – core algorithms (pure logic, no DOM).
 * Works in the browser (window.OSAlgo) and in Node (module.exports) so it can be unit-tested.
 *
 * Scenario: Banking & ATM Transaction Processing System
 *   - CPU Scheduling        : order in which transactions get the CPU
 *   - Producer-Consumer     : ATM terminals (producers) -> bounded request queue -> processors (consumers)
 *   - Banker's Algorithm    : safe allocation of DB connections / transaction threads / ledger locks
 *   - Memory Management     : First/Best/Worst Fit allocation of memory to transaction processes
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.OSAlgo = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* =====================================================================
   * 1. CPU SCHEDULING
   * procs: [{id, arrival, burst, priority}]   (lower priority number = higher priority)
   * ===================================================================== */
  const ALGOS = {
    FCFS: 'First Come First Served',
    SJF: 'Shortest Job First (non-preemptive)',
    SRTF: 'Shortest Remaining Time First (preemptive)',
    PRIORITY: 'Priority (non-preemptive)',
    PRIORITY_P: 'Priority (preemptive)',
    RR: 'Round Robin'
  };

  function mergeTimeline(tl) {
    const out = [];
    for (const seg of tl) {
      const last = out[out.length - 1];
      if (last && last.pid === seg.pid && last.end === seg.start) last.end = seg.end;
      else out.push({ pid: seg.pid, start: seg.start, end: seg.end });
    }
    return out;
  }

  function finalize(procs, timeline, completion, firstRun) {
    const rows = procs.map(p => {
      const ct = completion[p.id];
      const tat = ct - p.arrival;          // Turnaround = Completion - Arrival
      const wt = tat - p.burst;            // Waiting    = Turnaround - Burst
      const rt = firstRun[p.id] - p.arrival;
      return { id: p.id, arrival: p.arrival, burst: p.burst, priority: p.priority, ct, tat, wt, rt };
    });
    const n = rows.length || 1;
    const avg = k => rows.reduce((s, r) => s + r[k], 0) / n;
    const merged = mergeTimeline(timeline);
    const totalTime = merged.length ? merged[merged.length - 1].end : 0;
    const busy = merged.filter(s => s.pid !== null).reduce((s, x) => s + (x.end - x.start), 0);
    const firstStart = merged.length ? merged[0].start : 0;
    return {
      timeline: merged, rows,
      avgWT: avg('wt'), avgTAT: avg('tat'), avgRT: avg('rt'),
      totalTime,
      utilization: totalTime - firstStart > 0 ? busy / (totalTime - firstStart) : 0,
      order: merged.filter(s => s.pid !== null).map(s => s.pid)
        .filter((id, i, a) => a.indexOf(id) === i)          // order of first dispatch
    };
  }

  function nonPreemptive(procs, cmp) {
    const left = procs.slice();
    const tl = [], completion = {}, firstRun = {};
    let t = 0;
    while (left.length) {
      const ready = left.filter(p => p.arrival <= t);
      if (!ready.length) {
        const next = Math.min(...left.map(p => p.arrival));
        tl.push({ pid: null, start: t, end: next });
        t = next;
        continue;
      }
      ready.sort(cmp);                                       // stable sort
      const p = ready[0];
      firstRun[p.id] = t;
      tl.push({ pid: p.id, start: t, end: t + p.burst });
      t += p.burst;
      completion[p.id] = t;
      left.splice(left.indexOf(p), 1);
    }
    return finalize(procs, tl, completion, firstRun);
  }

  function preemptive(procs, key) {
    const rem = {}, completion = {}, firstRun = {};
    procs.forEach(p => (rem[p.id] = p.burst));
    const tl = [];
    let t = 0, done = 0, prevId = null;
    while (done < procs.length) {
      const ready = procs.filter(p => p.arrival <= t && rem[p.id] > 0);
      if (!ready.length) {
        tl.push({ pid: null, start: t, end: t + 1 });
        t++; prevId = null;
        continue;
      }
      let best = ready[0];
      for (const p of ready) {
        const kp = key(p, rem), kb = key(best, rem);
        // lower key wins; on ties keep the running process, then the earlier arrival
        if (kp < kb || (kp === kb && (p.id === prevId || (best.id !== prevId && p.arrival < best.arrival)))) best = p;
      }
      if (firstRun[best.id] === undefined) firstRun[best.id] = t;
      tl.push({ pid: best.id, start: t, end: t + 1 });
      rem[best.id]--; t++; prevId = best.id;
      if (rem[best.id] === 0) { completion[best.id] = t; done++; }
    }
    return finalize(procs, tl, completion, firstRun);
  }

  function roundRobin(procs, q) {
    q = Math.max(1, q | 0);
    const order = procs.slice().sort((a, b) => a.arrival - b.arrival);
    const rem = {}, completion = {}, firstRun = {};
    procs.forEach(p => (rem[p.id] = p.burst));
    const tl = [], queue = [];
    let i = 0, t = 0, done = 0;
    const admit = () => { while (i < order.length && order[i].arrival <= t) queue.push(order[i++]); };
    admit();
    while (done < procs.length) {
      if (!queue.length) {
        const next = order[i].arrival;
        tl.push({ pid: null, start: t, end: next });
        t = next; admit();
        continue;
      }
      const p = queue.shift();
      if (firstRun[p.id] === undefined) firstRun[p.id] = t;
      const run = Math.min(q, rem[p.id]);
      tl.push({ pid: p.id, start: t, end: t + run });
      t += run; rem[p.id] -= run;
      admit();                                  // arrivals during the slice queue up before the preempted process
      if (rem[p.id] > 0) queue.push(p); else { completion[p.id] = t; done++; }
    }
    return finalize(procs, tl, completion, firstRun);
  }

  function cpuRun(procs, algo, quantum) {
    switch (algo) {
      case 'FCFS': return nonPreemptive(procs, (a, b) => a.arrival - b.arrival);
      case 'SJF': return nonPreemptive(procs, (a, b) => a.burst - b.burst || a.arrival - b.arrival);
      case 'PRIORITY': return nonPreemptive(procs, (a, b) => a.priority - b.priority || a.arrival - b.arrival);
      case 'SRTF': return preemptive(procs, (p, rem) => rem[p.id]);
      case 'PRIORITY_P': return preemptive(procs, p => p.priority);
      case 'RR': return roundRobin(procs, quantum || 2);
      default: throw new Error('Unknown algorithm ' + algo);
    }
  }

  /* =====================================================================
   * 2. PRODUCER–CONSUMER (bounded buffer with semaphores empty / full / mutex)
   * Producers = ATM / mobile-banking terminals, consumers = transaction processors.
   * Each actor attempts one action every `period` ticks.
   * ===================================================================== */
  const TXN_TYPES = ['WD', 'DEP', 'TRF', 'BAL', 'STM'];  // withdrawal, deposit, transfer, balance, statement

  function pcCreate(cfg) {
    const c = Object.assign({ capacity: 4, producers: 2, consumers: 1, prodPeriod: 2, consPeriod: 3 }, cfg || {});
    const actors = [];
    for (let i = 1; i <= c.producers; i++) actors.push({ id: 'P' + i, type: 'producer', period: Math.max(1, c.prodPeriod), state: 'idle', served: 0, blocked: 0 });
    for (let i = 1; i <= c.consumers; i++) actors.push({ id: 'C' + i, type: 'consumer', period: Math.max(1, c.consPeriod), state: 'idle', served: 0, blocked: 0 });
    return {
      cfg: c, capacity: c.capacity, buffer: [], empty: c.capacity, full: 0, mutex: 1,
      tick: 0, itemSeq: 0, produced: 0, consumed: 0, prodBlocked: 0, consBlocked: 0, maxOcc: 0,
      actors, log: [], history: [{ tick: 0, occupancy: 0, produced: 0, consumed: 0 }]
    };
  }

  function pcStep(s) {
    s.tick++;
    for (const a of s.actors) {
      if (s.tick % a.period !== 0) { a.state = 'idle'; continue; }
      if (a.type === 'producer') {
        if (s.empty === 0) {                                    // wait(empty) would block
          a.state = 'blocked'; a.blocked++; s.prodBlocked++;
          s.log.push({ tick: s.tick, actor: a.id, kind: 'block', text: `${a.id} BLOCKED on wait(empty) – buffer full` });
          continue;
        }
        s.empty--; s.mutex = 0;                                 // wait(empty); wait(mutex)
        const item = `${TXN_TYPES[s.itemSeq % TXN_TYPES.length]}-${s.itemSeq + 1}`;
        s.itemSeq++;
        s.buffer.push(item);                                    // critical section: insert
        s.mutex = 1; s.full++;                                  // signal(mutex); signal(full)
        s.produced++; a.served++; a.state = 'active';
        s.maxOcc = Math.max(s.maxOcc, s.buffer.length);
        s.log.push({ tick: s.tick, actor: a.id, kind: 'produce', text: `${a.id} produced ${item}  [empty=${s.empty}, full=${s.full}]` });
      } else {
        if (s.full === 0) {                                     // wait(full) would block
          a.state = 'blocked'; a.blocked++; s.consBlocked++;
          s.log.push({ tick: s.tick, actor: a.id, kind: 'block', text: `${a.id} BLOCKED on wait(full) – buffer empty` });
          continue;
        }
        s.full--; s.mutex = 0;                                  // wait(full); wait(mutex)
        const item = s.buffer.shift();                          // critical section: remove
        s.mutex = 1; s.empty++;                                 // signal(mutex); signal(empty)
        s.consumed++; a.served++; a.state = 'active';
        s.log.push({ tick: s.tick, actor: a.id, kind: 'consume', text: `${a.id} processed ${item}  [empty=${s.empty}, full=${s.full}]` });
      }
    }
    if (s.log.length > 300) s.log.splice(0, s.log.length - 300);
    s.history.push({ tick: s.tick, occupancy: s.buffer.length, produced: s.produced, consumed: s.consumed });
    if (s.history.length > 600) s.history.splice(0, s.history.length - 600);
    return s;
  }

  // Invariants that must always hold if the synchronisation is correct.
  function pcInvariant(s) {
    return s.full === s.buffer.length && s.empty + s.full === s.capacity &&
      s.mutex === 1 && s.buffer.length <= s.capacity && s.produced - s.consumed === s.buffer.length;
  }

  function pcRun(cfg, ticks) {
    const s = pcCreate(cfg);
    for (let i = 0; i < ticks; i++) pcStep(s);
    return s;
  }

  /* =====================================================================
   * 3. BANKER'S ALGORITHM (deadlock avoidance)
   * alloc, max: n x m matrices; avail: length m
   * ===================================================================== */
  function bankersNeed(max, alloc) {
    return max.map((row, i) => row.map((v, j) => v - alloc[i][j]));
  }

  function bankersSafety(alloc, max, avail) {
    const n = alloc.length;
    const need = bankersNeed(max, alloc);
    const work = avail.slice();
    const finish = Array(n).fill(false);
    const seq = [], steps = [];
    let progress = true;
    while (seq.length < n && progress) {
      progress = false;
      for (let i = 0; i < n; i++) {
        if (!finish[i] && need[i].every((x, j) => x <= work[j])) {
          const before = work.slice();
          for (let j = 0; j < work.length; j++) work[j] += alloc[i][j];
          finish[i] = true; seq.push(i); progress = true;
          steps.push({ pid: i, need: need[i].slice(), workBefore: before, workAfter: work.slice() });
        }
      }
    }
    return { safe: seq.length === n, sequence: seq, steps, need, finish };
  }

  // Resource-request algorithm: pretend to grant, then run the safety check.
  function bankersRequest(alloc, max, avail, pid, req) {
    const need = bankersNeed(max, alloc);
    if (req.some((r, j) => r > need[pid][j]))
      return { granted: false, reason: 'Error: request exceeds the maximum claim declared by the transaction.' };
    if (req.some((r, j) => r > avail[j]))
      return { granted: false, reason: 'Resources not available – the transaction must wait.' };
    const nAlloc = alloc.map(r => r.slice());
    const nAvail = avail.slice();
    req.forEach((r, j) => { nAlloc[pid][j] += r; nAvail[j] -= r; });
    const check = bankersSafety(nAlloc, max, nAvail);
    if (!check.safe)
      return { granted: false, reason: 'Denied – granting would leave the system in an UNSAFE state.', check };
    return { granted: true, reason: 'Granted – the resulting state is SAFE.', check, newAlloc: nAlloc, newAvail: nAvail };
  }

  /* =====================================================================
   * 4. MEMORY MANAGEMENT (contiguous allocation)
   * blockSizes: initial partitions; procs: [{id, size}]
   * mode 'fixed'   : a process takes a whole partition  -> INTERNAL fragmentation
   * mode 'dynamic' : the partition is split             -> leftover holes -> EXTERNAL fragmentation
   * strategy: 'first' | 'best' | 'worst'
   * ===================================================================== */
  function memAllocate(blockSizes, procs, strategy, mode) {
    let start = 0;
    const segs = blockSizes.map((size, i) => {
      const s = { start, size, pid: null, used: 0, label: 'B' + (i + 1) };
      start += size;
      return s;
    });
    const total = start;
    const placements = [];
    for (const p of procs) {
      const candidates = segs.map(s => ({
        label: s.label, size: s.size, start: s.start, free: s.pid === null,
        fits: s.pid === null && s.size >= p.size, holder: s.pid
      }));
      const cand = [];
      segs.forEach((s, i) => { if (s.pid === null && s.size >= p.size) cand.push({ s, i }); });
      if (!cand.length) {
        placements.push({ pid: p.id, size: p.size, ok: false, block: null, blockSize: 0, start: null, waste: 0, candidates });
        continue;
      }
      let pick = cand[0];
      if (strategy === 'best') pick = cand.reduce((a, b) => (b.s.size < a.s.size ? b : a));
      else if (strategy === 'worst') pick = cand.reduce((a, b) => (b.s.size > a.s.size ? b : a));
      if (mode === 'dynamic' && pick.s.size > p.size) {
        segs.splice(pick.i + 1, 0, { start: pick.s.start + p.size, size: pick.s.size - p.size, pid: null, used: 0, label: pick.s.label + '*' });
        pick.s.size = p.size;
      }
      pick.s.pid = p.id; pick.s.used = p.size;
      placements.push({ pid: p.id, size: p.size, ok: true, block: pick.s.label, blockSize: pick.s.size, start: pick.s.start, waste: pick.s.size - p.size, candidates });
    }
    const allocated = segs.filter(s => s.pid !== null);
    const holes = segs.filter(s => s.pid === null);
    const internal = allocated.reduce((a, s) => a + (s.size - s.used), 0);
    const totalFree = holes.reduce((a, s) => a + s.size, 0);
    const largestHole = holes.reduce((a, s) => Math.max(a, s.size), 0);
    const unallocated = placements.filter(p => !p.ok);
    return {
      strategy, mode, total, segs, placements,
      usedMem: allocated.reduce((a, s) => a + s.used, 0),
      internal, totalFree, largestHole,
      holes: holes.length,
      unallocated: unallocated.map(p => p.pid),
      // external fragmentation really bites when a request fits in TOTAL free memory but in no single hole
      externalFrag: unallocated.some(p => p.size <= totalFree),
      fragPct: totalFree ? (1 - largestHole / totalFree) * 100 : 0,
      utilization: total ? allocated.reduce((a, s) => a + s.used, 0) / total : 0
    };
  }

  function memCompare(blockSizes, procs, mode) {
    return ['first', 'best', 'worst'].map(st => memAllocate(blockSizes, procs, st, mode));
  }

  return {
    cpu: { run: cpuRun, ALGOS },
    pc: { create: pcCreate, step: pcStep, invariant: pcInvariant, run: pcRun, TXN_TYPES },
    bankers: { need: bankersNeed, safety: bankersSafety, request: bankersRequest },
    memory: { allocate: memAllocate, compare: memCompare }
  };
});
