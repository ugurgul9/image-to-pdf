# Component Context: Perspective Cropper Component

## Purpose
The `PerspectiveCropperComponent` (`src/app/components/perspective-cropper`) provides an immersive, gesture-safe touch boundary workspace that renders a skewed photo of a document, overlays a custom translucent dim mask and relative selection polygon, and offers four interactive corner handles with a floating magnifier zoom bubble.

---

## Technical Specifications & Architecture

### 1. Standalone Definition
- **Selector**: `app-perspective-cropper`
- **Imports**: `CommonModule`
- **Files**:
  - `perspective-cropper.component.ts` (Core logic and drag events)
  - `perspective-cropper.component.html` (SVG overlay grids and handles)
  - `perspective-cropper.component.scss` (Immersive workspace styles)

### 2. State & Data Flow (Signals & Inputs/Outputs)
- **Inputs**:
  - `page` (`input.required<ScanPage>()`): The active scanned sheet context containing raw base64 image URIs and original coordinates.
- **Outputs**:
  - `cornersChange` (`output<Point[]>()`): Emitted reactively in real-time as coordinates are dragged, allowing the parent service to store coordinate drift.
- **Local Signals**:
  - `corners` (`linkedSignal<ScanPage, Point[]>`): A modern writable linked signal bound to `page()`. Whenever the active page input shifts, the draggable corners automatically reset to the new page's default or saved coordinates.
  - `activeHandle` (`signal<number | null>`): Tracks which of the four corners (0: NW, 1: NE, 2: SE, 3: SW) is currently active.
  - `magnifierX` / `magnifierY` (`signal<number>`): Coordinates of the magnifying glass relative to the workspace.
  - `containerWidth` / `containerHeight` (`signal<number>`): Measures and stores the DOM dimensions of the scaled image layout to ensure perfect relative-to-pixel coordinate conversions.

### 3. Core Algorithms & Maths

*   **Smart Edge Contour Snapping (`detectDocumentEdges()`)**:
    - Triggers automatically inside `onImageLoaded()` for fresh page imports (where `croppedUri === null`).
    - Downsamples the document onto a `150x150` offscreen canvas buffer.
    - Computes global average luma thresholding to separate paper sheets from darker background surfaces.
    - Solves a convex hull corner heuristic:
      - Top-Left (NW): minimizes `x + y`
      - Top-Right (NE): maximizes `x - y`
      - Bottom-Right (SE): maximizes `x + y`
      - Bottom-Left (SW): minimizes `x - y`
    - Inserts a `0.02` visual safety margin to guarantee the text is not clipped.

*   **SVG Mask Cutout Overlay (`svgMaskPath` & `svgPolygonPoints`)**:
    - `svgPolygonPoints` (`computed<string>`): Maps relative coordinates to scaled container pixels: `x * containerWidth` and `y * containerHeight`.
    - `svgMaskPath` (`computed<string>`): Draws a darkened transparent overlay (`rgba(2, 6, 23, 0.72)`) across the outer boundaries while cutting out the selected document viewport boundaries.

*   **Floating Magnifier Zoom Glass (`updateMagnifier()`)**:
    - Renders a floating circular glass bubble (`110px`) when a handle is dragged.
    - Uses an HTML5 Canvas context to copy a `100x100` bounding box centered at the active handle from the original high-resolution image, magnifying it at `1.1x` with crosshairs for ultra-precise alignment.
    - Automatically clamps the bubble's top/left coordinates so it never slips off-screen.

*   **Immersive Touch Gesture Tracking**:
    - Uses `@HostListener('window:mousemove')` and `@HostListener('window:touchmove')` to capture dragging outside the bounds.
    - Coordinates are soft-clamped to a margin (`-0.05` to `1.05`) to prevent fingers from slipping off-screen or triggering OS navigation swipes, while the parent warp engine clips them to safe `0..1` bounds.

---

## Styling & Layout Constraints
- **Overflow Visibility**: The `.warp-container` and `.svg-layer` maintain `overflow: visible;` so that dragging handle circles (28px) never clip at the viewport borders.
- **Immersive Viewport**: Disables double-tap zooming and locks scrolling gestures (`touch-action: none`) inside the cropping workspace to provide an app-like gestural experience.
