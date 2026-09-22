# FieldSync — Operational Workflows & System State Machines

This document outlines the detailed architectural, operational, and lifecycle workflows governing the **FieldSync** offline productivity and synchronization engine.

---

## 1. End-to-End Technician Field Workflow

The diagram below illustrates the operational lifecycle of a field technician moving from online preparation at headquarters, transitioning to zero-connectivity execution in the field, and returning to network coverage for reconciliation.

```mermaid
sequenceDiagram
    autonumber
    actor Tech as Field Technician
    participant App as FieldSync PWA
    participant IDB as IndexedDB (Dexie v4)
    participant Cloud as Supabase & Cloudinary

    %% Stage 1: Preparation
    rect rgb(240, 245, 255)
        note over Tech,Cloud: STAGE 1: Online Pre-Departure Preparation
        Tech->>App: Opens Dashboard at Base Office
        App->>Cloud: Fetch assigned inspection tasks & asset schemas
        Cloud-->>App: Return inspections, checklist items, metadata
        App->>IDB: Cache all records locally (Dexie Schema v3)
        Tech->>App: Clicks "Prepare Offline Work"
        App->>App: Compute package size (e.g. 14.2 MB)
        App->>IDB: Save offlinePackage record & preload assets
    end

    %% Stage 2: Zero Connectivity Execution
    rect rgb(255, 245, 240)
        note over Tech,Cloud: STAGE 2: Zero-Connectivity Field Execution (Airplane Mode / No Signal)
        Tech->>App: Opens assigned inspection in "Quick Mode"
        App->>IDB: Retrieve cached checklist & prior progress
        Tech->>App: Taps "Read Aloud" (Offline TTS)
        App->>App: Native Web Speech API speaks checklist in selected language (e.g., தமிழ்)
        Tech->>App: Selects status [ GOOD / DAMAGED / N/A ], enters measurement
        Tech->>App: Records Voice Note via MediaRecorder
        App->>IDB: Save audio Blob in voiceNotes & create pendingOperation
        Tech->>App: Captures item inspection photo
        App->>IDB: Save image Blob in photos & create pendingOperation
        Tech->>App: Taps [ SAVE & NEXT → ]
        App->>IDB: Update inspectionResults, progress, & Yjs CRDT doc
        App-->>Tech: Immediately advances to next incomplete checklist item
    end

    %% Stage 3: Return to Network Coverage
    rect rgb(240, 255, 245)
        note over Tech,Cloud: STAGE 3: Network Reconnection & Background Ingestion
        App->>App: Online event triggered (navigator.onLine = true)
        App->>IDB: Fetch pendingOperations sorted by priority & createdAt
        note over App,Cloud: Prioritized Sync: Voice notes & CRDT ops synced before heavy photos
        App->>Cloud: POST /api/sync (Yjs binary updates + voice notes)
        Cloud-->>App: 200 OK (Updates applied to PostgreSQL & Audit Log)
        App->>Cloud: Resumable chunked upload of photos to Cloudinary
        Cloud-->>App: Upload complete, Cloudinary URLs returned
        App->>IDB: Mark inspectionResults & photos as synced = 1
        App-->>Tech: Display "All changes synchronized" in Sync Center
    end
```

---

## 2. Quick Inspection Mode State Machine

The Quick Inspection Mode is engineered for maximum throughput, allowing an inspector to record observations with minimal clicks and immediate visual validation.

```mermaid
stateDiagram-v2
    [*] --> Idle: Technician selects inspection
    Idle --> LoadingProgress: Check local inspectionProgress table
    LoadingProgress --> RenderItem: Load next incomplete checklist item
    
    state RenderItem {
        [*] --> DisplayInstructions
        DisplayInstructions --> PlayingAudio: User taps Speaker Icon (Offline TTS)
        PlayingAudio --> DisplayInstructions: Utterance completes or canceled
        
        DisplayInstructions --> EvaluatingStatus: Tap [ GOOD ] / [ DAMAGED ] / [ N/A ]
        DisplayInstructions --> MeasuringValue: Stepper [- / +] or direct input
        
        state MediaCapture {
            [*] --> VoiceRecordingModal: Tap Microphone
            VoiceRecordingModal --> AudioPreview: Stop Recording
            AudioPreview --> SaveAudio: Tap Save (Blob -> IDB)
            
            [*] --> PhotoCaptureModal: Tap Camera
            PhotoCaptureModal --> SavePhoto: Capture image (Blob -> IDB)
        }
    }
    
    RenderItem --> CommittingResult: Tap [ SAVE & NEXT → ]
    
    state CommittingResult {
        [*] --> WriteIndexedDB: Put record in inspectionResults
        WriteIndexedDB --> AppendQueue: Insert pendingOperation
        AppendQueue --> UpdateYjs: Update local CRDT state
        UpdateYjs --> RecalculateProgress: Update inspectionProgress
    }
    
    CommittingResult --> CheckMoreItems: Check nextChecklistItemId
    CheckMoreItems --> RenderItem: Unfinished items remain
    CheckMoreItems --> InspectionComplete: 100% completed
    InspectionComplete --> Dashboard: Return with complete status
```

