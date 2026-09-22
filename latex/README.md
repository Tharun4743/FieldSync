# FieldSync IEEE Project Report (LaTeX)

This directory contains the ready-to-compile, publication-grade **3-page IEEE format project report** for the **FieldSync** offline productivity and synchronization engine.

---

## 📄 Document Information

- **Title**: *FieldSync: An Offline-First Collaborative Field Inspection PWA with CRDT Synchronization, Resumable Media, and Audit History*
- **Problem Statement**: WA-1 (Offline-First Collaborative Field Inspection App)
- **Format**: IEEE Conference Format (`\documentclass[conference]{IEEEtran}`)
- **Length**: **Exactly 3 Pages** (Double Column, 10pt)
- **Output Artifact**: [`main.pdf`](file:///c:/Users/tharu/Downloads/erodde/latex/main.pdf) (222 KB, 3 pages)
- **Diagrams**: Vector-sharp architectural and sequence flow diagrams rendered directly into the PDF using LaTeX TikZ.

---

## 📂 Folder Contents

| File / Folder | Purpose |
| :--- | :--- |
| [`main.tex`](file:///c:/Users/tharu/Downloads/erodde/latex/main.tex) | Main LaTeX source containing all technical sections, mathematical formulations, benchmarking tables, and **native vector diagrams** (Fig 1: Architecture, Fig 2: Sequence flow). |
| [`main.pdf`](file:///c:/Users/tharu/Downloads/erodde/latex/main.pdf) | Pre-compiled 3-page camera-ready PDF document ready for submission, printing, or evaluation. |
| [`references.bib`](file:///c:/Users/tharu/Downloads/erodde/latex/references.bib) | BibTeX bibliography containing canonical citations (CRDTs, Local-First, W3C Specs, Dexie, Yjs). |
| [`IEEEtran.cls`](file:///c:/Users/tharu/Downloads/erodde/latex/IEEEtran.cls) | Official IEEEtran LaTeX class file (v1.8b). Self-contained — no external LaTeX distribution downloads required. |
| [`IEEEtran.bst`](file:///c:/Users/tharu/Downloads/erodde/latex/IEEEtran.bst) | Official IEEEtran BibTeX style file. |

---

## 🛠️ How to Compile

### Option 1: Local Terminal (MiKTeX / TeX Live / MacTeX)
Run the compilation sequence in this directory:
```bash
# 1. Initial pass
pdflatex -interaction=batchmode main.tex

# 2. Process bibliography
bibtex main

# 3. Resolve cross-references
pdflatex -interaction=batchmode main.tex

# 4. Final generation
pdflatex -interaction=batchmode main.tex
```

Or using `latexmk`:
```bash
latexmk -pdf main.tex
```

### Option 2: Overleaf (Cloud)
1. Compress the contents of this `latex/` folder into a `.zip` archive.
2. Go to [Overleaf](https://www.overleaf.com/) $\rightarrow$ **New Project** $\rightarrow$ **Upload Project**.
3. Set Compiler to **pdfLaTeX** and Main document to **`main.tex`**.
4. Click **Recompile**. All TikZ vector graphics compile immediately in the cloud without extra setup.

---

## 📊 Summary of Paper Sections & Visual Diagrams

1. **Section I: Introduction & Problem Formulation**: The zero-connectivity challenge in industrial inspections, failure modes of cloud-dependent SPAs, and local-first design tenets.
2. **Section II: System Architecture & CRDT Data Convergence**: Dexie Schema Version 3 stores and Yjs binary state vector convergence ($S_{local}^{(t+1)} = S_{local}^{(t)} \bullet \Delta_{mutation}$).
   - **Figure 1 (Visual Vector Diagram)**: Complete graphical blueprint illustrating the Client PWA layer (Tactile UI, i18n, Speech, Media, Search), Local IndexedDB Tier, Yjs CRDT engine, Background Sync Controller, and Cloud Ingestion Gateway.
3. **Section III: Multimodal Offline Productivity Engine**: High-contrast tactile Quick Inspection Mode, on-device audio recording via `MediaRecorder`, and prioritized two-tier chunked resumable media pipeline.
   - **Figure 2 (Visual Sequence Diagram)**: Complete graphical interaction flow between Technician, FieldSync PWA, Local IndexedDB, and Cloud Ingestion Services across disconnected field execution and reconnection phases.
4. **Section IV: Multilingual & Assistive Layer**: Zero-network localization across 6 Indian languages (English, Tamil, Hindi, Telugu, Kannada, Malayalam), native Web Speech API Text-to-Speech (TTS), and in-memory sub-millisecond search indexing.
5. **Section V: Evaluation & Storage Resilience**: Storage quota monitoring (`navigator.storage.estimate()`), safe eviction guarantee protecting unsynchronized media, transmission benchmarks across 2G/3G/4G profiles, and automated test suite verification (20/20 passing tests).
6. **Section VI: Conclusion & Future Directions**: Summary of contributions and roadmap for on-device Wasm Edge AI and WebRTC peer-to-peer ad-hoc sync.
