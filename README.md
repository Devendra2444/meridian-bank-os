# Meridian Core Ops

A deployable banking operations console for live transaction orchestration. Meridian Core Ops brings scheduling, request synchronization, resource safety, and memory allocation into one operational workspace built for a realistic ATM and core-banking workload.

The product is implemented as a fast static application with no build step. Every control, metric, alert, and visualization is interactive.

## Project aim

A banking system processes ATM withdrawals, deposits, fund transfers, balance inquiries, and transaction records. Multiple transactions execute concurrently while sharing database connections, transaction-processing services, ledger locks, and memory. Incoming requests must be queued and processed without data inconsistency.

Meridian Core Ops models that environment as an operations console. Operators can:

- schedule a mixed transaction batch under competing CPU policies;
- run a bounded producer-consumer request stream with multiple sources and processing pods;
- evaluate allocation requests against a live resource safety state;
- compare memory placement policies across fixed and dynamic partition maps;
- execute a complete batch, inspect cross-plane results, and export the evidence as JSON.

The website presents the system as a real product. It does not contain textbook definitions, pseudocode, or step-by-step instructional content.

## Workspace

| Route | Workspace | What it provides |
| --- | --- | --- |
| `#/overview` | Command Center | Batch health, safety state, queue depth, memory mapping, dispatch timeline, resource posture, transaction ledger, and activity stream |
| `#/intake` | Transaction Intake | Editable manifest for up to eight transactions, source channels, arrival and burst budgets, priorities, memory footprints, demand profile, and admission readiness |
| `#/scheduler` | CPU Scheduler | Six dispatch policies, time quantum control, Gantt timeline, wait/turnaround/response/utilization metrics, policy benchmark, and full transaction metrics |
| `#/queue` | Request Queue | Live bounded buffer, FIFO slots, empty/full/mutex state, configurable sources and pods, speed controls, queue-pressure chart, event stream, and continuous integrity checks |
| `#/resources` | Resource Guard | Editable allocation, claim, and available matrices, computed need, safe recovery path, safety summary, request evaluation, and authorized allocation updates |
| `#/memory` | Memory Manager | Fixed and dynamic partitions, First Fit, Best Fit, and Worst Fit comparison, address-space rack, slack and free-space accounting, placement ledger, and partition-map controls |

## Operating behavior

- **Batch execution** refreshes the request queue, scheduler, and safety analysis, then records cross-plane activity. The active batch ID advances on every run.
- **Report export** downloads a structured JSON archive containing the workload, scheduler metrics and timeline, policy benchmark, dispatch plan, queue counters and events, allocation state, safe sequence, and selected memory analysis.
- **Autosave** persists transactions, policies, queue configuration, allocation state, memory settings, batch identity, and activity in local storage. The topbar reports save status.
- **Alerts** route directly to the affected control plane when the queue is saturated, memory cannot place a record, or the safety state is unsafe.
- **Guardrails** preserve the active manifest, allocation claims, queue bounds, and memory capacity while still allowing operators to stress the system.

## Run locally

Use the prepared `lab` environment.

```bash
source "$(conda info --base)/etc/profile.d/conda.sh"
conda activate lab
npm start
```

Open `http://localhost:4173`.

The dependency-free Node server honors `PORT` and `HOST`:

```bash
PORT=8080 npm start
```

A plain static server also works:

```bash
python3 -m http.server 4173
```

Run the algorithm suite with:

```bash
npm test
```

## Deploy

### Netlify

The included `netlify.toml` publishes the repository root. Connect the repository or run:

```bash
netlify deploy --prod --dir .
```

### Vercel

The included `vercel.json` configures a static deployment with no framework preset. Keep **Framework Preset** set to **Other**; do not deploy the local `preview.js` file as a Node backend.

```bash
vercel --prod
```

### GitHub Pages

`.github/workflows/deploy.yml` validates the algorithm suite and publishes the site on every push to `main`. Enable Pages with **GitHub Actions** as the source.

### Node host

```bash
npm start
```

The server serves the console, static assets, and extensionless route fallbacks with security headers.

## Architecture

```text
.
├── index.html                 Product shell, navigation, topbar, route host
├── style.css                  Design tokens, shell, shared components, tables, forms
├── views.css                  View-specific layouts and visualization components
├── responsive.css             Tablet, mobile, reduced-motion, and print behavior
├── js/
│   ├── algorithms.js          Scheduling, Banker's safety, memory, producer-consumer
│   ├── icons.js               Inline SVG icon system
│   ├── state.js               Persistence, runtime defaults, analytics, sidebar state
│   ├── charts.js              Sparkline and queue-pressure area chart
│   ├── views.js               Six operational views and interactions
│   └── app.js                 Routing, batch execution, export, toasts, shell behavior
├── assets/favicon.svg         Product mark
├── tests.js                   Node algorithm tests
├── preview.js                 Dependency-free local preview server
├── netlify.toml               Netlify deployment configuration
├── vercel.json                Vercel deployment configuration
└── robots.txt
```

All routes use hash navigation, so static hosting requires no rewrite rules. State is local to the browser and the application makes no external data API requests.

## Verification

The algorithm suite covers:

- first-come first-served, shortest job first, shortest remaining time, priority, preemptive priority, and round robin scheduling;
- weighted metrics, idle windows, and cross-policy comparisons;
- safe-sequence detection, granted and denied allocation requests, and invalid claims;
- fixed and dynamic memory placement under First Fit, Best Fit, and Worst Fit;
- bounded-buffer invariants, producer and consumer blocking, FIFO order, and item conservation.

The interface is verified across all six routes in headless Firefox, including queue stepping and running, scheduler policy switching, manifest add/remove, allocation request evaluation, memory mode and strategy switching, batch execution, mobile navigation, and horizontal-overflow checks.

## Scope

Meridian Core Ops is a simulation environment for operations design and evaluation. It does not connect to a production core banking system, process real money, or store customer records.
