// Run with:  node tests.js
const assert = require('assert');
const A = require('./js/algorithms.js');

let passed = 0;
const test = (name, fn) => { fn(); passed++; console.log('  ok  ' + name); };
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} != ${b}`);

const procs = [
  { id: 'T1', arrival: 0, burst: 5, priority: 2 },
  { id: 'T2', arrival: 1, burst: 3, priority: 1 },
  { id: 'T3', arrival: 2, burst: 8, priority: 3 },
  { id: 'T4', arrival: 3, burst: 2, priority: 4 },
  { id: 'T5', arrival: 4, burst: 6, priority: 5 }
];

console.log('CPU scheduling');
test('FCFS (hand-computed: avg WT 7.4, avg TAT 12.2)', () => {
  const r = A.cpu.run(procs, 'FCFS');
  close(r.avgWT, 7.4); close(r.avgTAT, 12.2);
  assert.deepStrictEqual(r.order, ['T1', 'T2', 'T3', 'T4', 'T5']);
});
test('SJF (hand-computed: avg WT 5.6, avg TAT 10.4)', () => {
  const r = A.cpu.run(procs, 'SJF');
  close(r.avgWT, 5.6); close(r.avgTAT, 10.4);
  assert.deepStrictEqual(r.order, ['T1', 'T4', 'T2', 'T5', 'T3']);
});
test('Round Robin q=2 (hand-computed: avg WT 10.2, avg TAT 15)', () => {
  const r = A.cpu.run(procs, 'RR', 2);
  close(r.avgWT, 10.2); close(r.avgTAT, 15);
  assert.deepStrictEqual(r.rows.map(x => x.ct), [16, 13, 24, 10, 22]);
});
test('every algorithm: WT = TAT - burst, CPU busy time = total burst, no negative times', () => {
  for (const k of Object.keys(A.cpu.ALGOS)) {
    const r = A.cpu.run(procs, k, 3);
    r.rows.forEach(x => { assert.strictEqual(x.wt, x.tat - x.burst); assert.ok(x.wt >= 0 && x.rt >= 0, k); });
    const busy = r.timeline.filter(s => s.pid).reduce((s, x) => s + x.end - x.start, 0);
    assert.strictEqual(busy, 24, k);
  }
});
test('idle gap is handled (late first arrival)', () => {
  const r = A.cpu.run([{ id: 'A', arrival: 3, burst: 2, priority: 1 }], 'FCFS');
  assert.deepStrictEqual(r.timeline, [{ pid: null, start: 0, end: 3 }, { pid: 'A', start: 3, end: 5 }]);
  assert.strictEqual(r.rows[0].wt, 0);
});
test('SRTF never worse than SJF on avg waiting time for this set', () => {
  assert.ok(A.cpu.run(procs, 'SRTF').avgWT <= A.cpu.run(procs, 'SJF').avgWT);
});

console.log("Banker's algorithm");
const alloc = [[0, 1, 0], [2, 0, 0], [3, 0, 2], [2, 1, 1], [0, 0, 2]];
const max = [[7, 5, 3], [3, 2, 2], [9, 0, 2], [2, 2, 2], [4, 3, 3]];
const avail = [3, 3, 2];
test('Need matrix = Max - Allocation', () => {
  assert.deepStrictEqual(A.bankers.need(max, alloc), [[7, 4, 3], [1, 2, 2], [6, 0, 0], [0, 1, 1], [4, 3, 1]]);
});
test('Safe sequence is <P1,P3,P4,P0,P2> (textbook example)', () => {
  const r = A.bankers.safety(alloc, max, avail);
  assert.ok(r.safe);
  assert.deepStrictEqual(r.sequence, [1, 3, 4, 0, 2]);
});
test('P1 requests (1,0,2): granted', () => {
  const r = A.bankers.request(alloc, max, avail, 1, [1, 0, 2]);
  assert.ok(r.granted);
  assert.deepStrictEqual(r.newAvail, [2, 3, 0]);
});
test('after P1 is granted, P4 requests (3,3,0): must wait (available is only 2,3,0)', () => {
  const g = A.bankers.request(alloc, max, avail, 1, [1, 0, 2]);
  const r = A.bankers.request(g.newAlloc, max, g.newAvail, 4, [3, 3, 0]);
  assert.ok(!r.granted && /wait/.test(r.reason));
});
test('P0 requests (0,2,0) after P1 was granted: denied as UNSAFE', () => {
  const g = A.bankers.request(alloc, max, avail, 1, [1, 0, 2]);
  const r = A.bankers.request(g.newAlloc, max, g.newAvail, 0, [0, 2, 0]);
  assert.ok(!r.granted && /UNSAFE/.test(r.reason));
});
test('request above declared maximum claim is rejected', () => {
  const r = A.bankers.request(alloc, max, avail, 3, [3, 0, 0]);
  assert.ok(!r.granted && /maximum/.test(r.reason));
});
test('unsafe initial state is detected', () => {
  const r = A.bankers.safety([[1, 0], [0, 1]], [[2, 2], [2, 2]], [0, 0]);
  assert.ok(!r.safe);
});

console.log('Memory management');
const blocks = [100, 500, 200, 300, 600];
const mp = [{ id: 'T1', size: 212 }, { id: 'T2', size: 417 }, { id: 'T3', size: 112 }, { id: 'T4', size: 426 }, { id: 'T5', size: 90 }];
test('Fixed partitions, First Fit: T4 (426) cannot be placed', () => {
  const r = A.memory.allocate(blocks, mp, 'first', 'fixed');
  assert.deepStrictEqual(r.placements.map(p => p.block), ['B2', 'B5', 'B3', null, 'B1']);
  assert.deepStrictEqual(r.unallocated, ['T4']);
  assert.strictEqual(r.internal, 288 + 183 + 88 + 10);
});
test('Fixed partitions, Best Fit: everything fits', () => {
  const r = A.memory.allocate(blocks, mp, 'best', 'fixed');
  assert.deepStrictEqual(r.placements.map(p => p.block), ['B4', 'B2', 'B3', 'B5', 'B1']);
  assert.strictEqual(r.unallocated.length, 0);
});
test('Fixed partitions, Worst Fit', () => {
  const r = A.memory.allocate(blocks, mp, 'worst', 'fixed');
  assert.deepStrictEqual(r.placements.map(p => p.block), ['B5', 'B2', 'B4', null, 'B3']);
});
test('Fixed partitions, Best Fit records segment offsets and slack', () => {
  const r = A.memory.allocate(blocks, mp, 'best', 'fixed');
  assert.deepStrictEqual(r.placements.map(p => p.start), [800, 100, 600, 1100, 0]);
  assert.deepStrictEqual(r.placements.map(p => p.blockSize), [300, 500, 200, 600, 100]);
  assert.strictEqual(r.internal, 443);
});
test('Dynamic mode: no internal fragmentation, memory is conserved', () => {
  for (const st of ['first', 'best', 'worst']) {
    const r = A.memory.allocate(blocks, mp, st, 'dynamic');
    assert.strictEqual(r.internal, 0);
    assert.strictEqual(r.segs.reduce((s, x) => s + x.size, 0), 1700);
    assert.strictEqual(r.usedMem + r.totalFree, 1700);
  }
});
test('External fragmentation flagged when request fits total free but no single hole', () => {
  const r = A.memory.allocate([100, 100, 100], [{ id: 'A', size: 60 }, { id: 'B', size: 60 }, { id: 'C', size: 60 }, { id: 'D', size: 90 }], 'first', 'dynamic');
  // after A,B,C: holes 40+40+40 = 120 total, largest 40 -> D(90) fits total but no hole
  assert.ok(r.externalFrag);
  assert.deepStrictEqual(r.unallocated, ['D']);
});

console.log('Producer-consumer');
test('invariants hold at every tick (balanced and overloaded configs)', () => {
  for (const cfg of [{}, { capacity: 1, producers: 3, consumers: 1, prodPeriod: 1, consPeriod: 4 },
    { capacity: 6, producers: 1, consumers: 3, prodPeriod: 3, consPeriod: 1 }]) {
    const s = A.pc.create(cfg);
    for (let i = 0; i < 200; i++) { A.pc.step(s); assert.ok(A.pc.invariant(s), JSON.stringify(cfg) + ' tick ' + i); }
  }
});
test('slow consumer: buffer fills, producers block, never exceeds capacity', () => {
  const s = A.pc.run({ capacity: 3, producers: 2, consumers: 1, prodPeriod: 1, consPeriod: 5 }, 40);
  assert.ok(s.prodBlocked > 0 && s.maxOcc === 3);
});
test('fast consumer: consumers block on empty buffer', () => {
  const s = A.pc.run({ capacity: 3, producers: 1, consumers: 2, prodPeriod: 4, consPeriod: 1 }, 40);
  assert.ok(s.consBlocked > 0);
});
test('FIFO order: items consumed in the order produced', () => {
  const s = A.pc.run({ capacity: 5, producers: 1, consumers: 1, prodPeriod: 1, consPeriod: 1 }, 20);
  const prod = s.log.filter(l => l.kind === 'produce').map(l => l.text.split(' ')[2]);
  const cons = s.log.filter(l => l.kind === 'consume').map(l => l.text.split(' ')[2]);
  assert.deepStrictEqual(cons, prod.slice(0, cons.length));
});
test('queue telemetry tracks history and per-actor service totals', () => {
  const s = A.pc.run({ capacity: 4, producers: 2, consumers: 2, prodPeriod: 2, consPeriod: 3 }, 50);
  const last = s.history[s.history.length - 1];
  assert.strictEqual(s.history.length, 51);
  assert.strictEqual(last.occupancy, s.buffer.length);
  assert.strictEqual(last.produced, s.produced);
  assert.strictEqual(last.consumed, s.consumed);
  const served = type => s.actors.filter(a => a.type === type).reduce((sum, a) => sum + a.served, 0);
  assert.strictEqual(served('producer'), s.produced);
  assert.strictEqual(served('consumer'), s.consumed);
  assert.ok(s.actors.every(a => a.blocked >= 0 && a.served >= 0));
});

console.log(`\n${passed} tests passed`);
