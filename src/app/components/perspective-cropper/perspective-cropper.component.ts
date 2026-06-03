import { Component, ElementRef, ViewChild, HostListener, signal, computed, input, output, linkedSignal, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Point, ScanPage } from '../../models/scan.model';

@Component({
  selector: 'app-perspective-cropper',
  templateUrl: './perspective-cropper.component.html',
  styleUrls: ['./perspective-cropper.component.scss'],
  standalone: true,
  imports: [CommonModule]
})
export class PerspectiveCropperComponent {
  
  page = input.required<ScanPage>();
  cornersChange = output<Point[]>();

  // A writable signal linked to the page input! 
  // Whenever the input page shifts, it resets automatically to page().corners!
  corners = linkedSignal<ScanPage, Point[]>({
    source: () => this.page(),
    computation: (source) => [...source.corners]
  });

  @ViewChild('imageElement') imageElement!: ElementRef<HTMLImageElement>;
  @ViewChild('workspaceContainer') workspaceContainer!: ElementRef<HTMLDivElement>;
  @ViewChild('magnifierCanvas') magnifierCanvas?: ElementRef<HTMLCanvasElement>;

  activeHandle = signal<number | null>(null);
  magnifierX = signal<number>(0);
  magnifierY = signal<number>(0);
  containerWidth = signal<number>(0);
  containerHeight = signal<number>(0);

  // Computed layout calculations for SVG overlays
  svgPolygonPoints = computed(() => {
    const pts = this.corners();
    const w = this.containerWidth();
    const h = this.containerHeight();
    
    const p0x = pts[0].x * w;
    const p0y = pts[0].y * h;
    const p1x = pts[1].x * w;
    const p1y = pts[1].y * h;
    const p2x = pts[2].x * w;
    const p2y = pts[2].y * h;
    const p3x = pts[3].x * w;
    const p3y = pts[3].y * h;

    return `${p0x},${p0y} ${p1x},${p1y} ${p2x},${p2y} ${p3x},${p3y}`;
  });

  svgMaskPath = computed(() => {
    const pts = this.corners();
    const w = this.containerWidth();
    const h = this.containerHeight();
    
    const p0x = pts[0].x * w;
    const p0y = pts[0].y * h;
    const p1x = pts[1].x * w;
    const p1y = pts[1].y * h;
    const p2x = pts[2].x * w;
    const p2y = pts[2].y * h;
    const p3x = pts[3].x * w;
    const p3y = pts[3].y * h;

    return `M 0 0 L ${w} 0 L ${w} ${h} L 0 ${h} Z M ${p0x} ${p0y} L ${p3x} ${p3y} L ${p2x} ${p2y} L ${p1x} ${p1y} Z`;
  });

  // Smart document edge contour snapping heuristics
  detectDocumentEdges(imgW: number, imgH: number, canvas: HTMLCanvasElement): Point[] {
    if (imgW <= 0 || imgH <= 0) {
      return [
        { x: 0.15, y: 0.15 },
        { x: 0.85, y: 0.15 },
        { x: 0.85, y: 0.85 },
        { x: 0.15, y: 0.85 }
      ];
    }
    
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return [
        { x: 0.15, y: 0.15 },
        { x: 0.85, y: 0.15 },
        { x: 0.85, y: 0.85 },
        { x: 0.15, y: 0.85 }
      ];
    }

    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imgData.data;
    
    let totalLuma = 0;
    for (let i = 0; i < data.length; i += 4) {
      const luma = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      totalLuma += luma;
    }
    const avgLuma = totalLuma / (data.length / 4);

    const candidates: Point[] = [];
    const step = 2; 
    for (let y = 0; y < canvas.height; y += step) {
      for (let x = 0; x < canvas.width; x += step) {
        const idx = (y * canvas.width + x) * 4;
        const luma = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
        
        if (luma > avgLuma * 1.06) {
          candidates.push({ x: x / canvas.width, y: y / canvas.height });
        }
      }
    }

    if (candidates.length < 10) {
      return [
        { x: 0.15, y: 0.15 },
        { x: 0.85, y: 0.15 },
        { x: 0.85, y: 0.85 },
        { x: 0.15, y: 0.85 }
      ];
    }

    let tl = candidates[0];
    let tr = candidates[0];
    let br = candidates[0];
    let bl = candidates[0];

    let minSum = tl.x + tl.y;
    let maxDiff = tr.x - tr.y;
    let maxSum = br.x + br.y;
    let minDiff = bl.x - bl.y;

    for (const pt of candidates) {
      const sum = pt.x + pt.y;
      const diff = pt.x - pt.y;

      if (sum < minSum) {
        minSum = sum;
        tl = pt;
      }
      if (sum > maxSum) {
        maxSum = sum;
        br = pt;
      }
      if (diff > maxDiff) {
        maxDiff = diff;
        tr = pt;
      }
      if (diff < minDiff) {
        minDiff = diff;
        bl = pt;
      }
    }

    const distT = Math.hypot(tr.x - tl.x, tr.y - tl.y);
    const distB = Math.hypot(br.x - bl.x, br.y - bl.y);
    if (distT < 0.22 || distB < 0.22) {
      return [
        { x: 0.15, y: 0.15 },
        { x: 0.85, y: 0.15 },
        { x: 0.85, y: 0.85 },
        { x: 0.15, y: 0.85 }
      ];
    }

