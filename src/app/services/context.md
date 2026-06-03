# Services Layer Context: Business Logic & Calculations

## Purpose
The `src/app/services` directory houses the core business logic, application state machines, and mathematical image-warping computations of DocScan. By keeping these operations outside components, we maintain a clean separation of concerns, improve testability, and ensure UI smoothness on mobile browsers.

---

## Technical Specifications Index

| Service / File | Reactive Elements / Public Signals | Key Methods & Actions | Core Responsibility & Technical Mechanisms |
| :--- | :--- | :--- | :--- |
| [`scan-state.service.ts`](./scan-state.service.ts) | <ul><li>`pages = signal<ScanPage[]>([])`</li><li>`currentPageIndex = signal<number>(0)`</li><li>`currentPage = computed(...)`</li><li>`rawImageUri = computed(...)`</li></ul> | <ul><li>`addNewScanPage(uri, state)`</li><li>`deletePage(idx, state, reset)`</li><li>`movePageLeft(idx)`</li><li>`movePageRight(idx)`</li><li>`loadDraftFromStorage()`</li><li>`saveDraftToStorage()`</li><li>`reset()`</li></ul> | Manages the dynamic document list. Coordinates CRUD operations, index bounds preservation, background cropping updates, and serialization for offline browser session saves (`localStorage`). |
| [`warp-engine.service.ts`](./warp-engine.service.ts) | *None (computational utility service)* | <ul><li>`cropPerspective(...)`</li><li>`cropPageInBackground(...)`</li></ul> | Solves 8x8 linear equation matrices using Gaussian Elimination to calculate homography warps. Applies color filters (Magic Color, Photocopy Grayscale) and runs tasks inside background Web Workers. |

---

## Architectural & Integration Details

### 1. State Sync & Local Storage Cache
The `ScanStateService` automatically persists changes to the browser's local cache on every mutation:
*   On initialization, `loadDraftFromStorage()` is invoked to restore the page stack (`ScanPage[]`).
*   Whenever a page is appended, deleted, or reordered, `saveDraftToStorage()` stringifies and writes the batch array.
*   Upon clicking "Reset", the cache is purged, and signals are reset.

### 2. Multi-threaded Image Processing (Web Workers)
To prevent the main UI thread from stuttering during heavy image warping:
*   `WarpEngineService` creates inline Web Workers dynamically using blobs:
    ```typescript
    const workerBlob = new Blob([workerCode], { type: 'application/javascript' });
    const worker = new Worker(URL.createObjectURL(workerBlob));
    ```
*   The worker performs coordinate translation, bilinear interpolations, and pixel-level matrix styling computations.
*   **Synchronous Fallback**: If browser sandboxing prevents the worker from initializing, the engine automatically catches the error and executes the warp on the main thread synchronously (`runWarpSync`) as a fallback.

### 3. Coordinate snaps (Gaussian Homography Mapping)
Warp transformations map arbitrary quadrilaterals (defined by four relative corner handles) into standard rectangular shapes. The mapping matrix is solved using:
$$H = \begin{bmatrix} a & b & c \\ d & e & f \\ g & h & 1 \end{bmatrix}$$
This matrix transforms relative inputs $(x, y)$ into mapped dimensions $(u, v)$ for output rendering.
