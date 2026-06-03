# Component Context: Export Modal Component

## Purpose
The `ExportModalComponent` (`src/app/components/export-modal`) completely encapsulates the client-side document compilation engine (`jsPDF`), sequential high-resolution image downloads, and the interactive progress/success modal overlay. It handles layout configurations, progress indicator animations, and popup-blocker-safe tab openings.

---

## Technical Specifications & Architecture

### 1. Standalone Definition
- **Selector**: `app-export-modal`
- **Imports**: `CommonModule`, `FormsModule`, `IonSpinner`, `IonButton`, `IonIcon`
- **Files**:
  - `export-modal.component.ts` (Component class & jsPDF compiler)
  - `export-modal.component.html` (Progress spinners and action screens)
  - `export-modal.component.scss` (Glassmorphic obsidian overlay styles)

### 2. State & Data Flow
- **Inputs**:
  - `pages` (`input.required<ScanPage[]>()`): Scanned sheet batches to compile.
  - `isOpen` (`input.required<boolean>()`): Toggles modal overlay visibility.
- **Outputs**:
  - `closeModal` (`output<void>()`): Emitted when a user clicks close or "Go Back & Adjust".
  - `resetRequest` (`output<void>()`): Emitted when a user resets the batch scans.
- **Local Writable Signals**:
  - `fileName` (`signal<string>`): Custom document prefix. Automatically pre-populated with a timestamp-formatted suffix `scan_YYYY-MM-DD_HH-MM-SS` when the modal is opened.
  - `pageSize` (`signal<'borderless' | 'a4' | 'letter'>`): Selected layout template.
  - `isGenerating` (`signal<boolean>`): True during compilation processing.
  - `exportStep` (`signal<'processing' | 'success' | 'error'>`): Manages wizard progression.
  - `exportType` (`signal<'pdf' | 'png'>`): Tracks active file format.
  - `compiledPdfUrl` (`signal<string | null>`): Reference to in-memory PDF blob.
  - `compiledPngUrls` (`signal<string[]>`): References to exported image sheets.

---

## Core Engines & Operations

### 1. Mixed Format jsPDF Compiler (`generatePdf()`)
*   **Asynchronous Preloading**: Uses `Promise.all()` to load base64 URIs into HTML `Image` elements concurrently in a background thread to prevent blocking main-thread UI layouts.
*   **Dynamic Aspect-Ratio & Orientation**: Detects image width/height to dynamically apply portrait (`p`) or landscape (`l`) formatting per individual page, supporting mixed-format document stacks.
*   **Layout Modes**:
    - **`borderless`**: Sets jsPDF format exactly to image resolution bounds `[width, height]`, leaving zero white margins.
    - **`a4` / `letter`**: Fits the image proportionally centered within standard templates (`a4` or `letter`) with a uniform `10mm` edge margin.
*   **Blob Compiling**: Captures the final jsPDF output as an in-memory `blob`, maps it to a unique resource URI (`URL.createObjectURL(blob)`), and stores it in `compiledPdfUrl`.

### 2. Sequential Image Exporter (`exportImages()`)
*   Loops through cropped page base64 URIs, generates dynamic `<a>` anchors, assigns filenames `[baseName]_page_[index].png`, and triggers download clicks sequentially.
*   Applies a standard `150ms` delay between downloads to prevent modern mobile/desktop browsers from locking up or blocking multiple simultaneous files.

### 3. Popup-Blocker Safe Window Opener (`openCompiledFile()`)
*   To bypass strict browser popup blockers, the `window.open(url, '_blank')` call is executed synchronously inside a direct user click event (`openCompiledFile()`) on the success card, ensuring safe navigation without throwing blocking prompts.

---

## Styling & Layout Constraints
- **Overlay Blurring**: Uses `.success-overlay` with `position: fixed; z-index: 9999;` and a heavy backdrop blur (`backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px);`) to immerse the user and obscure the background viewport.
- **Glassmorphic Card Aesthetics**: Applies translucent background styles, fine borders, and smooth vertical animations (`scaleIn`) to the `.success-card` dialog.