    const margin = 0.02;
    return [
      { x: Math.max(0, tl.x + margin), y: Math.max(0, tl.y + margin) },
      { x: Math.min(1, tr.x - margin), y: Math.max(0, tr.y + margin) },
      { x: Math.min(1, br.x - margin), y: Math.min(1, br.y - margin) },
      { x: Math.max(0, bl.x + margin), y: Math.min(1, bl.y - margin) }
    ];
  }

  // Draw overlay outlines
  updateOverlay() {
    if (!this.workspaceContainer || !this.imageElement) return;
    
    const container = this.workspaceContainer.nativeElement;
    const img = this.imageElement.nativeElement;

    container.style.width = '';
    container.style.height = '';

    const imgW = img.clientWidth;
    const imgH = img.clientHeight;

    if (imgW > 0 && imgH > 0) {
      container.style.width = `${imgW}px`;
      container.style.height = `${imgH}px`;
      this.containerWidth.set(imgW);
      this.containerHeight.set(imgH);
    } else {
      this.containerWidth.set(container.clientWidth);
      this.containerHeight.set(container.clientHeight);
    }
  }

  // Draw zoomed portion under active handle to magnifier canvas
  updateMagnifier() {
    const activeIdx = this.activeHandle();
    if (activeIdx === null || !this.magnifierCanvas || !this.imageElement) return;

    const canvas = this.magnifierCanvas.nativeElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = this.imageElement.nativeElement;
    const activePt = this.corners()[activeIdx];

    const srcW = img.naturalWidth;
    const srcH = img.naturalHeight;

    const centerX = activePt.x * srcW;
    const centerY = activePt.y * srcH;

    const cropSize = 100;
    
    ctx.fillStyle = '#020617';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const scale = canvas.width / cropSize;

    const sLeft = centerX - cropSize / 2;
    const sTop = centerY - cropSize / 2;

    const dx = -sLeft * scale;
    const dy = -sTop * scale;
    const dw = srcW * scale;
    const dh = srcH * scale;

    ctx.drawImage(img, dx, dy, dw, dh);
  }

  // Calculate clamped magnifier glass coordinates
  updateMagnifierPosition() {
    const activeIdx = this.activeHandle();
    if (activeIdx === null) return;
    
    const activePt = this.corners()[activeIdx];
    const hx = activePt.x * this.containerWidth();
    const hy = activePt.y * this.containerHeight();

    const tx = hx;
    const ty = hy - 95;

    const halfSize = 55;

    this.magnifierX.set(Math.max(halfSize, Math.min(this.containerWidth() - halfSize, tx)));
    this.magnifierY.set(Math.max(halfSize, Math.min(this.containerHeight() - halfSize, ty)));
  }

  // Triggered when image finishes preloading in DOM
  onImageLoaded() {
    setTimeout(() => {
      this.updateOverlay();
      
      const img = this.imageElement.nativeElement;
      const pageData = this.page();
      
      // Auto-edge detection trigger for fresh scan imports
      if (pageData && pageData.croppedUri === null) {
        const detectCanvas = document.createElement('canvas');
        detectCanvas.width = 150;
        detectCanvas.height = 150;
        const dCtx = detectCanvas.getContext('2d');
        if (dCtx) {
          dCtx.drawImage(img, 0, 0, 150, 150);
          const detectedCorners = this.detectDocumentEdges(img.naturalWidth, img.naturalHeight, detectCanvas);
          
          this.corners.set(detectedCorners);
          this.cornersChange.emit(detectedCorners);
          this.updateOverlay();
        }
      }
    }, 150);
  }

  @HostListener('window:resize')
  onResize() {
    this.updateOverlay();
  }

  // Drag start
  onDragStart(event: MouseEvent | TouchEvent, index: number) {
    event.preventDefault();
    event.stopPropagation();
    this.activeHandle.set(index);
    setTimeout(() => {
      this.updateMagnifierPosition();
      this.updateMagnifier();
    }, 10);
  }

  // Global window listeners for tracking gestures
  @HostListener('window:mousemove', ['$event'])
  onMouseMove(event: MouseEvent) {
    if (this.activeHandle() === null) return;
    this.onDragMove(event.clientX, event.clientY);
  }

  @HostListener('window:touchmove', ['$event'])
  onTouchMove(event: TouchEvent) {
    if (this.activeHandle() === null) return;
    if (event.touches && event.touches[0]) {
      this.onDragMove(event.touches[0].clientX, event.touches[0].clientY);
    }
  }

  onDragMove(clientX: number, clientY: number) {
    const activeIdx = this.activeHandle();
    if (activeIdx === null || !this.workspaceContainer) return;

    const rect = this.workspaceContainer.nativeElement.getBoundingClientRect();
    
    let x = (clientX - rect.left) / rect.width;
    let y = (clientY - rect.top) / rect.height;

    x = Math.max(-0.05, Math.min(1.05, x));
    y = Math.max(-0.05, Math.min(1.05, y));

    const updatedCorners = [...this.corners()];
    updatedCorners[activeIdx] = { x, y };
    this.corners.set(updatedCorners);
    
    // Reactive backprop to update state corners list in state service in real-time
    this.cornersChange.emit(updatedCorners);

    this.updateOverlay();
    this.updateMagnifierPosition();
    this.updateMagnifier();
  }

  @HostListener('window:mouseup')
  @HostListener('window:touchend')
  onDragEnd() {
    this.activeHandle.set(null);
  }
}
