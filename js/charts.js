(function () {
  'use strict';
  window.NB = window.NB || {};

  let counter = 0;

  function numbers(values) {
    const list = (values || []).filter(v => Number.isFinite(v));
    return list.length ? list : [0];
  }

  function sparkline(values, color, width, height) {
    const w = width || 128;
    const h = height || 38;
    const list = numbers(values);
    if (list.length === 1) list.push(list[0]);
    const min = Math.min(...list);
    const max = Math.max(...list);
    const range = max - min || 1;
    const pad = 3;
    const points = list.map((v, i) => {
      const x = (i / (list.length - 1)) * w;
      const y = h - pad - ((v - min) / range) * (h - pad * 2);
      return [x, y];
    });
    const line = points.map(([x, y], i) => (i === 0 ? 'M' : 'L') + x.toFixed(1) + ' ' + y.toFixed(1)).join(' ');
    const area = line + ' L ' + w + ' ' + h + ' L 0 ' + h + ' Z';
    const id = 'spark' + (++counter);
    const [lx, ly] = points[points.length - 1];
    return `<svg class="sparkline" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true">
      <defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${color}" stop-opacity=".28"/>
        <stop offset="100%" stop-color="${color}" stop-opacity="0"/>
      </linearGradient></defs>
      <path d="${area}" fill="url(#${id})"></path>
      <path d="${line}" fill="none" stroke="${color}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"></path>
      <circle cx="${lx.toFixed(1)}" cy="${ly.toFixed(1)}" r="2.3" fill="${color}" vector-effect="non-scaling-stroke"></circle>
    </svg>`;
  }

  function areaChart(history, capacity, color) {
    const list = (history || []).slice(-60);
    const rows = list.length ? list : [{ tick: 0, occupancy: 0 }];
    if (rows.length === 1) rows.push({ tick: rows[0].tick + 1, occupancy: rows[0].occupancy });
    const cap = Math.max(1, capacity || 1);
    const w = 720;
    const h = 210;
    const left = 30;
    const right = 12;
    const top = 14;
    const bottom = 26;
    const plotW = w - left - right;
    const plotH = h - top - bottom;
    const first = rows[0].tick;
    const last = rows[rows.length - 1].tick;
    const span = last - first || 1;
    const xOf = tick => left + ((tick - first) / span) * plotW;
    const yOf = value => top + plotH - (Math.min(cap, Math.max(0, value)) / cap) * plotH;

    const points = rows.map(r => [xOf(r.tick), yOf(r.occupancy)]);
    const line = points.map(([x, y], i) => (i === 0 ? 'M' : 'L') + x.toFixed(1) + ' ' + y.toFixed(1)).join(' ');
    const area = line + ' L ' + xOf(last).toFixed(1) + ' ' + (top + plotH) + ' L ' + xOf(first).toFixed(1) + ' ' + (top + plotH) + ' Z';
    const id = 'area' + (++counter);
    const grid = [0, 0.5, 1].map(f => {
      const y = top + plotH - f * plotH;
      const label = Math.round(f * cap);
      return `<line x1="${left}" y1="${y}" x2="${w - right}" y2="${y}" stroke="var(--chart-grid)" stroke-dasharray="2 5"></line>
        <text x="${left - 9}" y="${y + 4}" class="chart-label" text-anchor="end">${label}</text>`;
    }).join('');
    const capY = yOf(cap);
    const [lastX, lastY] = points[points.length - 1];
    const ticks = [first, first + Math.round(span / 2), last];
    const xLabels = ticks.map(t => `<text x="${xOf(t).toFixed(1)}" y="${h - 6}" class="chart-label" text-anchor="middle">${t}</text>`).join('');

    return `<svg class="area-chart" viewBox="0 0 ${w} ${h}" role="img" aria-label="Queue occupancy over time">
      <defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${color}" stop-opacity=".26"/>
        <stop offset="100%" stop-color="${color}" stop-opacity="0"/>
      </linearGradient></defs>
      ${grid}
      <line x1="${left}" y1="${capY}" x2="${w - right}" y2="${capY}" stroke="var(--warning)" stroke-opacity=".55" stroke-dasharray="4 5"></line>
      <text x="${w - right}" y="${capY - 7}" class="chart-label chart-label--warn" text-anchor="end">capacity ${cap}</text>
      <path d="${area}" fill="url(#${id})"></path>
      <path d="${line}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"></path>
      <circle cx="${lastX.toFixed(1)}" cy="${lastY.toFixed(1)}" r="3.2" fill="${color}"></circle>
      ${xLabels}
    </svg>`;
  }

  NB.charts = { sparkline, areaChart };
})();
