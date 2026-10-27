(function () {
  'use strict';
  window.NB = window.NB || {};
  const NB = window.NB;
  const Store = NB.Store;
  const U = NB.util;

  const ROUTES = {
    overview: { title: 'Command Center' },
    intake: { title: 'Transaction Intake' },
    scheduler: { title: 'CPU Scheduler' },
    queue: { title: 'Request Queue' },
    resources: { title: 'Resource Guard' },
    memory: { title: 'Memory Manager' }
  };

  let batchRunning = false;

  window.__MERIDIAN_ERRORS__ = [];

  function currentRoute() {
    const raw = location.hash.replace(/^#\/?/, '');
    return ROUTES[raw] ? raw : 'overview';
  }

  function closeMobileNav() {
    document.body.classList.remove('nav-open');
    const toggle = document.getElementById('menu-toggle');
    if (toggle) toggle.setAttribute('aria-expanded', 'false');
  }

  function openMobileNav() {
    document.body.classList.add('nav-open');
    const toggle = document.getElementById('menu-toggle');
    if (toggle) toggle.setAttribute('aria-expanded', 'true');
  }

  function updateNav(route) {
    document.querySelectorAll('.nav-item').forEach(link => {
      const active = link.dataset.route === route;
      link.classList.toggle('is-active', active);
      if (active) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
    const meta = ROUTES[route] || ROUTES.overview;
    const crumb = document.getElementById('crumb-current');
    if (crumb) crumb.textContent = meta.title;
    document.title = `${meta.title} · Meridian Core Ops`;
  }

  function renderRoute() {
    const route = currentRoute();
    const raw = location.hash.replace(/^#\/?/, '');
    if (!raw || !ROUTES[raw]) {
      history.replaceState(null, '', location.pathname + location.search + '#/' + route);
    }
    NB.stopQueueTimer();
    updateNav(route);
    const view = document.getElementById('view');
    if (!view) return;
    view.onchange = null;
    view.oninput = null;
    NB.views[route](view);
    NB.hydrateIcons(view);
    view.classList.remove('route-enter');
    void view.offsetWidth;
    view.classList.add('route-enter');
    setTimeout(() => view.classList.remove('route-enter'), 460);
    NB.updateSidebar(NB.analysis());
    closeMobileNav();
    window.scrollTo(0, 0);
  }

  function renderCurrent() {
    const view = document.getElementById('view');
    if (!view) return;
    NB.stopQueueTimer();
    view.onchange = null;
    view.oninput = null;
    NB.views[currentRoute()](view);
    NB.updateSidebar(NB.analysis());
  }

  function setSaveIndicator(label, tone) {
    const el = document.getElementById('save-indicator');
    if (!el) return;
    el.className = 'save-indicator' + (tone ? ' is-' + tone : '');
    el.innerHTML = `${NB.icon(tone === 'error' ? 'alert' : tone === 'saving' ? 'refresh' : 'cloud', 14)}${U.esc(label)}`;
  }

  function updateClock() {
    const el = document.getElementById('clock');
    if (!el) return;
    el.textContent = new Date().toLocaleTimeString([], { hour12: false });
  }

  function toast(options) {
    const stack = document.getElementById('toast-stack');
    if (!stack) return;
    const tone = options.tone || 'info';
    const iconName = tone === 'good' ? 'checkCircle' : tone === 'bad' ? 'xCircle' : tone === 'warn' ? 'alert' : 'info';
    const el = document.createElement('div');
    el.className = `toast toast--${tone}`;
    el.innerHTML = `
      <span class="toast-icon">${NB.icon(iconName, 19)}</span>
      <div class="toast-copy"><b>${U.esc(options.title || 'Update')}</b>${options.message ? `<span>${U.esc(options.message)}</span>` : ''}</div>
      <button class="toast-close" type="button" aria-label="Dismiss notification">${NB.icon('x', 14)}</button>`;
    stack.appendChild(el);
    requestAnimationFrame(() => el.classList.add('is-visible'));
    const dismiss = () => {
      el.classList.remove('is-visible');
      setTimeout(() => el.remove(), 220);
    };
    el.querySelector('.toast-close').addEventListener('click', dismiss);
    setTimeout(dismiss, options.duration || 4400);
  }
  NB.toast = toast;

  function executeBatch() {
    if (batchRunning) return;
    batchRunning = true;
    const button = document.getElementById('run-batch');
    const original = button ? button.innerHTML : '';
    if (button) {
      button.disabled = true;
      button.innerHTML = `<span class="button-spinner" aria-hidden="true"></span><span class="btn-label">Executing</span>`;
    }

    window.setTimeout(() => {
      const state = Store.state;
      state.batchSeq = state.batchSeq >= 99999 ? 1 : state.batchSeq + 1;
      state.batch.id = 'MRD-' + String(state.batchSeq).padStart(5, '0');
      state.batch.lastRun = Date.now();
      Store.resetRuntimeQueue(24);
      const a = NB.analysis();
      Store.addActivity('queue', 'Batch executed', `${a.queue.produced} requests · ${a.queue.consumed} settled · peak ${a.queue.maxOcc}/${a.queue.capacity}`);
      Store.addActivity('scheduler', 'Dispatch plan refreshed', `${a.admitted.length}/${a.txns.length} cleared · ${U.shortAlgo(state.scheduler.algo)} · ${U.fmt(a.dispatch.avgWT, 1)} ms average wait`);
      Store.addActivity('guard', a.effectiveSafe ? 'Safety path verified' : 'Batch held for review', a.effectiveSafe ? `${a.bk.sequence.length}-step recovery path` : 'Allocation state requires review');
      Store.save();
      renderCurrent();
      batchRunning = false;
      if (button) {
        button.disabled = false;
        button.innerHTML = original;
      }
      toast({
        title: 'Batch executed',
        message: `${state.batch.id} · ${a.queue.consumed} requests settled · ${a.effectiveSafe ? 'safe allocation state' : 'review required'}`,
        tone: a.effectiveSafe ? 'good' : 'warn',
        duration: 5200
      });
    }, 420);
  }

  function exportReport() {
    const state = Store.state;
    const a = NB.analysis();
    const report = {
      product: 'Meridian Core Ops',
      generatedAt: new Date().toISOString(),
      batch: {
        id: state.batch.id,
        lastRun: state.batch.lastRun ? new Date(state.batch.lastRun).toISOString() : null
      },
      workload: state.txns,
      scheduler: {
        policy: state.scheduler.algo,
        quantum: state.scheduler.quantum,
        metrics: {
          averageWait: a.cpu.avgWT,
          averageTurnaround: a.cpu.avgTAT,
          averageResponse: a.cpu.avgRT,
          utilization: a.cpu.utilization
        },
        rows: a.cpu.rows,
        timeline: a.cpu.timeline,
        benchmark: a.benchmark.map(item => ({
          policy: item.key,
          averageWait: item.result.avgWT,
          averageTurnaround: item.result.avgTAT,
          averageResponse: item.result.avgRT
        })),
        dispatchPlan: {
          admitted: a.admittedIds,
          averageWait: a.dispatch.avgWT,
          order: a.dispatch.order
        }
      },
      queue: {
        config: state.queueCfg,
        tick: a.queue.tick,
        buffer: a.queue.buffer,
        capacity: a.queue.capacity,
        counters: {
          produced: a.queue.produced,
          settled: a.queue.consumed,
          producerHolds: a.queue.prodBlocked,
          consumerHolds: a.queue.consBlocked,
          peakOccupancy: a.queue.maxOcc
        },
        integrity: window.OSAlgo.pc.invariant(a.queue),
        history: a.queue.history.slice(-120),
        events: a.queue.log.slice(-120)
      },
      resourceSafety: {
        resources: NB.RESOURCES.names,
        allocation: state.banker.alloc,
        claimed: state.banker.max,
        required: a.bk.need,
        available: state.banker.avail,
        totals: a.resourceTotals,
        safe: a.effectiveSafe,
        invalidLedger: a.invalidBanker,
        sequence: a.bk.sequence.map(index => state.txns[index].id)
      },
      memory: {
        mode: state.memory.mode,
        strategy: state.memory.strategy,
        partitions: state.memory.blocks,
        selected: {
          utilization: a.mem.utilization,
          used: a.mem.usedMem,
          internalSlack: a.mem.internal,
          free: a.mem.totalFree,
          largestFree: a.mem.largestHole,
          externalFragmentation: a.mem.externalFrag,
          unallocated: a.mem.unallocated,
          placements: a.mem.placements,
          segments: a.mem.segs
        },
        comparison: a.memAll.map(result => ({
          strategy: result.strategy,
          mapped: result.placements.filter(p => p.ok).length,
          internalSlack: result.internal,
          free: result.totalFree,
          largestFree: result.largestHole,
          externalFragmentation: result.externalFrag,
          unallocated: result.unallocated
        }))
      }
    };

    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `meridian-${state.batch.id}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    Store.addActivity('system', 'Batch report exported', `${state.batch.id} · JSON archive`);
    toast({ title: 'Report exported', message: `${state.batch.id} batch archive downloaded.`, tone: 'good' });
  }

  function attachShell() {
    document.getElementById('run-batch').addEventListener('click', executeBatch);
    document.getElementById('export-btn').addEventListener('click', exportReport);

    const menuToggle = document.getElementById('menu-toggle');
    if (menuToggle) {
      menuToggle.addEventListener('click', () => {
        if (document.body.classList.contains('nav-open')) closeMobileNav();
        else openMobileNav();
      });
    }
    const backdrop = document.getElementById('nav-backdrop');
    if (backdrop) backdrop.addEventListener('click', closeMobileNav);

    const sidebar = document.getElementById('sidebar');
    if (sidebar) {
      sidebar.addEventListener('click', event => {
        if (event.target.closest('.nav-item')) closeMobileNav();
      });
    }

    document.addEventListener('keydown', event => {
      if (event.key === 'Escape') closeMobileNav();
    });

    window.addEventListener('resize', () => {
      if (window.innerWidth > 1024) closeMobileNav();
    });

    window.addEventListener('hashchange', renderRoute);

    document.addEventListener('nb:saving', () => setSaveIndicator('Saving', 'saving'));
    document.addEventListener('nb:saved', () => setSaveIndicator('Saved', 'saved'));
    document.addEventListener('nb:save-failed', () => {
      setSaveIndicator('Not saved', 'error');
      toast({ title: 'Workspace not saved', message: 'Local storage is unavailable in this browser session.', tone: 'warn' });
    });

    window.addEventListener('error', event => {
      window.__MERIDIAN_ERRORS__.push(String(event.message || event.error || 'Unknown error'));
      toast({ title: 'Console error', message: 'A runtime issue was detected. Refresh the workspace if the view stops updating.', tone: 'bad', duration: 6000 });
    });

    window.addEventListener('unhandledrejection', event => {
      window.__MERIDIAN_ERRORS__.push(String(event.reason || 'Unhandled rejection'));
    });
  }

  function init() {
    NB.hydrateIcons();
    Store.initRuntime(24);
    attachShell();
    updateClock();
    setInterval(updateClock, 1000);
    setSaveIndicator('Saved', 'saved');
    renderRoute();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
