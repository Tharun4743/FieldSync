# 📱 FieldSync — Enterprise Architecture & CRDT Synchronizer

This document details the system topology, conflict-free data replication protocols, and multi-tier governance workflows for **FieldSync**.

---

## 1. Architectural Highlights
- **Conflict-Free CRDT Inverted Topology**: Uses Yjs CRDTs and IndexedDB for sub-16ms local read/write latency with mathematical convergence guarantees ($S \circ \Delta_A \circ \Delta_B = S \circ \Delta_B \circ \Delta_A$).
- **Progressive Web App Shell**: React 19, TypeScript, and Tailwind CSS installable across mobile, tablet, and desktop devices.
- **Enterprise 4-Role Lifecycle**: Strict state machine separating Field Inspectors, Site Supervisors, Quality Auditors, and Enterprise Administrators.
- **Offline Background Sync**: Service Worker queue negotiating state reconciliation with Supabase PostgreSQL Row-Level Security policies.

---

## 2. Technical Documentation & Academic Reports
The complete 12-page technical architecture report and mathematical convergence proofs are available in:
- **LaTeX Source**: [`docs/report/project-report.tex`](file:///c:/Users/tharu/Documents/GITHUB%20REPO/GITHUB%20MANAGER/FieldSync/docs/report/project-report.tex)
- **Compiled PDF**: [`docs/report/project-report.pdf`](file:///c:/Users/tharu/Documents/GITHUB%20REPO/GITHUB%20MANAGER/FieldSync/docs/report/project-report.pdf)
- **IEEE Conference Paper**: [`latex/main.tex`](file:///c:/Users/tharu/Documents/GITHUB%20REPO/GITHUB%20MANAGER/FieldSync/latex/main.tex) and [`latex/main.pdf`](file:///c:/Users/tharu/Documents/GITHUB%20REPO/GITHUB%20MANAGER/FieldSync/latex/main.pdf)
