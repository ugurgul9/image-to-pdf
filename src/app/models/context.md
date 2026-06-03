# Data Model Layer Context: Domain Typing System

## Purpose
The `src/app/models` directory establishes the shared typing boundaries and structural models for DocScan. Having a decoupled model layer guarantees that raw image URI formats, dynamic touchpoint relative coordinates, and page rendering styles are consistently typed across the state management services and standalone UI components.

---

## Domain Models Index

Currently, the model layer contains a single domain file:

| Path / File | Key Exported Types | Scope & Responsibility |
| :--- | :--- | :--- |
| [`scan.model.ts`](./scan.model.ts) | `Point`, `ScanPage` | Defines the geometry system for perspective cropping adjustments and the core data contract for individual page sheets in a scanning batch. |

---

## Code Reference & Technical Descriptions

### 1. Point Interface
Represents a relative coordinate point inside the clipping viewport bounds.
```typescript
export interface Point {
  x: number; // Horizontal relative offset (clamped 0 to 1 relative to parent canvas width)
  y: number; // Vertical relative offset (clamped 0 to 1 relative to parent canvas height)
}
```
*   **Design Note**: Relative coordinates (0.0 to 1.0) are utilized rather than absolute pixel coordinates to ensure the crop boundaries remain accurate and fully responsive when scaling across mobile screens, desktop viewports, or resizing orientations.

### 2. ScanPage Interface
Represents the state of a single document page in the current batch.
```typescript
export interface ScanPage {
  id: string;                                 // Unique cryptographic UUID identifying the page in lists and loops
  rawUri: string;                             // Base64 URI or local device URL of the original captured image
  croppedUri: string | null;                 // Base64 URI of the post-crop, perspective-warped, filtered output image (null while processing)
  corners: Point[];                           // Array of exactly 4 relative Points representing the cropping box corners (TL, TR, BR, BL)
  filter: 'original' | 'magic' | 'grayscale'; // Applied aesthetic rendering filter preset
}
```
*   **Design Note**: When a page is first created, `croppedUri` is set to `null` while a silent background warp is queued. Standalone components like the sheets carousel render a crescent loading indicator until the background thread populates this property.
