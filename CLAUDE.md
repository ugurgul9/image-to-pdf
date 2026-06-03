# DocScan Project Guidelines

## Command Reference

- **Development Server**: `npx @ionic/cli serve --host=0.0.0.0 --no-open`
- **Production Build**: `npm run build`
- **Linting**: `npm run lint`
- **Unit Tests**: `npm run test`

## Technology Stack

- **Frontend Core**: Angular 20 (Standalone Components)
- **UI Framework**: Ionic 8 & Ionicons 7
- **PDF Generation Engine**: jsPDF (Pure Client-side, Pixel-perfect Canvas Rendering)
- **Camera/Photos Import**: @capacitor/camera (with custom web file upload fallback)
- **Perspective Cropping Engine**: Custom Pure-TypeScript Projective Homography Warp Engine (Perspective Warp Solver)
- **Styling**: Scoped SCSS, Obsidian Dark-Mode Glassmorphism palette, Google Font "Outfit"

## AI Coding Agent Rules

> [!IMPORTANT]
> **Mandatory Skill Triggering Rules**:
> 1. For ALL development tasks, code generations, or refactorings, you **MUST** read and follow the **Angular Developer Guidelines** in [skills/angular-developer/SKILL.md](/skills/angular-developer/SKILL.md).
> 2. For ALL stylesheet or frontend layout modifications, you **MUST** read and follow the **Modern Web Guidance** (`modern-web-guidance`) skill.
> 
> **Mandatory Documentation & Plan Integrity Rule**:
> - Whenever code in a component or module is changed, or when related components are modified, you **MUST** immediately update (or create if missing) the corresponding component-level `context.md` file to accurately reflect the new states, properties, inputs/outputs, algorithms, and dependencies.
> - **Change Confirmation Rule**: If code modifications in a component affect, conflict with, or require updates to its corresponding or related `context.md` file (especially when removing features, changing core mathematical bounds, or altering input/output binds), the agent **MUST** stop and ask the user for explicit confirmation before proceeding, ensuring no features are unwillingly broken or deleted.
> - Whenever a development task is initiated, in progress, or completed, you **MUST** immediately update the master `plans/tracker.md` file and the related active plan (e.g., `plans/plan-02-camscanner-pro.md`) to mark checklist items appropriately. Stale tracking documents are strictly unacceptable.


### Reactivity & Coordinate Math Guidelines
- **Signals**: Always use Angular **Signals** (`signal()`, `computed()`) for coordinate lists, bounding states, magnifier tracking, and dynamic layout bindings.
- **Homography Solver**: Keep the 8x8 Gaussian elimination solver in `home.page.ts` highly optimized and free of dependencies.
- **Cropping Coordinates**: Coordinate lists must store relative points (`0..1` coordinates relative to the image size). Allow handles to be visually dragged within a soft margin (`-0.05` to `1.05`) for optimal touch usability, but strictly clamp them back to `0..1` when executing the homography warp to prevent out-of-bound pixel gaps.
- **Dynamic Resize Handling**: Reset the cropping container width and height to empty strings at the start of viewport calculations to let the browser naturally recalculate image bounds on screen resizing or rotation.

### Styling & CSS Rules
- **Obsidian Dark Mode**: Maintain the deep Obsidian slate background (`#020617`, `#0f172a`), vibrant violet/pink accents, and glassy backdrops (`backdrop-filter: blur(12px)`).
- **Anti-Clipping & Draggability**: Keep `overflow: visible;` on `.warp-container` and `.svg-layer` so that circular dragging touchpoints (28px) never clip at the borders.
- **Viewport Constraints**: Ensure the cropping view is fully immersive and lock scrolling gestures (`touch-action: none`) inside `.fullscreen-workspace` so that mobile dragging feels smooth without page-bounce.
