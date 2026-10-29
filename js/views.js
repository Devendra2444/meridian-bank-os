(function () {
  'use strict';
  window.NB = window.NB || {};
  const A = window.OSAlgo;
  const icon = NB.icon;
  const U = NB.util;
  const Store = NB.Store;
  const ALGO_META = NB.ALGO_META;
  const views = {};

  const RESOURCE_META = [
    { name: 'Database pool', code: 'DB', icon: 'database', tone: 'sky' },
    { name: 'Transaction threads', code: 'SVC', icon: 'server', tone: 'violet' },
    { name: 'Ledger locks', code: 'LOCK', icon: 'lock', tone: 'amber' }
  ];

  const ACTIVITY_META = {
    intake: { icon: 'inbox', tone: 'sky' },
    guard: { icon: 'shield', tone: 'emerald' },
    scheduler: { icon: 'cpu', tone: 'blue' },
    queue: { icon: 'layers', tone: 'cyan' },
    memory: { icon: 'chip', tone: 'violet' },
    system: { icon: 'activity', tone: 'slate' }
  };

  const CHANNELS = ['ATM', 'Mobile', 'Branch', 'Batch', 'API'];

  /* ------------------------------------------------------------------ shared UI */

  function pageHead(eyebrow, title, sub, actions) {
    return `<div class="page-head">
      <div class="page-title-block">
        <p class="eyebrow">${eyebrow}</p>
        <h1>${title}</h1>
        <p class="page-sub">${sub}</p>
      </div>
      ${actions ? `<div class="page-actions">${actions}</div>` : ''}
    </div>`;
  }

  function cardHead(title, sub, actions) {
    return `<div class="card-head">
      <div class="card-title-block">
        <h2>${title}</h2>
        ${sub ? `<p>${sub}</p>` : ''}
      </div>
      ${actions ? `<div class="card-actions">${actions}</div>` : ''}
    </div>`;
  }

  function badge(text, tone, dot) {
    return `<span class="badge badge--${tone || 'neutral'}">${dot ? '<i class="badge-dot"></i>' : ''}${U.esc(text)}</span>`;
  }

  function statusBadge(status) {
    return badge(status.label, status.tone, true);
  }

  function priorityBadge(priority) {
    return `<span class="priority ${U.priorityClass(priority)}">P${priority}</span>`;
  }

  function textLink(href, label, iconName) {
    return `<a class="text-link" href="${href}">${U.esc(label)}${icon(iconName || 'arrowUpRight', 14)}</a>`;
  }

  function emptyState(iconName, title, detail) {
    return `<div class="empty-state">
      <span class="empty-icon">${icon(iconName || 'scan', 22)}</span>
      <b>${U.esc(title)}</b>
      ${detail ? `<span>${U.esc(detail)}</span>` : ''}
    </div>`;
  }

  function progress(value, tone) {
    const width = U.clamp((value || 0) * 100, 0, 100);
    return `<div class="progress ${tone ? 'progress--' + tone : ''}"><i style="width:${width.toFixed(1)}%"></i></div>`;
  }

  function txnDot(id) {
    return `<span class="tx-dot" style="--tx:${U.colorFor(id)}"></span>`;
  }

  function txnCell(t) {
    return `<span class="txn-cell">${txnDot(t.id)}<span class="txn-copy"><b>${U.esc(t.name)}</b><span>${t.id} · ${U.esc(t.channel)}</span></span></span>`;
  }

  function headChip(content, tone) {
    return `<span class="head-chip ${tone ? 'head-chip--' + tone : ''}">${content}</span>`;
  }

  function sequenceChips(bk, txns) {
    if (!bk || !bk.sequence.length) return '<span class="empty-inline">No safe path</span>';
    return bk.sequence.map((index, i) => {
      const t = txns[index];
      if (!t) return '';
      return `${i ? `<span class="seq-arrow">${icon('chevronRight', 12)}</span>` : ''}<span class="seq-chip" style="--tx:${U.colorFor(t.id)}"><b>${i + 1}</b>${t.id}</span>`;
    }).join('');
  }

  function axisTicks(total) {
    const step = total <= 12 ? 2 : total <= 30 ? 4 : total <= 60 ? 10 : 20;
    const ticks = [];
    for (let t = 0; t <= total; t += step) ticks.push(t);
    if (ticks[ticks.length - 1] !== total) ticks.push(total);
    return ticks;
  }

  function ganttHTML(result, compact) {
    const total = Math.max(1, result.timeline.length ? result.timeline[result.timeline.length - 1].end : 1);
    if (!result.timeline.length) {
      return `<div class="gantt gantt--empty">${emptyState('cpu', 'No dispatch window', 'No transactions are cleared for scheduling.')}</div>`;
    }
    const segments = result.timeline.map(seg => {
      const width = ((seg.end - seg.start) / total) * 100;
      const color = seg.pid ? U.colorFor(seg.pid) : null;
      const label = seg.pid && width >= 3.4 ? `<span>${seg.pid}</span>` : '';
      const title = seg.pid ? `${seg.pid} · ${seg.start}–${seg.end} ms` : `Idle · ${seg.start}–${seg.end} ms`;
      return `<div class="gantt-seg ${seg.pid ? '' : 'is-idle'} ${width < 2 ? 'is-tiny' : ''}" style="width:${width.toFixed(3)}%;${color ? `background:${color};color:${U.textOn(color)}` : ''}" title="${U.esc(title)}">${label}</div>`;
    }).join('');
    const axis = compact ? '' : (() => {
      const ticks = axisTicks(total);
      const labels = ticks.map(t => {
        const pos = (t / total) * 100;
        const cls = t === 0 ? 'is-first' : t === total ? 'is-last' : '';
        return `<span class="gantt-tick ${cls}" style="left:${pos.toFixed(3)}%">${t}</span>`;
      }).join('');
      return `<div class="gantt-axis">${labels}</div>`;
    })();
    return `<div class="gantt ${compact ? 'gantt--compact' : ''}"><div class="gantt-track">${segments}</div>${axis}</div>`;
  }

  function activityRow(item) {
    const meta = ACTIVITY_META[item.type] || ACTIVITY_META.system;
    return `<div class="activity-row">
      <span class="activity-icon tone-${meta.tone}">${icon(meta.icon, 16)}</span>
      <div class="activity-copy"><b>${U.esc(item.title)}</b><span>${U.esc(item.meta)}</span></div>
      <time>${U.timeAgo(item.at)}</time>
    </div>`;
  }

  function alertsHTML(alerts) {
    if (!alerts.length) return '';
    return `<div class="alert-stack">${alerts.map(alert => `<div class="alert alert--${alert.tone}">
      <span class="alert-icon">${icon(alert.tone === 'bad' ? 'alert' : 'zap', 18)}</span>
      <div class="alert-copy"><b>${U.esc(alert.title)}</b><span>${U.esc(alert.detail)}</span></div>
      <a class="alert-link" href="#/${alert.route}">${U.esc(alert.action)}${icon('arrowRight', 14)}</a>
    </div>`).join('')}</div>`;
  }

  /* ------------------------------------------------------------------ command center */

  views.overview = function (root) {
    const state = Store.state;
    const a = NB.analysis();
    const q = a.queue;
    const placed = Object.values(a.placedMap).filter(p => p.ok).length;
    const waitDelta = a.dispatch.avgWT - a.best.result.avgWT;
    const waitTone = waitDelta <= 0.05 ? 'good' : waitDelta < 2 ? 'warn' : 'bad';
    const healthTone = a.alerts.some(x => x.tone === 'bad') ? 'risk' : a.alerts.length ? 'warn' : 'ok';
    const health = a.alerts.length ? `${a.alerts.length} attention item${a.alerts.length > 1 ? 's' : ''}` : 'All systems nominal';
    const queueHist = q.history.map(h => h.occupancy);
    const seqCount = a.bk.sequence.length;

    const nodes = [
      { icon: 'inbox', tone: 'sky', label: 'Intake', value: a.txns.length, sub: `${a.urgent} urgent` },
      { icon: 'layers', tone: 'cyan', label: 'Buffer', value: `${q.buffer.length}/${q.capacity}`, sub: `${q.prodBlocked} holds` },
      { icon: 'chip', tone: 'violet', label: 'Memory', value: `${placed}/${a.txns.length}`, sub: `${state.memory.mode} partitions` },
      { icon: 'shield', tone: a.effectiveSafe ? 'emerald' : 'rose', label: 'Guard', value: a.effectiveSafe ? 'SAFE' : 'HOLD', sub: `${seqCount}-step path` },
      { icon: 'cpu', tone: 'blue', label: 'Dispatch', value: a.admitted.length, sub: U.shortAlgo(state.scheduler.algo) }
    ];

    const resourceRows = RESOURCE_META.map((meta, j) => {
      const used = a.resourceUsed[j];
      const total = a.resourceTotals[j] || 0;
      const ratio = total ? used / total : 0;
      return `<div class="posture-row">
        <span class="posture-icon tone-${meta.tone}">${icon(meta.icon, 17)}</span>
        <div class="posture-main">
          <div class="posture-top"><span>${meta.name}</span><b>${used}<span> / ${total}</span></b></div>
          ${progress(ratio, meta.tone)}
        </div>
      </div>`;
    }).join('');

    const batchRows = a.txns.map((t, i) => {
      const st = a.statuses[i];
      const row = a.dispatchRows[t.id];
      const mem = a.placedMap[t.id];
      const order = a.orderIndex[t.id];
      return `<tr>
        <td>${txnCell(t)}</td>
        <td>${priorityBadge(t.priority)}</td>
        <td class="mono">${order === undefined ? '—' : '#' + (order + 1)}</td>
        <td class="mono">${row ? U.fmt(row.wt, 1) + ' ms' : '—'}</td>
        <td>${mem && mem.ok ? `<span class="mem-inline"><b>${mem.block}</b><span>${U.num(mem.size)}K</span></span>` : '—'}</td>
        <td>${statusBadge(st)}</td>
      </tr>`;
    }).join('');

    root.innerHTML = `${pageHead(
      'Operations / Overview',
      'Command center',
      `Batch <span class="mono">${state.batch.id}</span> · ${a.txns.length} transactions · last run ${U.timeAgo(state.batch.lastRun)}`,
      `${headChip(`<span class="status-dot status-dot--${healthTone}"></span>${U.esc(health)}`)}${headChip(`${icon('server', 14)} Core production`)}`
    )}
    ${alertsHTML(a.alerts)}

    <div class="kpi-grid">
      <article class="kpi-card">
        <div class="kpi-head"><span class="kpi-icon tone-cyan">${icon('layers')}</span><span class="kpi-label">Queue depth</span>${badge(q.buffer.length >= q.capacity ? 'Constrained' : 'Flowing', q.buffer.length >= q.capacity ? 'warn' : 'good', true)}</div>
        <div class="kpi-value">${q.buffer.length}<span class="kpi-unit">/ ${q.capacity}</span></div>
        <div class="kpi-foot"><span>${q.prodBlocked} ingress holds · ${q.consumed} settled</span></div>
        <div class="kpi-spark">${NB.charts.sparkline(queueHist.slice(-30), '#38BDF8')}</div>
      </article>

      <article class="kpi-card">
        <div class="kpi-head"><span class="kpi-icon tone-amber">${icon('cpu')}</span><span class="kpi-label">Average wait</span>${badge(waitTone === 'good' ? 'Optimal' : '+' + U.fmt(waitDelta, 1) + ' vs best', waitTone)}</div>
        <div class="kpi-value">${a.admitted.length ? U.fmt(a.dispatch.avgWT, 1) : '—'}<span class="kpi-unit">ms</span></div>
        <div class="kpi-foot"><span>${U.shortAlgo(state.scheduler.algo)} · ${a.admitted.length} cleared</span></div>
        <div class="kpi-spark">${NB.charts.sparkline(a.dispatch.rows.map(r => r.wt), '#F4B740')}</div>
      </article>

      <article class="kpi-card">
        <div class="kpi-head"><span class="kpi-icon tone-emerald">${icon('shield')}</span><span class="kpi-label">Safety state</span>${badge(a.effectiveSafe ? 'Verified' : 'Review', a.effectiveSafe ? 'good' : 'bad', true)}</div>
        <div class="kpi-value kpi-value--status ${a.effectiveSafe ? 'is-good' : 'is-bad'}">${a.invalidBanker ? 'INVALID' : a.effectiveSafe ? 'SAFE' : 'UNSAFE'}</div>
        <div class="kpi-foot"><span>${a.invalidBanker ? 'Claim ledger invalid' : a.effectiveSafe ? `${seqCount}-step recovery path` : `${a.txns.length - seqCount} transactions blocked`}</span></div>
        <div class="sequence-inline">${sequenceChips(a.bk, a.txns)}</div>
      </article>

      <article class="kpi-card">
        <div class="kpi-head"><span class="kpi-icon tone-violet">${icon('chip')}</span><span class="kpi-label">Memory mapped</span>${badge(placed === a.txns.length ? 'Clear' : 'Pending', placed === a.txns.length ? 'good' : 'warn', true)}</div>
        <div class="kpi-value">${placed}<span class="kpi-unit">/ ${a.txns.length}</span></div>
        <div class="kpi-foot"><span>${U.pct(a.mem.utilization)} committed · ${U.num(a.mem.internal)}K slack</span></div>
        <div class="kpi-ring" style="--ring-color:#A78BFA;--ring-value:${(a.mem.utilization * 100).toFixed(1)}"><span>${U.pct(a.mem.utilization)}</span></div>
      </article>
    </div>

    <div class="overview-grid">
      <article class="panel span-8 pipeline-panel">
        ${cardHead('Batch pipeline', `${a.txns.length} transactions · ${state.batch.id}`, `${textLink('#/queue', 'Open queue')}`)}
        <div class="pipeline">
          ${nodes.map((node, i) => `<div class="pipe-node">
            <span class="pipe-icon tone-${node.tone}">${icon(node.icon, 19)}</span>
            <span class="pipe-label">${node.label}</span>
            <b class="pipe-value">${node.value}</b>
            <span class="pipe-sub">${node.sub}</span>
          </div>${i < nodes.length - 1 ? `<span class="pipe-link">${icon('chevronRight', 14)}</span>` : ''}`).join('')}
        </div>
        <div class="pipeline-timeline">
          <div class="mini-head"><span>Dispatch timeline</span><span class="mono">${a.dispatch.totalTime} ms window</span></div>
          ${a.admitted.length ? ganttHTML(a.dispatch, true) : emptyState('cpu', 'No dispatch window', 'No transactions are cleared for scheduling.')}
          <div class="timeline-foot">
            <span>${U.shortAlgo(state.scheduler.algo)} · ${a.admitted.length} cleared</span>
            <span>${a.admitted.length ? 'avg wait ' + U.fmt(a.dispatch.avgWT, 1) + ' ms' : 'awaiting admission'}</span>
          </div>
        </div>
      </article>

      <aside class="panel posture-panel">
        ${cardHead('Resource posture', 'Live allocation', textLink('#/resources', 'Manage'))}
        <div class="posture-list">${resourceRows}</div>
        <div class="posture-divider"></div>
        <div class="posture-memory">
          <div class="posture-top"><span>Memory commitment</span><b>${U.pct(a.mem.utilization)}</b></div>
          ${progress(a.mem.utilization, 'violet')}
          <div class="mini-foot"><span>${U.num(a.mem.usedMem)} KB in use</span><span>${U.num(a.mem.internal)} KB slack</span></div>
        </div>
        <div class="sequence-block">
          <span class="mini-label">Recovery path</span>
          <div class="seq-chips">${sequenceChips(a.bk, a.txns)}</div>
        </div>
      </aside>

      <article class="panel batch-panel">
        ${cardHead('Batch transactions', `${a.txns.length} records · ${a.admitted.length} cleared`, `<span class="table-hint">Scroll table ${icon('arrowRight', 11)}</span>${textLink('#/intake', 'Manage load')}`)}
        <div class="table-wrap">
          <table class="data-table table-compact">
            <thead><tr><th>Transaction</th><th>Priority</th><th>Dispatch</th><th>Wait</th><th>Memory</th><th>State</th></tr></thead>
            <tbody>${batchRows}</tbody>
          </table>
        </div>
      </article>

      <aside class="panel activity-panel">
        ${cardHead('Activity', 'Cross-plane events', `${textLink('#/queue', 'Stream')}`)}
        <div class="activity-list">${state.activity.slice(0, 6).map(activityRow).join('') || emptyState('activity', 'No recent activity')}</div>
      </aside>
    </div>`;
  };

  /* ------------------------------------------------------------------ intake */

  views.intake = function (root) {
    const state = Store.state;
    const a = NB.analysis();
    const avgBurst = a.txns.length ? a.totalBurst / a.txns.length : 0;
    const placed = Object.values(a.placedMap).filter(p => p.ok).length;
    const atLimit = a.txns.length >= 8;

    const rows = a.txns.map((t, i) => {
      const status = a.statuses[i];
      return `<tr>
        <td><span class="ref-chip" style="--tx:${U.colorFor(t.id)}">${t.id}</span></td>
        <td class="cell-name"><input class="table-input" data-field="name" data-i="${i}" value="${U.esc(t.name)}" maxlength="42" aria-label="Transaction name"></td>
        <td><select class="table-select" data-field="channel" data-i="${i}" aria-label="Source channel">${CHANNELS.concat(CHANNELS.includes(t.channel) ? [] : [t.channel]).map(ch => `<option ${ch === t.channel ? 'selected' : ''}>${U.esc(ch)}</option>`).join('')}</select></td>
        <td><input class="table-number" type="number" min="0" max="999" data-field="arrival" data-i="${i}" value="${t.arrival}" aria-label="Arrival milliseconds"></td>
        <td><input class="table-number" type="number" min="1" max="99" data-field="burst" data-i="${i}" value="${t.burst}" aria-label="CPU burst milliseconds"></td>
        <td><input class="table-number" type="number" min="1" max="9" data-field="priority" data-i="${i}" value="${t.priority}" aria-label="Priority"></td>
        <td><input class="table-number table-number--wide" type="number" min="1" max="65536" data-field="size" data-i="${i}" value="${t.size}" aria-label="Memory footprint kilobytes"></td>
        <td>${statusBadge(status)}</td>
        <td class="cell-action"><button class="icon-button icon-button--danger" type="button" data-delete="${i}" aria-label="Remove ${t.id}" title="Remove transaction">${icon('trash', 16)}</button></td>
      </tr>`;
    }).join('');

    const maxBurst = Math.max(...a.txns.map(t => t.burst), 1);
    const maxSize = Math.max(...a.txns.map(t => t.size), 1);
    const demandRows = a.txns.map(t => `<div class="demand-row">
      <div class="demand-label">${txnDot(t.id)}<b>${t.id}</b><span>${U.esc(t.name)}</span></div>
      <div class="demand-meters">
        <div class="demand-meter"><span>CPU</span><div class="micro-bar"><i style="width:${(t.burst / maxBurst) * 100}%;background:${U.colorFor(t.id)}"></i></div><b>${t.burst} ms</b></div>
        <div class="demand-meter"><span>MEM</span><div class="micro-bar"><i style="width:${(t.size / maxSize) * 100}%;background:${U.colorFor(t.id)};opacity:.7"></i></div><b>${U.num(t.size)} KB</b></div>
      </div>
    </div>`).join('');

    const admittedPct = Math.round((a.admitted.length / Math.max(1, a.txns.length)) * 100);

    root.innerHTML = `${pageHead(
      'Operations / Intake',
      'Transaction intake',
      'Batch composition, execution budgets, and admission readiness.',
      `<button class="btn btn-primary" id="add-txn" type="button" ${atLimit ? 'disabled' : ''}>${icon('plus', 17)} Add transaction</button>`
    )}

    <div class="kpi-grid">
      <article class="kpi-card">
        <div class="kpi-head"><span class="kpi-icon tone-sky">${icon('inbox')}</span><span class="kpi-label">Active records</span>${badge(a.txns.length + ' / 8', 'neutral')}</div>
        <div class="kpi-value">${a.txns.length}</div>
        <div class="kpi-foot"><span>${a.urgent} urgent · ${a.txns.length - a.urgent} standard</span></div>
      </article>
      <article class="kpi-card">
        <div class="kpi-head"><span class="kpi-icon tone-amber">${icon('cpu')}</span><span class="kpi-label">CPU demand</span>${badge('Batch', 'neutral')}</div>
        <div class="kpi-value">${a.totalBurst}<span class="kpi-unit">ms</span></div>
        <div class="kpi-foot"><span>${U.fmt(avgBurst, 1)} ms average burst</span></div>
      </article>
      <article class="kpi-card">
        <div class="kpi-head"><span class="kpi-icon tone-violet">${icon('chip')}</span><span class="kpi-label">Working set</span>${badge(state.memory.mode, 'neutral')}</div>
        <div class="kpi-value">${U.num(a.totalMemory)}<span class="kpi-unit">KB</span></div>
        <div class="kpi-foot"><span>${state.memory.blocks.length} partitions · ${U.num(a.mem.total)} KB total</span></div>
      </article>
      <article class="kpi-card">
        <div class="kpi-head"><span class="kpi-icon tone-emerald">${icon('shield')}</span><span class="kpi-label">Admission</span>${badge(a.effectiveSafe ? 'Safe' : 'Constrained', a.effectiveSafe ? 'good' : 'bad', true)}</div>
        <div class="kpi-value">${a.admitted.length}<span class="kpi-unit">/ ${a.txns.length}</span></div>
        <div class="kpi-foot"><span>${a.effectiveSafe ? 'Safety path valid' : 'New admissions paused'}</span></div>
        <div class="kpi-ring" style="--ring-color:#34D399;--ring-value:${admittedPct}"><span>${admittedPct}%</span></div>
      </article>
    </div>

    <article class="panel manifest-panel">
      ${cardHead('Batch manifest', `${a.txns.length} records · ${placed} mapped · changes autosave`, `<span class="table-hint">Scroll table ${icon('arrowRight', 11)}</span>${badge(atLimit ? 'Limit reached' : 'Editable', atLimit ? 'warn' : 'info', true)}`)}
      <div class="table-wrap">
        <table class="data-table manifest-table">
          <thead><tr>
            <th>Ref</th><th class="left">Transaction</th><th>Source</th><th>Arrival <span class="unit">ms</span></th><th>CPU <span class="unit">ms</span></th><th>Priority</th><th>Memory <span class="unit">KB</span></th><th>State</th><th></th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </article>

    <div class="intake-grid">
      <article class="panel span-7">
        ${cardHead('Demand profile', 'CPU and memory footprint by record', badge('Load map', 'info'))}
        <div class="demand-chart">${demandRows}</div>
        <div class="demand-footer"><span>Total CPU <b>${a.totalBurst} ms</b></span><span>Total memory <b>${U.num(a.totalMemory)} KB</b></span></div>
      </article>
      <aside class="panel span-5">
        ${cardHead('Dispatch readiness', 'Cross-plane validation', textLink('#/overview', 'Open center'))}
        <div class="readiness">
          <div class="ring ring--lg" style="--ring-color:#34D399;--ring-value:${admittedPct}"><div class="ring-inner"><b>${a.admitted.length}/${a.txns.length}</b><span>cleared</span></div></div>
          <div class="readiness-rows">
            <div class="readiness-row"><span>Memory map</span><b>${placed}/${a.txns.length}</b>${badge(placed === a.txns.length ? 'Clear' : 'Waiting', placed === a.txns.length ? 'good' : 'warn')}</div>
            <div class="readiness-row"><span>Safety state</span><b>${a.effectiveSafe ? 'Verified' : 'Review'}</b>${badge(a.effectiveSafe ? 'SAFE' : 'HOLD', a.effectiveSafe ? 'good' : 'bad')}</div>
            <div class="readiness-row"><span>Dispatch policy</span><b>${U.shortAlgo(state.scheduler.algo)}</b>${badge(U.fmt(a.cpu.avgWT, 1) + ' ms avg', 'neutral')}</div>
          </div>
        </div>
        <a class="btn btn-secondary btn-block readiness-link" href="#/scheduler">${icon('cpu', 16)} Inspect dispatch plan ${icon('arrowRight', 15)}</a>
      </aside>
    </div>`;

    const addButton = root.querySelector('#add-txn');
    if (addButton) addButton.addEventListener('click', () => addTransaction(root));

    root.querySelectorAll('[data-delete]').forEach(button => {
      button.addEventListener('click', () => removeTransaction(root, Number(button.dataset.delete)));
    });

    root.onchange = event => {
      const input = event.target.closest('[data-field]');
      if (!input) return;
      const index = Number(input.dataset.i);
      const field = input.dataset.field;
      const txn = state.txns[index];
      if (!txn) return;
      if (field === 'name') {
        txn.name = input.value.trim().slice(0, 42) || 'Untitled transaction';
      } else if (field === 'channel') {
        txn.channel = input.value;
      } else {
        const limits = { arrival: [0, 999], burst: [1, 99], priority: [1, 9], size: [1, 65536] };
        const [min, max] = limits[field] || [0, 999999];
        txn[field] = U.int(input.value, txn[field], min, max);
      }
      Store.save();
      views.intake(root);
    };
  };

  function addTransaction(root) {
    const state = Store.state;
    if (state.txns.length >= 8) {
      NB.toast({ title: 'Batch limit reached', message: 'The manifest supports up to 8 concurrent records.', tone: 'warn' });
      return;
    }
    const maxId = state.txns.reduce((max, t) => {
      const digits = parseInt(String(t.id).replace(/\D/g, ''), 10);
      return Number.isFinite(digits) ? Math.max(max, digits) : max;
    }, 0);
    const maxArrival = state.txns.reduce((max, t) => Math.max(max, t.arrival), 0);
    const txn = {
      id: 'T' + (maxId + 1),
      name: 'New transaction',
      channel: 'API',
      arrival: Math.min(999, maxArrival + 1),
      burst: 2,
      priority: 5,
      size: 128
    };
    state.txns.push(txn);
    state.banker.alloc.push([0, 0, 0]);
    state.banker.max.push([2, 1, 1]);
    state.banker.result = null;
    Store.addActivity('intake', 'Transaction added to batch', `${txn.id} · ${txn.name}`);
    Store.save();
    views.intake(root);
    NB.toast({ title: 'Transaction added', message: `${txn.id} is now part of the active batch.`, tone: 'good' });
  }

  function removeTransaction(root, index) {
    const state = Store.state;
    if (state.txns.length <= 1) {
      NB.toast({ title: 'Batch requires a record', message: 'At least one transaction must remain in the manifest.', tone: 'warn' });
      return;
    }
    const [removed] = state.txns.splice(index, 1);
    state.banker.alloc.splice(index, 1);
    state.banker.max.splice(index, 1);
    if (state.banker.req.pid >= state.txns.length) state.banker.req = { pid: 0, vec: [0, 0, 0] };
    state.banker.result = null;
    Store.addActivity('intake', 'Transaction removed from batch', `${removed.id} · ${removed.name}`);
    Store.save();
    views.intake(root);
    NB.toast({ title: 'Transaction removed', message: `${removed.id} has been removed from the batch.`, tone: 'neutral' });
  }

  /* ------------------------------------------------------------------ scheduler */

  views.scheduler = function (root) {
    const state = Store.state;
    const a = NB.analysis();
    const result = a.cpu;
    const bestWait = a.best.result.avgWT;
    const maxWT = Math.max(...a.benchmark.map(x => x.result.avgWT), 1);
    const isRoundRobin = state.scheduler.algo === 'RR';

    const benchmarks = a.benchmark.map(item => {
      const selected = item.key === state.scheduler.algo;
      const best = item.key === a.best.key;
      const width = Math.max(1.2, (item.result.avgWT / maxWT) * 100);
      return `<button class="bench-row ${selected ? 'is-active' : ''}" type="button" data-algo="${item.key}" aria-pressed="${selected}">
        <span class="bench-info"><span class="bench-name">${ALGO_META[item.key].name}</span><span class="bench-tags">${best ? badge('Best', 'good') : ''}${selected ? badge('Active', 'info') : ''}</span></span>
        <span class="bench-track"><i style="width:${width}%"></i></span>
        <span class="bench-value mono">${U.fmt(item.result.avgWT, 1)}<small>ms</small></span>
      </button>`;
    }).join('');

    const metricRows = result.rows.map(row => {
      const txn = a.txns.find(t => t.id === row.id);
      return `<tr>
        <td>${txnCell(txn)}</td>
        <td class="mono">${row.arrival}</td>
        <td class="mono">${row.burst}</td>
        <td>${priorityBadge(row.priority)}</td>
        <td class="mono">${row.ct}</td>
        <td class="mono">${row.tat}</td>
        <td class="mono strong">${row.wt}</td>
        <td class="mono">${row.rt}</td>
      </tr>`;
    }).join('');

    const legend = a.txns.map(t => `<span class="legend-item">${txnDot(t.id)}${t.id}</span>`).join('');

    root.innerHTML = `${pageHead(
      'Control planes / CPU',
      'CPU scheduler',
      `Policy simulation across <span class="mono">${a.txns.length}</span> transactions and <span class="mono">${result.totalTime}</span> CPU milliseconds.`,
      `${headChip(`${icon('gauge', 14)} ${U.shortAlgo(state.scheduler.algo)}`)}${headChip(`${icon('activity', 14)} ${U.pct(result.utilization)} utilized`)}`
    )}

    <div class="panel scheduler-controls">
      <div class="toolbar-group">
        <label class="field-inline"><span>Dispatch policy</span><span class="select-wrap"><select id="sched-algo" class="select">${Object.keys(A.cpu.ALGOS).map(key => `<option value="${key}" ${key === state.scheduler.algo ? 'selected' : ''}>${ALGO_META[key].name}</option>`).join('')}</select></span></label>
        <label class="field-inline ${isRoundRobin ? '' : 'is-hidden'}" id="quantum-field"><span>Time quantum</span><input class="input input--small" type="number" min="1" max="64" id="sched-quantum" value="${state.scheduler.quantum}"><span class="field-unit">ms</span></label>
      </div>
      <div class="toolbar-meta">
        ${badge(a.txns.length + ' transactions', 'neutral')}
        ${badge(bestWait === result.avgWT ? 'Optimal wait' : '+' + U.fmt(result.avgWT - bestWait, 1) + ' ms vs best', result.avgWT === bestWait ? 'good' : 'warn', true)}
      </div>
    </div>

    <div class="kpi-grid">
      <article class="kpi-card">
        <div class="kpi-head"><span class="kpi-icon tone-amber">${icon('clock')}</span><span class="kpi-label">Average wait</span></div>
        <div class="kpi-value">${U.fmt(result.avgWT, 1)}<span class="kpi-unit">ms</span></div>
        <div class="kpi-foot"><span>Best ${U.fmt(bestWait, 1)} ms · ${U.shortAlgo(a.best.key)}</span></div>
      </article>
      <article class="kpi-card">
        <div class="kpi-head"><span class="kpi-icon tone-sky">${icon('arrowRight')}</span><span class="kpi-label">Turnaround</span></div>
        <div class="kpi-value">${U.fmt(result.avgTAT, 1)}<span class="kpi-unit">ms</span></div>
        <div class="kpi-foot"><span>Across ${result.rows.length} completed records</span></div>
      </article>
      <article class="kpi-card">
        <div class="kpi-head"><span class="kpi-icon tone-violet">${icon('zap')}</span><span class="kpi-label">Response</span></div>
        <div class="kpi-value">${U.fmt(result.avgRT, 1)}<span class="kpi-unit">ms</span></div>
        <div class="kpi-foot"><span>${U.shortAlgo(state.scheduler.algo)} · first dispatch latency</span></div>
      </article>
      <article class="kpi-card">
        <div class="kpi-head"><span class="kpi-icon tone-emerald">${icon('cpu')}</span><span class="kpi-label">CPU utilized</span></div>
        <div class="kpi-value">${U.pct(result.utilization)}</div>
        <div class="kpi-foot"><span>${result.totalTime} ms dispatch window · ${a.totalBurst} ms busy</span></div>
      </article>
    </div>

    <div class="scheduler-grid">
      <article class="panel span-8">
        ${cardHead('Dispatch timeline', `${result.totalTime} ms · ${U.shortAlgo(state.scheduler.algo)}`, badge(result.order.length + ' dispatches', 'info'))}
        ${ganttHTML(result, false)}
        <div class="gantt-legend">${legend}</div>
        <div class="dispatch-order"><span class="mini-label">Dispatch order</span><span class="order-chain mono">${result.order.join(' → ')}</span></div>
      </article>

      <aside class="panel span-4">
        ${cardHead('Policy benchmark', 'Average wait by policy', textLink('#/resources', 'Guard'))}
        <div class="bench-list">${benchmarks}</div>
        <div class="bench-footer"><span>Lowest wait</span><b>${ALGO_META[a.best.key].name} · ${U.fmt(a.best.result.avgWT, 1)} ms</b></div>
      </aside>
    </div>

    <article class="panel">
      ${cardHead('Transaction metrics', `${ALGO_META[state.scheduler.algo].name} · full workload`, `<span class="table-hint">Scroll table ${icon('arrowRight', 11)}</span>${badge('AT · arrival', 'neutral')}${badge('BT · burst', 'neutral')}${badge('WT · wait', 'neutral')}`)}
      <div class="table-wrap">
        <table class="data-table metrics-table">
          <thead><tr><th>Transaction</th><th>Arrival</th><th>Burst</th><th>Priority</th><th>Completion</th><th>Turnaround</th><th>Waiting</th><th>Response</th></tr></thead>
          <tbody>${metricRows}</tbody>
          <tfoot><tr><td class="left">Average</td><td>—</td><td>${U.fmt(a.totalBurst / Math.max(1, a.txns.length), 1)}</td><td>—</td><td>—</td><td>${U.fmt(result.avgTAT, 1)}</td><td>${U.fmt(result.avgWT, 1)}</td><td>${U.fmt(result.avgRT, 1)}</td></tr></tfoot>
        </table>
      </div>
    </article>`;

    const algoSelect = root.querySelector('#sched-algo');
    if (algoSelect) {
      algoSelect.addEventListener('change', () => {
        state.scheduler.algo = algoSelect.value;
        Store.save();
        views.scheduler(root);
      });
    }
    const quantum = root.querySelector('#sched-quantum');
    if (quantum) {
      quantum.addEventListener('change', () => {
        state.scheduler.quantum = U.int(quantum.value, 2, 1, 64);
        Store.save();
        views.scheduler(root);
      });
    }
    root.querySelectorAll('[data-algo]').forEach(button => {
      button.addEventListener('click', () => {
        if (state.scheduler.algo === button.dataset.algo) return;
        state.scheduler.algo = button.dataset.algo;
        Store.save();
        views.scheduler(root);
      });
    });
  };

  /* ------------------------------------------------------------------ request queue */

  let qTimer = null;
  let qRunning = false;

  function stopQueueTimer() {
    if (qTimer) clearInterval(qTimer);
    qTimer = null;
    qRunning = false;
  }

  function syncQueueRunUI() {
    const live = document.getElementById('q-live');
    if (live) {
      live.className = 'live-state ' + (qRunning ? 'is-running' : 'is-paused');
      live.innerHTML = `<i></i>${qRunning ? 'Running' : 'Paused'}`;
    }
    const runButton = document.getElementById('q-run');
    if (runButton) runButton.innerHTML = `${icon(qRunning ? 'pause' : 'play', 16)}<span>${qRunning ? 'Pause' : 'Run'}</span>`;
  }

  function startQueueTimer() {
    if (qRunning) return;
    qRunning = true;
    if (qTimer) clearInterval(qTimer);
    qTimer = setInterval(() => {
      if (!document.getElementById('q-buffer-slots')) {
        stopQueueTimer();
        return;
      }
      A.pc.step(Store.state.queue.sim);
      drawQueueLive();
    }, Store.state.speed);
    syncQueueRunUI();
  }

  views.queue = function (root) {
    stopQueueTimer();
    const state = Store.state;
    const cfg = state.queueCfg;
    const speed = state.speed;

    root.innerHTML = `${pageHead(
      'Control planes / Queue',
      'Request queue',
      `Bounded intake · <span class="mono">${cfg.capacity}</span> slots · <span class="mono">${cfg.producers}</span> sources · <span class="mono">${cfg.consumers}</span> pods.`,
      `${headChip(`<span class="live-dot"></span> Live session`, 'ok')}${headChip(`${icon('clock', 14)} cycle <span class="mono" id="q-tick">${state.queue.sim.tick}</span>`)}`
    )}

    <div class="panel queue-controls">
      <div class="control-bar">
        <div class="control-left">
          <span class="live-state is-paused" id="q-live"><i></i>Paused</span>
          <span class="control-divider"></span>
          <span class="control-stat"><span>Session speed</span><span class="select-wrap"><select id="q-speed" class="select select--small">
            ${[['900', 'Slow'], ['650', 'Standard'], ['350', 'Fast'], ['180', 'Turbo']].map(([value, label]) => `<option value="${value}" ${Number(value) === speed ? 'selected' : ''}>${label}</option>`).join('')}
          </select></span></span>
          <span class="control-stat"><span>Cycle</span><b class="mono" id="q-tick-inline">${state.queue.sim.tick}</b></span>
        </div>
        <div class="control-actions">
          <button class="btn btn-ghost" type="button" id="q-step">${icon('arrowRight', 16)} Advance</button>
          <button class="btn btn-primary" type="button" id="q-run">${icon('play', 16)}<span>Run</span></button>
          <button class="btn btn-ghost btn-icon" type="button" id="q-reset" title="Reset queue" aria-label="Reset queue">${icon('rotate', 17)}</button>
        </div>
      </div>
      <div class="config-bar">
        <span class="config-label">Queue configuration</span>
        <label class="config-field"><span>Capacity</span><input class="input input--tiny" type="number" min="2" max="12" id="q-cap" value="${cfg.capacity}"></label>
        <label class="config-field"><span>Sources</span><input class="input input--tiny" type="number" min="1" max="4" id="q-prod" value="${cfg.producers}"></label>
        <label class="config-field"><span>Pods</span><input class="input input--tiny" type="number" min="1" max="4" id="q-cons" value="${cfg.consumers}"></label>
        <label class="config-field"><span>Ingest period</span><input class="input input--tiny" type="number" min="1" max="9" id="q-pp" value="${cfg.prodPeriod}"><em>cyc</em></label>
        <label class="config-field"><span>Drain period</span><input class="input input--tiny" type="number" min="1" max="9" id="q-cp" value="${cfg.consPeriod}"><em>cyc</em></label>
        <button class="btn btn-secondary btn-sm" type="button" id="q-apply">Apply</button>
      </div>
    </div>

    <div class="queue-grid">
      <article class="panel span-8 buffer-panel">
        ${cardHead('Buffer monitor', 'FIFO request slots', `<span class="badge badge--info mono" id="q-occupancy">0 / ${cfg.capacity}</span>`)}
        <div class="buffer-slots" id="q-buffer-slots"></div>
        <div class="sem-grid" id="q-sems"></div>
        <div class="chart-head"><span>Queue pressure</span><span class="mono" id="q-chart-meta"></span></div>
        <div class="chart-shell" id="q-chart"></div>
      </article>

      <aside class="panel nodes-panel">
        ${cardHead('Processing nodes', `${cfg.producers} sources · ${cfg.consumers} pods`, badge('Live', 'good', true))}
        <div class="actor-groups" id="q-actors"></div>
        <div class="mini-stat-grid" id="q-stats"></div>
      </aside>
    </div>

    <div class="queue-bottom">
      <article class="panel span-8">
        ${cardHead('Event stream', 'Latest queue activity', `<span class="event-count mono" id="q-event-count">0 events</span>`)}
        <div class="event-log" id="q-log"></div>
      </article>
      <aside class="panel span-4">
        ${cardHead('Integrity', 'Continuous validation', `<span id="q-integrity-badge"></span>`)}
        <div class="integrity-list" id="q-integrity"></div>
      </aside>
    </div>`;

    const step = () => {
      if (qRunning) stopQueueTimer();
      A.pc.step(state.queue.sim);
      drawQueueLive();
    };
    root.querySelector('#q-step').addEventListener('click', step);
    root.querySelector('#q-run').addEventListener('click', () => {
      if (qRunning) { stopQueueTimer(); syncQueueRunUI(); }
      else startQueueTimer();
    });
    root.querySelector('#q-reset').addEventListener('click', () => {
      stopQueueTimer();
      state.queue.sim = A.pc.create(state.queueCfg);
      drawQueueLive();
      NB.toast({ title: 'Queue cleared', message: 'Session reset to cycle zero.', tone: 'neutral' });
    });
    root.querySelector('#q-speed').addEventListener('change', event => {
      state.speed = U.int(event.target.value, 650, 150, 2000);
      Store.scheduleSave();
      if (qRunning) {
        clearInterval(qTimer);
        qTimer = setInterval(() => {
          if (!document.getElementById('q-buffer-slots')) { stopQueueTimer(); return; }
          A.pc.step(state.queue.sim);
          drawQueueLive();
        }, state.speed);
      }
    });
    root.querySelector('#q-apply').addEventListener('click', () => {
      stopQueueTimer();
      state.queueCfg = {
        capacity: U.int(root.querySelector('#q-cap').value, 6, 2, 12),
        producers: U.int(root.querySelector('#q-prod').value, 2, 1, 4),
        consumers: U.int(root.querySelector('#q-cons').value, 2, 1, 4),
        prodPeriod: U.int(root.querySelector('#q-pp').value, 2, 1, 9),
        consPeriod: U.int(root.querySelector('#q-cp').value, 3, 1, 9)
      };
      state.queue.sim = A.pc.create(state.queueCfg);
      Store.addActivity('queue', 'Queue configuration applied', `${state.queueCfg.capacity} slots · ${state.queueCfg.producers} sources · ${state.queueCfg.consumers} pods`);
      Store.save();
      views.queue(root);
      NB.toast({ title: 'Queue reconfigured', message: 'The request stream has been reset with the new capacity.', tone: 'good' });
    });

    drawQueueLive();
  };

  function drawQueueLive() {
    const state = Store.state;
    const s = state.queue.sim;
    const cap = s.capacity || 1;
    const occupancy = s.buffer.length;

    const tickEls = ['q-tick', 'q-tick-inline'].map(id => document.getElementById(id)).filter(Boolean);
    tickEls.forEach(el => { el.textContent = s.tick; });

    const occupancyEl = document.getElementById('q-occupancy');
    if (occupancyEl) {
      occupancyEl.textContent = `${occupancy} / ${cap}`;
      occupancyEl.className = 'badge mono ' + (occupancy >= cap ? 'badge--warn' : 'badge--info');
    }

    const slots = document.getElementById('q-buffer-slots');
    if (slots) {
      slots.innerHTML = Array.from({ length: cap }, (_, i) => {
        const item = s.buffer[i];
        return `<div class="buffer-slot ${item ? 'is-filled' : ''}" ${item ? `style="--slot:${U.colorFor(item)}"` : ''}>
          <span class="slot-index">${String(i + 1).padStart(2, '0')}</span>
          <b>${item ? U.esc(item) : '—'}</b>
          <span class="slot-state">${item ? 'queued' : 'open'}</span>
        </div>`;
      }).join('');
    }

    const sems = document.getElementById('q-sems');
    if (sems) {
      const lockFree = s.mutex === 1;
      sems.innerHTML = [
        { label: 'EMPTY', value: s.empty, sub: 'available slots', ratio: s.empty / cap, tone: 'sky' },
        { label: 'FULL', value: s.full, sub: 'queued items', ratio: s.full / cap, tone: 'emerald' },
        { label: 'MUTEX', value: lockFree ? 'FREE' : 'LOCKED', sub: lockFree ? 'critical section open' : 'critical section held', ratio: lockFree ? 1 : 0, tone: 'amber' }
      ].map(sem => `<div class="sem-card">
        <div class="sem-top"><span>${sem.label}</span><span class="sem-value mono">${sem.value}</span></div>
        <div class="progress progress--${sem.tone}"><i style="width:${Math.max(0, Math.min(100, sem.ratio * 100)).toFixed(0)}%"></i></div>
        <span class="sem-sub">${sem.sub}</span>
      </div>`).join('');
    }

    const chart = document.getElementById('q-chart');
    if (chart) chart.innerHTML = NB.charts.areaChart(s.history, cap, '#38BDF8');
    const chartMeta = document.getElementById('q-chart-meta');
    if (chartMeta) chartMeta.textContent = `peak ${s.maxOcc}/${cap} · cycle ${s.tick}`;

    const actors = document.getElementById('q-actors');
    if (actors) {
      const producers = s.actors.filter(actor => actor.type === 'producer');
      const consumers = s.actors.filter(actor => actor.type === 'consumer');
      const group = (label, list, type) => `<div class="actor-group">
        <div class="actor-group-head"><span>${label}</span><span>${list.length}</span></div>
        ${list.map(actor => {
          const number = actor.id.slice(1).padStart(2, '0');
          const until = actor.period - (s.tick % actor.period);
          const next = until === 0 ? actor.period : until;
          const tone = actor.state === 'active' ? 'good' : actor.state === 'blocked' ? 'bad' : 'neutral';
          return `<div class="actor-row is-${actor.state}">
            <span class="actor-icon tone-${type === 'producer' ? 'sky' : 'violet'}">${icon(type === 'producer' ? 'terminal' : 'server', 17)}</span>
            <div class="actor-copy">
              <div><b>${type === 'producer' ? 'Source' : 'Pod'} ${number}</b>${badge(actor.state, tone, true)}</div>
              <span>every ${actor.period} cyc · ${actor.served} ${type === 'producer' ? 'queued' : 'settled'}${actor.blocked ? ' · ' + actor.blocked + ' holds' : ''}</span>
            </div>
            <span class="actor-due">${actor.state === 'blocked' ? icon('lock', 14) : `<b>${next}</b><small>cyc</small>`}</span>
          </div>`;
        }).join('')}
      </div>`;
      actors.innerHTML = group('INGRESS SOURCES', producers, 'producer') + group('PROCESSING PODS', consumers, 'consumer');
    }

    const stats = document.getElementById('q-stats');
    if (stats) {
      stats.innerHTML = [
        ['Produced', s.produced],
        ['Settled', s.consumed],
        ['Peak', `${s.maxOcc}/${cap}`],
        ['Holds', s.prodBlocked + s.consBlocked]
      ].map(([label, value]) => `<div class="mini-stat"><b class="mono">${value}</b><span>${label}</span></div>`).join('');
    }

    const log = document.getElementById('q-log');
    if (log) {
      const entries = s.log.slice(-80);
      log.innerHTML = entries.length
        ? entries.map(entry => `<div class="log-row log-row--${entry.kind}">
            <span class="log-tick mono">t${entry.tick}</span>
            <span class="log-dot"></span>
            <span class="log-text">${U.esc(entry.text)}</span>
          </div>`).join('')
        : `<div class="event-empty">${icon('activity', 18)}<span>Awaiting the next queue cycle.</span></div>`;
      log.scrollTop = log.scrollHeight;
    }
    const eventCount = document.getElementById('q-event-count');
    if (eventCount) eventCount.textContent = `${s.log.length} events`;

    const integrity = document.getElementById('q-integrity');
    if (integrity) {
      const checks = [
        { ok: s.buffer.length <= cap, label: 'Buffer bound', value: `${s.buffer.length} / ${cap}` },
        { ok: s.empty + s.full === cap, label: 'Counter balance', value: `${s.empty} + ${s.full} = ${cap}` },
        { ok: s.mutex === 1, label: 'Critical section', value: s.mutex === 1 ? 'open' : 'held' },
        { ok: s.produced - s.consumed === s.buffer.length, label: 'Item conservation', value: `${s.produced - s.consumed} in buffer` }
      ];
      const allGood = checks.every(c => c.ok);
      integrity.innerHTML = checks.map(check => `<div class="integrity-row ${check.ok ? 'is-ok' : 'is-bad'}">
        <span class="integrity-icon">${icon(check.ok ? 'check' : 'x', 14)}</span>
        <div><b>${check.label}</b><span>${check.value}</span></div>
      </div>`).join('');
      const integrityBadge = document.getElementById('q-integrity-badge');
      if (integrityBadge) integrityBadge.innerHTML = badge(allGood ? 'Verified' : 'Alert', allGood ? 'good' : 'bad', true);
    }

    const navQueue = document.getElementById('nav-queue');
    if (navQueue) navQueue.textContent = s.buffer.length;
    syncQueueRunUI();
  }

  /* ------------------------------------------------------------------ resource guard */

  views.resources = function (root) {
    const state = Store.state;
    const a = NB.analysis();
    const tone = a.effectiveSafe ? 'is-safe' : 'is-risk';
    const stateLabel = a.invalidBanker ? 'INVALID' : a.effectiveSafe ? 'SAFE' : 'UNSAFE';
    const summary = resourceSummary(a);
    const reqTransaction = a.txns[state.banker.req.pid] || a.txns[0];

    root.innerHTML = `${pageHead(
      'Control planes / Allocation',
      'Resource guard',
      'Banker\'s safety across database connections, service threads, and ledger locks.',
      `${headChip(`<span class="status-dot status-dot--${a.effectiveSafe ? 'ok' : 'risk'}"></span>${a.effectiveSafe ? 'Allocation verified' : 'Review required'}`)}${headChip(`${icon('shield', 14)} ${a.bk.sequence.length}/${a.txns.length} recoverable`)}`
    )}

    <div class="guard-hero ${tone}" id="guard-hero">
      <div class="guard-left">
        <span class="guard-icon" id="guard-icon">${icon(a.effectiveSafe ? 'shield' : 'alert', 28)}</span>
        <div class="guard-copy">
          <span class="eyebrow">Safety state</span>
          <h2 id="guard-state">${stateLabel}</h2>
          <p id="guard-summary">${U.esc(summary)}</p>
          <span class="guard-meta" id="guard-meta">Updated ${U.timestamp()}</span>
        </div>
      </div>
      <div class="guard-right">
        <div class="guard-path-head"><span class="mini-label">Recovery path</span>${badge(a.effectiveSafe ? 'Complete' : 'Incomplete', a.effectiveSafe ? 'good' : 'bad', true)}</div>
        <div class="seq-chips" id="guard-sequence">${sequenceChips(a.bk, a.txns)}</div>
        <div class="guard-actions">
          <button class="btn btn-ghost btn-sm" type="button" id="guard-verify">${icon('refresh', 15)} Re-verify</button>
          <button class="btn btn-ghost btn-sm" type="button" id="guard-restore">${icon('rotate', 15)} Restore baseline</button>
        </div>
      </div>
    </div>

    <div class="resource-kpi-grid" id="resource-cards">${resourceCardsHTML(a)}</div>

    <div class="guard-grid">
      <article class="panel span-8">
        ${cardHead('Allocation matrix', 'Editable claim ledger', `<span class="table-hint">Scroll matrix ${icon('arrowRight', 11)}</span>${badge(a.txns.length + ' × 3', 'neutral')}<button class="btn btn-ghost btn-xs" type="button" id="guard-restore-2">${icon('rotate', 14)} Baseline</button>`)}
        <div class="table-wrap">
          <table class="data-table matrix-table">
            <thead>
              <tr class="group-row"><th rowspan="2" class="left">Transaction</th><th colspan="3">Allocated</th><th colspan="3">Claimed</th><th colspan="3">Required</th></tr>
              <tr>${RESOURCE_META.map(r => `<th title="${r.name}">${r.code}</th>`).join('')}${RESOURCE_META.map(r => `<th title="${r.name}">${r.code}</th>`).join('')}${RESOURCE_META.map(r => `<th title="${r.name}">${r.code}</th>`).join('')}</tr>
            </thead>
            <tbody>
              ${a.txns.map((t, i) => `<tr>
                <td class="txn-matrix-cell"><span class="ref-chip" style="--tx:${U.colorFor(t.id)}">${t.id}</span><span>${U.esc(t.channel)}</span></td>
                ${state.banker.alloc[i].map((v, j) => `<td class="matrix-cell"><input class="matrix-input" type="number" min="0" max="999" data-matrix="alloc" data-i="${i}" data-j="${j}" value="${v}" aria-label="${t.id} allocation ${RESOURCE_META[j].code}"></td>`).join('')}
                ${state.banker.max[i].map((v, j) => `<td class="matrix-cell"><input class="matrix-input" type="number" min="0" max="999" data-matrix="max" data-i="${i}" data-j="${j}" value="${v}" aria-label="${t.id} claim ${RESOURCE_META[j].code}"></td>`).join('')}
                ${a.bk.need[i].map((v, j) => `<td class="matrix-cell need-cell ${v < 0 ? 'is-bad' : ''}" id="need-${i}-${j}">${v}</td>`).join('')}
              </tr>`).join('')}
            </tbody>
          </table>
        </div>
        <p class="inline-warning" id="matrix-warning" ${a.invalidBanker ? '' : 'hidden'}>Allocated resources exceed the declared claim on one or more records.</p>
      </article>

      <div class="stack span-4">
        <article class="panel">
          ${cardHead('Available pool', 'Unallocated capacity', badge('Live', 'good', true))}
          <div class="available-list">
            ${RESOURCE_META.map((meta, j) => `<div class="available-row">
              <span class="res-code tone-${meta.tone}">${meta.code}</span>
              <div class="available-copy"><b>${meta.name}</b><span>of ${a.resourceTotals[j]} total</span></div>
              <input class="matrix-input available-input" type="number" min="0" max="999" data-avail="${j}" value="${state.banker.avail[j]}" aria-label="Available ${meta.name}">
            </div>`).join('')}
          </div>
        </article>

        <article class="panel request-panel">
          ${cardHead('Request console', 'Evaluate a resource claim', badge('Simulation', 'info'))}
          <label class="field"><span>Transaction</span><span class="select-wrap"><select id="req-pid" class="select">${a.txns.map((t, i) => `<option value="${i}" ${i === state.banker.req.pid ? 'selected' : ''}>${t.id} · ${U.esc(t.name)}</option>`).join('')}</select></span></label>
          <div class="req-grid">
            ${RESOURCE_META.map((meta, j) => `<label class="field"><span>${meta.code}</span><input class="input" type="number" min="0" max="999" id="req-${j}" value="${state.banker.req.vec[j]}" aria-label="Request ${meta.name}"></label>`).join('')}
          </div>
          <button class="btn btn-primary btn-block" type="button" id="req-eval">${icon('scan', 16)} Evaluate request</button>
          <div id="req-result">${requestEmptyState()}</div>
        </article>
      </div>
    </div>`;

    const refresh = (clearRequest) => {
      const fresh = NB.analysis();
      const hero = root.querySelector('#guard-hero');
      if (hero) {
        hero.classList.toggle('is-safe', fresh.effectiveSafe);
        hero.classList.toggle('is-risk', !fresh.effectiveSafe);
      }
      const guardIcon = root.querySelector('#guard-icon');
      if (guardIcon) guardIcon.innerHTML = icon(fresh.effectiveSafe ? 'shield' : 'alert', 28);
      const guardState = root.querySelector('#guard-state');
      if (guardState) guardState.textContent = fresh.invalidBanker ? 'INVALID' : fresh.effectiveSafe ? 'SAFE' : 'UNSAFE';
      const guardSummary = root.querySelector('#guard-summary');
      if (guardSummary) guardSummary.textContent = resourceSummary(fresh);
      const guardMeta = root.querySelector('#guard-meta');
      if (guardMeta) guardMeta.textContent = `Updated ${U.timestamp()}`;
      const guardSequence = root.querySelector('#guard-sequence');
      if (guardSequence) guardSequence.innerHTML = sequenceChips(fresh.bk, fresh.txns);
      const cards = root.querySelector('#resource-cards');
      if (cards) cards.innerHTML = resourceCardsHTML(fresh);
      fresh.txns.forEach((t, i) => {
        for (let j = 0; j < 3; j++) {
          const cell = root.querySelector(`#need-${i}-${j}`);
          if (cell) {
            const value = fresh.bk.need[i] ? fresh.bk.need[i][j] : 0;
            cell.textContent = value;
            cell.classList.toggle('is-bad', value < 0);
          }
        }
      });
      const warning = root.querySelector('#matrix-warning');
      if (warning) warning.hidden = !fresh.invalidBanker;
      const pathBadge = root.querySelector('.guard-path-head .badge');
      if (pathBadge) pathBadge.outerHTML = badge(fresh.effectiveSafe ? 'Complete' : 'Incomplete', fresh.effectiveSafe ? 'good' : 'bad', true);
      NB.updateSidebar(fresh);
      if (clearRequest) {
        state.banker.result = null;
        const resultEl = root.querySelector('#req-result');
        if (resultEl) resultEl.innerHTML = requestEmptyState();
      }
    };

    root.oninput = event => {
      const matrixInput = event.target.closest('[data-matrix]');
      const availInput = event.target.closest('[data-avail]');
      if (matrixInput) {
        const i = Number(matrixInput.dataset.i);
        const j = Number(matrixInput.dataset.j);
        const value = U.int(matrixInput.value, 0, 0);
        state.banker[matrixInput.dataset.matrix][i][j] = value;
        Store.scheduleSave();
        refresh(true);
      } else if (availInput) {
        const j = Number(availInput.dataset.avail);
        state.banker.avail[j] = U.int(availInput.value, 0, 0);
        Store.scheduleSave();
        refresh(true);
      }
    };

    const reqPid = root.querySelector('#req-pid');
    reqPid.addEventListener('change', () => {
      state.banker.req.pid = Number(reqPid.value);
      state.banker.result = null;
      root.querySelector('#req-result').innerHTML = requestEmptyState();
    });

    RESOURCE_META.forEach((meta, j) => {
      const input = root.querySelector('#req-' + j);
      if (input) input.addEventListener('input', () => {
        state.banker.req.vec[j] = U.int(input.value, 0, 0);
        state.banker.result = null;
        root.querySelector('#req-result').innerHTML = requestEmptyState();
      });
    });

    root.querySelector('#req-eval').addEventListener('click', () => {
      const fresh = NB.analysis();
      state.banker.req.pid = Number(reqPid.value);
      state.banker.req.vec = RESOURCE_META.map((_, j) => U.int(root.querySelector('#req-' + j).value, 0, 0));
      if (fresh.invalidBanker) {
        root.querySelector('#req-result').innerHTML = `<div class="request-result is-denied">
          <div class="request-result-head"><span>${icon('alert', 18)}</span><div><b>Evaluation blocked</b><span>Resolve the allocation ledger first.</span></div></div>
        </div>`;
        return;
      }
      const result = A.bankers.request(state.banker.alloc, state.banker.max, state.banker.avail, state.banker.req.pid, state.banker.req.vec);
      state.banker.result = result;
      renderRequestResult(root, result);
    });

    const restore = () => {
      Store.baselineBanker();
      Store.save();
      Store.addActivity('guard', 'Allocation baseline restored', 'Ledger reset to the reference matrix');
      views.resources(root);
      NB.toast({ title: 'Baseline restored', message: 'Allocation, claim, and availability values were reset.', tone: 'good' });
    };
    ['#guard-restore', '#guard-restore-2'].forEach(selector => {
      const button = root.querySelector(selector);
      if (button) button.addEventListener('click', restore);
    });

    root.querySelector('#guard-verify').addEventListener('click', () => {
      const fresh = NB.analysis();
      Store.addActivity('guard', fresh.effectiveSafe ? 'Safety state verified' : 'Safety review required', fresh.effectiveSafe ? `${fresh.bk.sequence.length}-step recovery path available` : 'Allocation state is not recoverable');
      const guardMeta = root.querySelector('#guard-meta');
      if (guardMeta) guardMeta.textContent = `Verified ${U.timestamp()}`;
      refresh(false);
      NB.toast({
        title: fresh.effectiveSafe ? 'Verification passed' : 'Verification failed',
        message: fresh.effectiveSafe ? 'The current allocation state is safe.' : 'The current allocation state cannot be recovered.',
        tone: fresh.effectiveSafe ? 'good' : 'bad'
      });
    });

    if (reqTransaction) refresh(false);
  };

  function resourceSummary(a) {
    if (a.invalidBanker) return 'Allocation exceeds a declared claim.';
    if (a.effectiveSafe) return `${a.bk.sequence.length}/${a.txns.length} transactions in a complete recovery path.`;
    return `${a.txns.length - a.bk.sequence.length} transactions blocked · new admissions paused.`;
  }

  function resourceCardsHTML(a) {
    const state = Store.state;
    return RESOURCE_META.map((meta, j) => {
      const used = a.resourceUsed[j];
      const total = a.resourceTotals[j] || 0;
      const available = state.banker.avail[j];
      const ratio = total ? used / total : 0;
      return `<article class="resource-card tone-${meta.tone}">
        <div class="res-head"><span class="res-icon">${icon(meta.icon, 18)}</span><span class="res-name">${meta.name}</span><span class="res-code tone-${meta.tone}">${meta.code}</span></div>
        <div class="res-value"><b class="mono">${used}</b><span>of ${total}</span></div>
        ${progress(ratio, meta.tone)}
        <div class="res-foot"><span>${available} available</span><span>${U.pct(ratio)} utilized</span></div>
      </article>`;
    }).join('');
  }

  function requestEmptyState() {
    return `<div class="request-empty">${icon('scan', 19)}<span>No request evaluated</span></div>`;
  }

  function renderRequestResult(root, result) {
    const state = Store.state;
    const txn = state.txns[state.banker.req.pid] || state.txns[0];
    const sequence = result.check ? sequenceChips(result.check, state.txns) : '<span class="empty-inline">No safe path</span>';
    root.querySelector('#req-result').innerHTML = `<div class="request-result ${result.granted ? 'is-approved' : 'is-denied'}">
      <div class="request-result-head">
        <span class="request-result-icon">${icon(result.granted ? 'checkCircle' : 'xCircle', 19)}</span>
        <div><b>${result.granted ? 'Approved' : 'Denied'}</b><span>${U.esc(result.reason)}</span></div>
      </div>
      <div class="request-result-seq"><span class="mini-label">Resulting path</span><div class="seq-chips">${sequence}</div></div>
      ${result.granted ? `<button class="btn btn-primary btn-block" type="button" id="req-apply">${icon('shield', 16)} Authorize allocation</button>` : ''}
    </div>`;

    const apply = root.querySelector('#req-apply');
    if (apply) {
      apply.addEventListener('click', () => {
        state.banker.alloc = result.newAlloc;
        state.banker.avail = result.newAvail;
        state.banker.result = null;
        Store.addActivity('guard', 'Allocation authorized', `${txn.id} · ${U.vec(state.banker.req.vec)} · ${RESOURCE_META.map(m => m.code).join(' / ')}`);
        Store.save();
        views.resources(root);
        NB.toast({ title: 'Allocation authorized', message: `${txn.id} received ${U.vec(state.banker.req.vec)}.`, tone: 'good' });
      });
    }
  }

  /* ------------------------------------------------------------------ memory manager */

  let memorySelection = null;

  views.memory = function (root) {
    const state = Store.state;
    const a = NB.analysis();
    const mem = a.mem;
    const modeLabel = state.memory.mode === 'fixed' ? 'Fixed partitions' : 'Dynamic partitions';
    const placed = mem.placements.filter(p => p.ok).length;
    const strategyCards = a.memAll.map(result => strategyCardHTML(result, a)).join('');
    const txnMap = {};
    a.txns.forEach(txn => { txnMap[txn.id] = txn; });

    if (!memorySelection || !txnMap[memorySelection]) {
      const first = mem.placements.find(p => p.ok) || mem.placements[0];
      memorySelection = first ? first.pid : null;
    }
    const focusPlacement = mem.placements.find(p => p.pid === memorySelection) || mem.placements[0] || null;
    const focusPid = focusPlacement ? focusPlacement.pid : null;
    if (focusPid) memorySelection = focusPid;

    const modeNote = state.memory.mode === 'fixed'
      ? `<b>Fixed partitions</b> keep unused bytes inside each block as internal slack. <span>${U.num(mem.internal)} KB is reserved and cannot serve another request.</span>`
      : `<b>Dynamic partitions</b> cut each block to the request size and return the remainder as free space. <span>${U.num(mem.totalFree)} KB is free across ${mem.holes} segment${mem.holes === 1 ? '' : 's'}.</span>`;

    const kpis = [
      {
        icon: 'chip', tone: 'violet', label: 'Memory in use',
        value: `${U.num(mem.usedMem)}<span class="kpi-unit">KB</span>`,
        foot: `${U.pct(mem.utilization)} of ${U.num(mem.total)} KB · ${modeLabel.toLowerCase()}`,
        badge: badge(mem.unallocated.length ? 'Constrained' : 'Mapped', mem.unallocated.length ? 'warn' : 'good', true)
      },
      {
        icon: 'layers', tone: 'amber', label: 'Internal slack',
        value: `${U.num(mem.internal)}<span class="kpi-unit">KB</span>`,
        foot: state.memory.mode === 'fixed' ? 'Unused capacity inside allocated blocks' : 'Dynamic blocks have no internal slack',
        badge: badge(state.memory.mode === 'fixed' ? 'Reserved' : 'None', 'neutral')
      },
      {
        icon: 'scan', tone: 'sky', label: 'Free capacity',
        value: `${U.num(mem.totalFree)}<span class="kpi-unit">KB</span>`,
        foot: mem.totalFree ? `${mem.holes} free segment${mem.holes === 1 ? '' : 's'} · largest ${U.num(mem.largestHole)} KB` : 'No free segments in the current map',
        badge: badge(mem.externalFrag ? 'Fragmented' : 'Available', mem.externalFrag ? 'warn' : 'good', true)
      },
      {
        icon: 'checkCircle', tone: 'emerald', label: 'Mapped records',
        value: `${placed}<span class="kpi-unit">/ ${a.txns.length}</span>`,
        foot: mem.unallocated.length ? `${mem.unallocated.join(', ')} awaiting memory` : 'All records mapped to physical memory',
        badge: badge(mem.unallocated.length ? mem.unallocated.length + ' pending' : 'Complete', mem.unallocated.length ? 'warn' : 'good', true)
      }
    ];

    root.innerHTML = `${pageHead(
      'Control planes / Memory',
      'Memory manager',
      `${modeLabel} · <span class="mono">${state.memory.blocks.length}</span> partitions · <span class="mono">${U.num(mem.total)}</span> KB address space.`,
      `${headChip(`${icon('chip', 14)} ${strategyLabel(state.memory.strategy)}`)}${headChip(`${icon('layers', 14)} ${placed}/${a.txns.length} mapped`)}`
    )}

    <div class="panel memory-config">
      <label class="field field--wide"><span>Partition map <em>KB</em></span><input class="input" id="mem-blocks" value="${state.memory.blocks.join(', ')}" aria-label="Partition sizes in kilobytes"></label>
      <button class="btn btn-secondary" type="button" id="mem-apply">${icon('check', 15)} Apply map</button>
      <div class="segmented" role="group" aria-label="Partition mode">
        <button class="segment ${state.memory.mode === 'fixed' ? 'is-active' : ''}" type="button" data-mode="fixed">Fixed</button>
        <button class="segment ${state.memory.mode === 'dynamic' ? 'is-active' : ''}" type="button" data-mode="dynamic">Dynamic</button>
      </div>
      <span class="config-meta">${state.memory.blocks.length} partitions · ${U.num(mem.total)} KB</span>
      <div class="memory-mode-note">${icon('info', 14)}<p>${modeNote}</p></div>
    </div>

    <div class="kpi-grid">
      ${kpis.map(kpi => `<article class="kpi-card">
        <div class="kpi-head"><span class="kpi-icon tone-${kpi.tone}">${icon(kpi.icon)}</span><span class="kpi-label">${kpi.label}</span>${kpi.badge}</div>
        <div class="kpi-value">${kpi.value}</div>
        <div class="kpi-foot"><span>${kpi.foot}</span></div>
      </article>`).join('')}
    </div>

    <div class="strategy-grid">${strategyCards}</div>

    <div class="memory-grid">
      <article class="panel span-8 memory-map-panel">
        ${cardHead('Memory map', `${strategyLabel(state.memory.strategy)} · ${modeLabel} · addresses in KB`, badge(`${placed}/${a.txns.length} mapped`, placed === a.txns.length ? 'good' : 'warn', true))}
        ${memoryAxisHTML(mem)}
        ${memoryRackHTML(mem, focusPid)}
        <div class="memory-legend"><span><i class="legend-used"></i>Request bytes</span><span><i class="legend-slack"></i>Internal slack</span><span><i class="legend-free"></i>Free block</span></div>
        <div class="mem-block-grid">${mem.segs.map(seg => memoryBlockHTML(seg, focusPid, txnMap, state.memory.mode)).join('')}</div>
        <div class="memory-map-foot">
          <span>${icon('info', 12)} Select a block or transaction to inspect it.</span>
          <span class="mono">${U.num(mem.usedMem)}K used · ${U.num(mem.internal)}K slack · ${U.num(mem.totalFree)}K free</span>
        </div>
      </article>

      <aside class="panel span-4 memory-inspector-panel">
        ${cardHead('Allocation inspector', 'Physical placement for the selected transaction', badge(mem.externalFrag ? 'Fragmentation' : 'Contiguous', mem.externalFrag ? 'warn' : 'good'))}
        <div class="mem-tabs" role="group" aria-label="Inspect transaction">
          ${a.txns.map(txn => {
            const p = mem.placements.find(item => item.pid === txn.id);
            return `<button class="mem-tab ${focusPid === txn.id ? 'is-active' : ''} ${p && p.ok ? '' : 'is-waiting'}" type="button" data-mem-focus="${txn.id}" aria-pressed="${focusPid === txn.id}" style="--mem:${U.colorFor(txn.id)}">
              <i></i><b>${txn.id}</b><span>${U.num(txn.size)}K</span>
            </button>`;
          }).join('')}
        </div>
        <div class="mem-inspect-stack">
          ${a.txns.map(txn => memoryInspectorHTML(mem, mem.placements.find(item => item.pid === txn.id), txn, focusPid, state.memory.strategy, state.memory.mode)).join('')}
        </div>
      </aside>
    </div>

    <article class="panel memory-trace-panel">
      ${cardHead('Allocation decisions', `${strategyLabel(state.memory.strategy)} evaluates free blocks in intake order`, `${badge(memoryRule(state.memory.strategy), 'neutral')}${badge(mem.unallocated.length ? `${mem.unallocated.length} waiting` : 'All placed', mem.unallocated.length ? 'warn' : 'good', true)}`)}
      <div class="trace-list">${mem.placements.map((p, index) => memoryTraceHTML(p, index, txnMap, state.memory.mode, state.memory.strategy)).join('')}</div>
    </article>`;

    root.querySelector('#mem-apply').addEventListener('click', () => {
      const raw = root.querySelector('#mem-blocks').value;
      const blocks = raw.split(/[ ,]+/).map(v => parseInt(v, 10)).filter(v => Number.isFinite(v) && v > 0);
      if (!blocks.length || blocks.length > 16) {
        NB.toast({ title: 'Invalid partition map', message: 'Enter 1–16 positive partition sizes in KB.', tone: 'bad' });
        return;
      }
      state.memory.blocks = blocks;
      Store.addActivity('memory', 'Address map updated', `${blocks.length} partitions · ${U.num(blocks.reduce((s, v) => s + v, 0))} KB`);
      Store.save();
      views.memory(root);
      NB.toast({ title: 'Partition map applied', message: `${blocks.length} partitions configured.`, tone: 'good' });
    });

    const blocksInput = root.querySelector('#mem-blocks');
    blocksInput.addEventListener('keydown', event => {
      if (event.key === 'Enter') root.querySelector('#mem-apply').click();
    });

    root.querySelectorAll('[data-mode]').forEach(button => {
      button.addEventListener('click', () => {
        state.memory.mode = button.dataset.mode;
        Store.save();
        views.memory(root);
      });
    });

    root.querySelectorAll('[data-strategy]').forEach(button => {
      button.addEventListener('click', () => {
        state.memory.strategy = button.dataset.strategy;
        Store.save();
        views.memory(root);
      });
    });

    root.querySelectorAll('[data-mem-focus]').forEach(button => {
      button.addEventListener('click', () => {
        const pid = button.dataset.memFocus;
        memorySelection = pid;
        root.querySelectorAll('[data-mem-focus]').forEach(target => {
          const active = target.dataset.memFocus === pid;
          target.classList.toggle('is-focused', active);
          target.setAttribute('aria-pressed', String(active));
        });
        root.querySelectorAll('.mem-tab').forEach(tab => {
          tab.classList.toggle('is-active', tab.dataset.memFocus === pid);
        });
        root.querySelectorAll('[data-mem-detail]').forEach(detail => {
          detail.hidden = detail.dataset.memDetail !== pid;
        });
      });
    });
  };

  function memoryRule(strategy) {
    return {
      first: 'First block that fits',
      best: 'Smallest block that fits',
      worst: 'Largest block that fits'
    }[strategy] || strategy;
  }

  function memoryBlockHTML(seg, focusPid, txnMap, mode) {
    const start = U.num(seg.start);
    const end = U.num(seg.start + seg.size);
    if (seg.pid === null) {
      return `<div class="mem-block-card is-free">
        <span class="mem-block-top"><b>${seg.label}</b><span>${U.num(seg.size)} KB</span></span>
        <span class="mem-block-range">${start}–${end} KB</span>
        <span class="mem-block-owner">Free block</span>
        <span class="mem-block-track"><i class="is-slack" style="width:100%"></i></span>
        <span class="mem-block-foot"><span>Available</span><span>${U.num(seg.size)} KB</span></span>
      </div>`;
    }

    const txn = txnMap[seg.pid] || { id: seg.pid, name: seg.pid };
    const slack = seg.size - seg.used;
    const color = U.colorFor(seg.pid);
    const selected = focusPid === seg.pid;
    return `<button class="mem-block-card ${selected ? 'is-focused' : ''}" type="button" data-mem-focus="${seg.pid}" aria-pressed="${selected}">
      <span class="mem-block-top"><b>${seg.label}</b><span>${U.num(seg.size)} KB</span></span>
      <span class="mem-block-range">${start}–${end} KB</span>
      <span class="mem-block-owner"><i style="--mem:${color}"></i>${seg.pid} · ${U.esc(txn.name)}</span>
      <span class="mem-block-track"><i style="width:${seg.size ? (seg.used / seg.size) * 100 : 0}%;background:${color}"></i>${slack ? `<i class="is-slack" style="width:${(slack / seg.size) * 100}%"></i>` : ''}</span>
      <span class="mem-block-foot"><span>${U.num(seg.used)} KB used</span><span>${slack ? `${U.num(slack)} KB slack` : mode === 'dynamic' ? 'Split · no slack' : 'No slack'}</span></span>
    </button>`;
  }

  function memoryAxisHTML(mem) {
    return `<div class="mem-axis" aria-hidden="true">
      ${mem.segs.map(seg => `<span style="flex:${seg.size}"><b>${U.num(seg.start)}</b></span>`).join('')}
      <span class="mem-axis-end"><b>${U.num(mem.total)} KB</b></span>
    </div>`;
  }

  function memoryInspectorHTML(mem, p, txn, focusPid, strategy, mode) {
    if (!p) return '';
    const active = focusPid === p.pid;
    const color = U.colorFor(p.pid);
    const requestRange = p.ok ? `${U.num(p.start)} → ${U.num(p.start + p.size)} KB` : 'Unmapped';
    const blockRange = p.ok ? `${U.num(p.start)} → ${U.num(p.start + p.blockSize)} KB` : '—';
    const usage = p.ok && p.blockSize ? p.size / p.blockSize : 0;
    const ruleFragment = {
      first: 'the first free block that can hold the request',
      best: 'the smallest free block that can hold the request',
      worst: 'the largest free block available'
    }[strategy] || 'a suitable free block';
    const remainder = p.candidates && p.candidates.find(c => c.label === p.block)
      ? p.candidates.find(c => c.label === p.block).size - p.size
      : p.blockSize - p.size;
    const rule = p.ok
      ? mode === 'dynamic'
        ? `${strategyLabel(strategy)} selected ${p.block} as ${ruleFragment}. The block splits into ${U.num(p.size)} KB allocated${remainder ? ` and ${U.num(remainder)} KB free` : ' with no free remainder'}.`
        : `${strategyLabel(strategy)} selected ${p.block} as ${ruleFragment}. The unused ${U.num(p.waste)} KB stays inside the block as internal slack.`
      : `No free block can hold ${U.num(p.size)} KB. The largest free segment is ${U.num(mem.largestHole)} KB; total free capacity is ${U.num(mem.totalFree)} KB.`;

    return `<div class="mem-inspect" data-mem-detail="${p.pid}" ${active ? '' : 'hidden'}>
      <div class="mem-inspect-head">
        <span class="mem-inspect-mark" style="--mem:${color}"></span>
        <span class="mem-inspect-title"><b>${p.pid} · ${U.esc(txn ? txn.name : p.pid)}</b><small>${txn ? `${txn.channel} · priority ${txn.priority}` : 'Transaction record'}</small></span>
        ${badge(p.ok ? 'Mapped' : 'Awaiting memory', p.ok ? 'good' : 'warn', true)}
      </div>
      <div class="mem-inspect-metrics">
        <span><small>Request</small><b>${U.num(p.size)} KB</b></span>
        <span><small>Block size</small><b>${p.ok ? `${U.num(p.blockSize)} KB` : '—'}</b></span>
        <span><small>Internal slack</small><b>${p.ok ? `${U.num(p.waste)} KB` : '—'}</b></span>
        <span><small>Utilization</small><b>${p.ok ? U.pct(usage) : '—'}</b></span>
      </div>
      <div class="mem-address-pair">
        <span><small class="mini-label">Request range</small><b>${requestRange}</b></span>
        <span><small class="mini-label">Block range</small><b>${blockRange}</b></span>
      </div>
      <div class="mem-inspect-track" aria-hidden="true">
        <i style="width:${usage * 100}%;background:${color}"></i>
        <i class="is-slack" style="width:${Math.max(0, 100 - usage * 100)}%"></i>
      </div>
      <p class="mem-inspect-rule">${rule}</p>
    </div>`;
  }

  function memoryTraceHTML(p, index, txnMap, mode, strategy) {
    const txn = txnMap[p.pid] || { id: p.pid, name: p.pid };
    const color = U.colorFor(p.pid);
    const candidates = p.candidates || [];
    return `<div class="trace-row ${p.ok ? '' : 'is-waiting'}">
      <span class="trace-index">${String(index + 1).padStart(2, '0')}</span>
      <span class="trace-txn">
        <i style="--mem:${color}"></i>
        <span><b>${U.esc(txn.name)}</b><small>${p.pid} · ${U.num(p.size)} KB</small></span>
      </span>
      <span class="trace-scan">
        <span class="mini-label">Candidate blocks</span>
        <span class="trace-chips">${candidates.map(c => {
          const selected = p.block === c.label;
          const state = !c.free ? 'used' : c.fits ? 'fits' : 'small';
          const holder = c.holder ? ` · held by ${c.holder}` : '';
          return `<span class="trace-chip is-${state} ${selected ? 'is-selected' : ''}" title="${c.label} · ${c.size} KB${c.free ? (c.fits ? ' · fits' : ' · too small') : holder}"><b>${c.label}</b><span>${U.num(c.size)}K</span><i>${state === 'used' ? c.holder : state}</i></span>`;
        }).join('')}</span>
      </span>
      <span class="trace-out">
        ${p.ok
          ? `<b>${p.block} · ${U.num(p.start)}–${U.num(p.start + p.size)} KB</b><small>${p.waste ? `${U.num(p.waste)} KB internal slack` : mode === 'dynamic' ? 'Split · no internal slack' : 'Exact fit'}</small>`
          : `<b class="warn-text">No block large enough</b><small>${U.num(p.size)} KB request · largest free ${U.num(candidates.reduce((m, c) => c.free ? Math.max(m, c.size) : m, 0))} KB</small>`}
      </span>
    </div>`;
  }

  function strategyLabel(key) {
    return { first: 'First fit', best: 'Best fit', worst: 'Worst fit' }[key] || key;
  }

  function strategyCardHTML(result, a) {
    const selected = result.strategy === Store.state.memory.strategy;
    const placed = result.placements.filter(p => p.ok).length;
    const total = result.total || 1;
    const bar = result.segs.map(seg => {
      const width = (seg.size / total) * 100;
      if (seg.pid) return `<i class="strategy-seg is-used" style="width:${width.toFixed(2)}%;background:${U.colorFor(seg.pid)}"></i>`;
      return `<i class="strategy-seg is-free" style="width:${width.toFixed(2)}%"></i>`;
    }).join('');
    return `<button class="strategy-card ${selected ? 'is-active' : ''}" type="button" data-strategy="${result.strategy}" aria-pressed="${selected}">
      <span class="strategy-head"><span class="strategy-name">${strategyLabel(result.strategy)}${selected ? badge('Active', 'good', true) : `<span class="strategy-switch">Use ${icon('arrowRight', 13)}</span>`}</span></span>
      <span class="strategy-rule">${memoryRule(result.strategy)}</span>
      <span class="strategy-bar">${bar}</span>
      <span class="strategy-stats">
        <span><b>${placed}/${a.txns.length}</b><small>mapped</small></span>
        <span><b>${U.num(result.internal)}K</b><small>internal slack</small></span>
        <span><b>${U.num(result.totalFree)}K</b><small>free</small></span>
      </span>
      <span class="strategy-meta">${result.unallocated.length ? `<em>${result.unallocated.join(', ')} waiting</em>` : result.externalFrag ? '<em>External fragmentation</em>' : `${result.holes} free segment${result.holes === 1 ? '' : 's'}`}</span>
    </button>`;
  }

  function memoryRackHTML(mem, focusPid) {
    const total = mem.total || 1;
    return `<div class="memory-rack" role="group" aria-label="Memory address map">${mem.segs.map(seg => {
      const width = (seg.size / total) * 100;
      const narrow = width < 8;
      const tiny = width < 4.5;
      const end = seg.start + seg.size;
      if (seg.pid === null) {
        return `<div class="mem-rack-seg is-free ${narrow ? 'is-narrow' : ''} ${tiny ? 'is-tiny' : ''}" style="flex:${seg.size}" title="${seg.label} · ${seg.start}–${end} KB · free">
          <span class="mem-seg-head"><b>${seg.label}</b>${narrow ? '' : `<span>${seg.start}K</span>`}</span>
          <span class="mem-rack-body"><span class="mem-free-copy">${tiny ? '' : `<b>Free</b><span>${U.num(seg.size)}K</span>`}</span></span>
        </div>`;
      }
      const slack = seg.size - seg.used;
      const color = U.colorFor(seg.pid);
      const selected = focusPid === seg.pid;
      return `<button class="mem-rack-seg is-allocated ${narrow ? 'is-narrow' : ''} ${tiny ? 'is-tiny' : ''} ${selected ? 'is-focused' : ''}" type="button" data-mem-focus="${seg.pid}" aria-pressed="${selected}" style="flex:${seg.size};--mem:${color}" title="${seg.label} · ${seg.start}–${end} KB · ${seg.pid} · ${seg.used}K used${slack ? ' · ' + slack + 'K slack' : ''}">
        <span class="mem-seg-head"><b>${seg.label}</b>${narrow ? '' : `<span>${seg.start}K</span>`}</span>
        <span class="mem-rack-body">
          <span class="mem-used" style="flex:${seg.used}">
            <span class="mem-label">${seg.pid}</span>
            ${tiny ? '' : `<span class="mem-detail">${U.num(seg.used)}K</span>`}
          </span>
          ${slack ? `<span class="mem-slack" style="flex:${slack}">${width < 7 ? '' : `<span>${U.num(slack)}K<br>slack</span>`}</span>` : ''}
        </span>
      </button>`;
    }).join('')}</div>`;
  }

  NB.views = views;
  NB.stopQueueTimer = stopQueueTimer;
})();
