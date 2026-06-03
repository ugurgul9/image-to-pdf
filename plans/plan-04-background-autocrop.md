# Implementation Plan 04 - Background Auto-Cropping Pipeline

**Status:** **DONE** (100% Complete)
**Date Completed:** June 2, 2026

This plan resolves the infinite loading spinner issue on bypassed scanned sheets by automatically running non-blocking background crops when leaving pages via bottom navigations or new page captures inside the cropping workspace.

---

## Technical Tasks

### 1. Background Perspective Cropping Engine
- [x] Implement the silent `cropPageInBackground(idxToCrop)` function inside `src/app/home/home.page.ts`.
- [x] Protect coordinate calculations against active drag handles by cloning page corners (`cornersToUse`) and filter selections (`filterToUse`) before initiating image load.
- [x] Setup dedicated Web Worker message and error listeners for the background process.
- [x] Write `runWarpSyncBackground(...)` to handle synchronous processing on the main thread in case the worker crashes or is blocked.

### 2. Navigation Auto-Crop Triggers
- [x] Add an optional `skipBackgroundCrop` boolean flag to `selectCurrentPage(index, skipBackgroundCrop)`.
- [x] In `selectCurrentPage()`, if the view state is `'cropping'` and `skipBackgroundCrop` is `false`, check if the active page has been edited and trigger background crop before updating index focus.
- [x] In `addNewScanPage(uri)`, if currently in `'cropping'` state, crop the page being left in the background before adding the new sheet.

### 3. Pipeline Safeguards & De-duplication
- [x] In `deletePage()`, pass `skipBackgroundCrop = true` to prevent background crops of the deleted page or out-of-bound errors.
- [x] In `handleCropSuccess()`, pass `skipBackgroundCrop = true` to prevent redundant cropping of pages that have just been manually cropped.

---

## Sync Commitments
- [x] Update `/plans/tracker.md` to list the new plan and track completed status.
- [x] Update `/src/app/home/context.md` with new parameters, functions, and mathematical boundaries.
- [x] Verify production compilation runs warning-free via `npm run build` and check for any code smells.