---

## 3. Prioritized Asynchronous Media Queue

To avoid congesting weak cellular connections with large image payloads when a device first reconnects, FieldSync enforces strict queue prioritization:

```mermaid
flowchart TD
    Start([Online Connection Detected]) --> ScanQueue[Scan pendingOperations & Media in IDB]
    ScanQueue --> CheckVoiceNotes{Are there pending Voice Notes?}
    
    subgraph Tier1 ["Tier 1: High Priority (Low Bandwidth)"]
        CheckVoiceNotes -- Yes --> FetchVN[Fetch Voice Note Blob]
        FetchVN --> CompressVN[Verify Audio Payload]
        CompressVN --> UploadVN[POST Voice Note to Server]
        UploadVN --> MarkVNSynced[Mark Voice Note as Synced]
        MarkVNSynced --> CheckVoiceNotes
    end
    
    CheckVoiceNotes -- No --> CheckCRDTOps{Are there pending CRDT Ops?}
    
    subgraph Tier2 ["Tier 2: CRDT State Convergence"]
        CheckCRDTOps -- Yes --> BatchOps[Batch Yjs Binary Operations]
        BatchOps --> SendCRDT[POST /api/sync to Vercel/Supabase]
        SendCRDT --> MarkCRDTSynced[Mark Operations as Completed]
        MarkCRDTSynced --> CheckCRDTOps
    end
    
    CheckCRDTOps -- No --> CheckPhotos{Are there pending Photos?}
    
    subgraph Tier3 ["Tier 3: Bulk Media (Resumable Chunked)"]
        CheckPhotos -- Yes --> FetchPhoto[Read Photo Blob from IDB]
        FetchPhoto --> CheckOffset{Has partial upload offset?}
        CheckOffset -- Yes --> ResumeChunk[Send Remaining Byte Range]
        CheckOffset -- No --> UploadChunk[Start Chunked Upload to Cloudinary]
        ResumeChunk --> CloudinarySuccess{Success?}
        UploadChunk --> CloudinarySuccess
        CloudinarySuccess -- Interrupted --> SaveOffset[Store Chunk Offset in IDB]
        SaveOffset --> RetryLater([Pause Until Stable])
        CloudinarySuccess -- Complete --> MarkPhotoSynced[Set photo.syncStatus = synced]
        MarkPhotoSynced --> CheckPhotos
    end
    
    CheckPhotos -- No --> Complete([Queue Clean & Synchronized])
```

---

## 4. Conflict Resolution & Append-Only Audit Trail

When multiple field workers inspect interrelated assets or parallel components while offline, their states synchronize using **Yjs CRDTs** augmented with an append-only audit trail for administrative transparency:

```mermaid
graph TD
    subgraph DeviceA ["Technician Device A (Offline)"]
        EditA["Sets Item #4 to 'DAMAGED' (Timestamp t1)"]
        OpA["Operation Logged (UUID_A, t1, Lamport 14)"]
    end

    subgraph DeviceB ["Technician Device B (Offline)"]
        EditB["Sets Item #4 to 'GOOD' (Timestamp t2)"]
        OpB["Operation Logged (UUID_B, t2, Lamport 15)"]
    end

    subgraph CloudEngine ["Server Synchronization Gateway (/api/sync)"]
        Recon["CRDT State Evaluator (Y.Doc Merge)"]
        LWW["Deterministic Tie-Breaking / Field Rules"]
        AuditLog["Append-Only Table: auditEntries"]
        ConflictTable["conflicts Table (Flagged for Review)"]
    end

    EditA --> OpA
    EditB --> OpB
    OpA --> Recon
    OpB --> Recon
    Recon --> LWW
    LWW --> AuditLog
    LWW --> ConflictTable
```

---

## 5. Storage Guardian & Safe Garbage Collection

```mermaid
stateDiagram-v2
    [*] --> MonitorStorage: Call navigator.storage.estimate()
    MonitorStorage --> DisplayBreakdown: Render Usage by Category
    
    state DisplayBreakdown {
        PhotosUsage: Photos (MB)
        VoiceUsage: Voice Notes (MB)
        DataUsage: Inspection Results & Schemas (MB)
        QuotaUsage: Device Storage Quota (%)
    }
    
    DisplayBreakdown --> CleanupRequested: User triggers "Clear Cached Data"
    
    state CleanupRequested {
        [*] --> ScanRecords: Iterate photos & voiceNotes
        ScanRecords --> EvaluateSynced: Check syncStatus
        
        EvaluateSynced --> AllowedPrune: syncStatus == 'synced'
        AllowedPrune --> DeleteBlob: Remove binary data from IDB
        
        EvaluateSynced --> Prohibited: syncStatus != 'synced'
        Prohibited --> RetainRecord: ABORT deletion & preserve un-uploaded media
    }
    
    CleanupRequested --> MonitorStorage: Storage updated safely
```
