# Component Context: Sheets Carousel Component

## Purpose
The `SheetsCarouselComponent` (`src/app/components/sheets-carousel`) renders a premium, horizontal scrolling carousel slider of cropped document sheet thumbnails. It allows users to browse active batches, select sheets, shift card orders left or right, delete sheets, and capture more documents.

---

## Technical Specifications & Architecture

### 1. Standalone Definition
- **Selector**: `app-sheets-carousel`
- **Imports**: `CommonModule`, `IonIcon`
- **Files**:
  - `sheets-carousel.component.ts` (Component definition and imports)
  - `sheets-carousel.component.html` (Horizontal loop and control mappings)
  - `sheets-carousel.component.scss` (Obsidian-themed sliding list styles)

### 2. State & Data Flow (Inputs & Outputs)
- **Inputs**:
  - `pages` (`input.required<ScanPage[]>()`): The reactive array list of scanned document pages from the state service.
  - `currentIndex` (`input.required<number>()`): The index of the currently active focused sheet to highlight in the view.
- **Outputs**:
  - `selectPage` (`output<number>()`): Emitted when a user taps a thumbnail wrapper to select and view a specific sheet.
  - `deletePage` (`output<number>()`): Emitted when a user taps the delete (trash) icon on a card.
  - `movePageLeft` (`output<number>()`): Emitted to swap the current card with the preceding index.
  - `movePageRight` (`output<output>()`): Emitted to swap the current card with the subsequent index.
  - `addPage` (`output<void>()`): Emitted when a user clicks the dashed "+ Add Sheet" card.

---

## Visual Design & SCSS Architecture

*   **Obsidian Dark Aesthetics**:
    - The container features slate labels and transparent card grids.
    - Active cards `.active` receive a glowing violet border (`#a855f7`) and a smooth radial drop-shadow (`box-shadow: 0 0 15px rgba(168, 85, 247, 0.5)`).

*   **Custom Horizontal Scrollbar**:
    - Uses `.carousel-scroller` with `overflow-x: auto` and a thin custom webkit scrollbar (`height: 6px`, thumb styled with translucent white `rgba(255, 255, 255, 0.15)`).
    - Uses `flex-shrink: 0` to prevent thumbnails from narrowing when the list exceeds viewport width.

*   **Lightweight Crescent Loader**:
    - Displays a pure CSS spinning crescent loader (`ion-spinner` or custom crescent) inside `.thumbnail-placeholder` if a page's `croppedUri` is still calculating in the silent background.

*   **Integrated Reorder Controls**:
    - Decoupled floating sorting panels (`.reorder-controls`) are placed below each thumbnail wrapper.
    - Sorting buttons are disabled via standard attribute checks (`[disabled]="i === 0"` or `[disabled]="i === pages().length - 1"`) to prevent index out-of-bound errors.
