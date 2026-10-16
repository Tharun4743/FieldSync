# FieldSync ΓÇö Offline-First Collaborative Field Inspection PWA

[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-8.x-646CFF.svg)](https://vitejs.dev/)
[![React](https://img.shields.io/badge/React-19.x-61DAFB.svg)](https://react.dev/)
[![IndexedDB](https://img.shields.io/badge/Dexie.js-v4-brightgreen.svg)](https://dexie.org/)
[![CRDT](https://img.shields.io/badge/Yjs-CRDT-orange.svg)](https://yjs.dev/)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E.svg)](https://supabase.com/)
[![Cloudinary](https://img.shields.io/badge/Cloudinary-Resumable%20Media-blueviolet.svg)](https://cloudinary.com/)
[![Testing](https://img.shields.io/badge/Vitest-Passed%20(21%2F21)-green.svg)](https://vitest.dev/)

> **FieldSync** is a production-grade, offline-first Progressive Web Application (PWA) built for industrial, utility, and infrastructure inspections in environments with zero connectivity. It features a complete **4-role enterprise lifecycle (Customer ΓåÆ Admin ΓåÆ Supervisor ΓåÆ Technician)**, real-time bi-directional Supabase PostgreSQL synchronization, Cloudinary resumable media uploads, Yjs CRDT conflict resolution, and immutable append-only audit histories.

---

## ≡ƒîÉ Live Demonstration & Public Tunnel

FieldSync runs locally and is deployed globally via high-speed Cloudflare Edge Tunnels:

- **Cloudflare Edge Tunnel**: **[https://wife-assuming-seem-questionnaire.trycloudflare.com](https://wife-assuming-seem-questionnaire.trycloudflare.com)** *(Instant access, zero password prompt, full PWA offline support)*
- **GitHub Repository**: **[https://github.com/Tharun4743/FieldSync](https://github.com/Tharun4743/FieldSync)**

---

## ≡ƒÄ» Problem Statement (WA-1) & Enterprise Scope

**WA-1. Offline-First Collaborative Field Inspection App**
- **Problem**: Technicians inspect critical industrial machinery, substations, and network facilities in locations with zero cellular coverage (basements, remote switchyards, subterranean conduits).
- **Core Requirement**: A PWA that functions 100% offline, converges multi-user edits using CRDTs without silent overwrites, exposes readable conflict adjudication and immutable audit logs, and handles resilient schema migrations and chunked media uploads.
- **Enterprise Expansion**: Beyond single-role inspection, FieldSync delivers a complete closed-loop lifecycle covering customer complaint logging, administrative triage and dispatch, supervisor verification and rework management, and technician field diagnostics.

---

## ≡ƒæÑ 4-Role Enterprise Workflow

FieldSync organizes field inspection into four specialized, authenticated roles:

```mermaid
graph TD
    subgraph Customer ["1. Customer / Site Operator"]
        C1["Raise Service Complaint / Issue"] --> C2["Capture Photos & Voice Notes Offline"]
        C2 --> C3["Track Resolution Status & Certificate"]
    end

    subgraph Admin ["2. System Administrator"]
        A1["Admin Command Center"] --> A2["Triage Incoming Issues"]
        A2 --> A3["Prioritize (LOW / MED / HIGH / CRITICAL)"]
        A3 --> A4["Assign to Supervisor & Field Technicians"]
    end

    subgraph Technician ["3. Field Technician"]
        T1["Offline Package Preparation"] --> T2["Tactile Quick Inspection Mode"]
        T2 --> T3["Record Checklist Findings (PASS/FAIL, Numeric)"]
        T3 --> T4["Attach Resumable Photos & Voice Notes"]
        T4 --> T5["Submit for Supervisor Sign-Off"]
    end

    subgraph Supervisor ["4. Inspection Supervisor"]
        S1["Review Submission Queue"] --> S2{"Verification Gate"}
        S2 -- Approved --> S3["Sign Off & Issue Resolution Certificate"]
        S2 -- Deficiencies Found --> S4["Request Rework with Required Actions"]
        S4 --> T2
    end

    Customer --> Admin --> Technician --> Supervisor
```

### Preconfigured Demonstration Credentials (Password: `123456`)
| Role | Name | Email | Primary Responsibilities |
|---|---|---|---|
| **ADMIN** | Tharun Erodde | `tharun@gmail.com` | Full system control, role assignment, ticket triage, audit inspection |
| **SUPERVISOR** | Abi Kumar | `abi@gmail.com` | Quality assurance, verification queue sign-off, rework assignment |
| **TECHNICIAN** | Elakkiya S | `elakkiya@gmail.com` | Offline field inspection execution, tactile checklists, evidence capture |
| **TECHNICIAN** | Rajesh M | `rajesh@fieldsync.io` | Secondary technician for concurrent multi-user CRDT conflict testing |
| **CUSTOMER** | Bob Abd | `customer@company.com` | Self-service complaint portal, tracking tickets, reviewing signed certificates |

---

## ≡ƒÅ¢∩╕Å System Architecture

```mermaid
graph TD
    subgraph Client ["Client Device (FieldSync PWA ┬╖ Zero Network Dependency)"]
        UI["Tactile UI Layer: Quick Inspection / Conflict Center / Audit History"]
        RoleRouter["Role-Based Workspace Guard (Admin / Supervisor / Tech / Customer)"]
        Lang["Offline i18n Manager (6 Languages: EN, TA, HI, TE, KN, ML)"]
        Speech["Offline Speech Synthesis (TTS Instruction Read-Aloud)"]
        MediaRec["MediaRecorder (Photos & Voice Notes Blobs)"]
        Search["Offline Search Indexer (Zero-Network Inverted Index)"]
        
        UI --> RoleRouter
        UI --> Lang
        UI --> Speech
        UI --> MediaRec
        UI --> Search

        subgraph LocalStore ["IndexedDB (Dexie v4 - Schema Version 3)"]
            T1["inspections & checklistItems"]
            T2["inspectionResults & inspectionProgress"]
            T3["photos & voiceNotes (IndexedDB Blobs)"]
            T4["operations (Append-Only Replay Queue)"]
            T5["conflicts & auditEvents"]
            T6["offlinePackages & userSettings"]
        end

        UI --> LocalStore
        MediaRec --> T3
        LocalStore --> CRDT["Yjs CRDT Document Engine"]
    end

    subgraph SyncEngine ["Background Synchronization Controller"]
        Worker["Auto-Sync Engine (Online/Offline Navigator & Poller)"]
        CloudSync["CloudSync Protocol (/src/lib/sync/cloudSync.ts)"]
        OpQueue["Idempotent Operations Queue (/src/lib/sync/syncService.ts)"]
        MediaUploader["Cloudinary Resumable Byte-Range Uploader"]
        
        CRDT --> Worker
        T4 --> OpQueue
        T3 --> MediaUploader
        Worker --> CloudSync
    end

    subgraph Cloud ["Cloud Infrastructure (Supabase & Cloudinary)"]
        SupabasePostgres["Supabase PostgreSQL 15 (Single Source of Truth)"]
        AuditTrail["Immutable Audit Table (public.audit_events)"]
        CloudinaryCDN["Cloudinary Storage (Direct Resumable Chunk Uploads)"]
        
        OpQueue -->|Direct Table Push / Operations Queue| SupabasePostgres
        CloudSync -->|Pull Latest Remote State| SupabasePostgres
        Worker --> AuditTrail
        MediaUploader --> CloudinaryCDN
    end
```

---

## ≡ƒÆí How FieldSync Solves the Core Challenges

### 1. Robust Bi-Directional Cloud Synchronization
- **Online Execution**: Mutations are pushed immediately to Supabase PostgreSQL (`public.inspections`, `public.checklist_items`, `public.inspection_results`, `public.notes`, `public.audit_events`).
- **Offline Resilience**: When disconnected, changes write instantly to IndexedDB with optimistic UI updates and queue in `db.operations`.
- **Automatic Reconnection Replay**: Upon regaining network connectivity, `syncService.ts` replays the pending operations queue idempotently against Supabase using monotonic logical clocks, guaranteeing zero data loss.
- **Remote State Ingestion (`cloudSync.ts`)**: On session boot or manual sync, the client pulls fresh remote inspections, industrial assets, checklist definitions, and audit events into local IndexedDB.

### 2. Client-Side Non-Destructive Schema Evolution
- **Sequential Migration Pipeline**: Implemented in [`src/lib/db/schema.ts`](file:///c:/Users/tharu/Downloads/erodde/src/lib/db/schema.ts) via Dexie.js v4.
  - `Version 1`: Core relational tables (`users`, `devices`, `inspections`, `assets`, `checklistItems`, `inspectionResults`, `notes`, `media`, `operations`, `conflicts`, `auditEvents`, `syncState`, `appMetadata`).
  - `Version 2`: Adds priority grading, scheduled dates, checklist bounds/units, and retry counters. Migration scripts backfill missing records safely.
  - `Version 3`: Adds `voiceNotes` audio Blobs, `inspectionProgress` state bookmarking, `offlinePackages`, and composite index `[inspectionId+checklistItemId]`.
- **Stale Client Safety**: Devices offline for days or weeks step through migrations ($v_1 \rightarrow v_2 \rightarrow v_3$) sequentially on boot without resetting uncommitted evidence or local caches.

### 3. Resumable Chunked Media Ingestion
- **Byte-Range Pipeline ([`src/lib/media/resumableUpload.ts`](file:///c:/Users/tharu/Downloads/erodde/src/lib/media/resumableUpload.ts))**: Large photographs ($2\text{--}8$\,MB) are partitioned into 1\,MB chunks uploaded directly to Cloudinary (`lt6lmhj9`) using client-side SHA-1 signed authentication.
- **Offset Persistence**: Confirmed byte positions are stored locally in IndexedDB after each chunk. If network connectivity drops mid-upload, transfers resume from the exact byte offset rather than restarting from zero.
- **Priority Queue**: High-priority observations and lightweight audio notes are synchronized ahead of heavy image payloads.

### 4. Transparent Conflict Resolution & Immutable Audit History
- **Conflict Center ([`src/pages/ConflictCenter.tsx`](file:///c:/Users/tharu/Downloads/erodde/src/pages/ConflictCenter.tsx))**: Detects multi-technician concurrent modifications on shared assets. Displays side-by-side visual diffs (*Local Value* vs. *Server Value*, conflicting technician, timestamp) with explicit adjudication options (`KEEP_MINE`, `KEEP_THEIR`, or manual merge).
- **Recent Activity & Audit Trail ([`src/pages/AuditHistory.tsx`](file:///c:/Users/tharu/Downloads/erodde/src/pages/AuditHistory.tsx))**: Append-only audit logging directly in PostgreSQL and IndexedDB. Displays exact user attribution, before/after values, entity IDs, and relative timestamps with zero constant or synthetic mock data.

---

## ΓÜí Multimodal Offline Productivity Features

1. **Tactile Quick Inspection Mode**: Single-tap binary/ternary decision pills (`[ PASS ] [ FAIL ]`, `[ GOOD ] [ DAMAGED ]`), numeric steppers with units ($^\circ$C, bar, PSI), and single-action `[ SAVE & NEXT ΓåÆ ]` progression.
2. **Inspection Progress Bookmarking**: Dedicated `inspectionProgress` table tracks completion count, percentage, and exact checklist positions. Closing the app or browser mid-inspection preserves progress, providing an immediate **"Resume Inspection"** card on the dashboard.
3. **Offline Voice Notes**: Built-in HTML5 `MediaRecorder` audio recorder saving binary Blobs in IndexedDB with interactive waveform playback.
4. **Offline Read Aloud (TTS)**: Built on the W3C `SpeechSynthesis` API to speak checklist instructions and safety alerts aloud for hands-free inspection.
5. **Zero-Network Multilingual Engine**: Complete localized dictionaries bundled client-side for **6 languages**: English, Tamil (`ta`), Hindi (`hi`), Telugu (`te`), Kannada (`kn`), and Malayalam (`ml`).
6. **Instant Offline Search**: In-memory inverted token index over local assets, inspections, and checklist items delivering sub-millisecond query results.
7. **Storage Guardian & Safe Eviction**: Real-time disk quota inspection via `navigator.storage.estimate()`. Technicians can prune local caches, but the deletion algorithm strictly protects un-synchronized evidence (`syncStatus == 'synced'`).

---

## ≡ƒº¬ Automated Testing & Verification

FieldSync maintains 21 automated unit and integration tests across 4 test suites:

```bash
# Run automated test suites
npx vitest run

# Run TypeScript typecheck
npx tsc --noEmit

# Compile production bundle
npm run build
```

### Verified Test Suites (`src/tests/`):
- **Customer Workflow Suite (`customerWorkflow.test.ts`)**: Validates end-to-end complaint logging, offline persistence, supervisor dispatch, and resolution verification.
- **Local Database Suite (`localDatabase.test.ts`)**: 9 tests verifying schema migrations, composite indexing, and CRUD operations on binary Blobs.
- **Offline Productivity Suite (`offlineProductivity.test.ts`)**: 8 tests confirming priority queue sorting, multilingual dictionary lookups, and local search queries.
- **Sync & Migration Suite (`syncAndMigration.test.ts`)**: 3 tests validating schema upgrades, pending operations serialization, and idempotent replay.

---

## ≡ƒÜÇ Local Development Setup

```bash
# Clone the repository
git clone https://github.com/Tharun4743/FieldSync.git
cd FieldSync

# Install dependencies
npm install

# Start local development server
npm run dev
```

Navigate to `http://localhost:5173` to test locally, or use the live Cloudflare tunnel link above.


## License & Intellectual Property Notice

> [!CAUTION]
> ### ðŸ”’ PROPRIETARY & CONFIDENTIAL INTELLECTUAL PROPERTY â€” ALL RIGHTS RESERVED
>
> All rights reserved. This repository, its architecture, source code, workflows, models, and associated documentation are the exclusive intellectual property of **Tharunkumar Kâ„¢**.
>
> **STRICT NOTICE:** No individual, organization, institution, or commercial entity is permitted to use, copy, modify, distribute, reproduce, sublicense, reverse-engineer, deploy, or commercially exploit any portion of this project without express, prior written permission from **Tharunkumar K**.
>
> **Copyright Â© 2026 Tharunkumar K. All Rights Reserved.**  
> See the [LICENSE](LICENSE) file for complete legal terms.

---

## Engineering Author

<table border="0">
  <tr>
    <td width="120" align="center" valign="top">
      <img src="https://github.com/Tharun4743.png" width="100" style="border-radius: 50%;" alt="Tharunkumar K" />
    </td>
    <td>
      <h3>Tharunkumar K</h3>
      <p>
        <b>Full Stack Developer & AI Systems Engineer</b><br/>
        ðŸŽ“ B.Tech in Information Technology â€” <a href="https://vsbec.com"><b>V.S.B. Engineering College, Karur</b></a> (Batch 2024â€“2028)<br/>
        ðŸŒŸ Recognized for holding the <b>Best GitHub Profile & Top Student Developer</b> at V.S.B. Engineering College (VSBEC)<br/>
        ðŸ¥‡ <b>Winner â€” Code Thugs 2K26</b> â€¢ ðŸš€ <b>Smart India Hackathon (SIH)</b> Top 50 National Finalist
      </p>
      <p>
        <a href="https://tharunkumark4743.netlify.app/">ðŸŒ Portfolio</a> â€¢
        <a href="https://github.com/Tharun4743">ðŸ™ GitHub (@Tharun4743)</a> â€¢
        <a href="https://www.linkedin.com/in/tharunkumark4743">ðŸ’¼ LinkedIn</a> â€¢
        <a href="https://leetcode.com/u/Tharunkumar__K/">ðŸ§© LeetCode</a> â€¢
        <a href="mailto:tharunkumark42007@gmail.com">ðŸ“§ Email</a>
      </p>
    </td>
  </tr>
</table>
<!-- =========================================================================
   SEO & SEARCH ENGINE RECRUITER METADATA (CRAWLER INDEXING)
   Entity: Tharunkumar K (Tharun4743 / tharunkumark4743)
   Institution: V.S.B. Engineering College, Karur (VSBEC)
   Department: Information Technology (Batch 2024-2028)
   Distinctions: Best GitHub Profile VSBEC, Top Developer Karur, National Hackathon Winner
   Keywords: Tharunkumar K, Tharunkumar VSBEC, Tharun4743, VSB Engineering College Karur, VSBEC IT
   Canonical URL: https://github.com/Tharun4743/FieldSync
========================================================================= -->