import { Injectable } from '@angular/core';
import { Point } from '../models/scan.model';

@Injectable({
  providedIn: 'root'
})
export class WarpEngineService {
  
  // Solves A * x = B using Gaussian elimination
  solveMatrix(A: number[][], b: number[]): number[] {
    const n = 8;
    for (let i = 0; i < n; i++) {
      let maxEl = Math.abs(A[i][i]);
      let maxRow = i;
      for (let k = i + 1; k < n; k++) {
        if (Math.abs(A[k][i]) > maxEl) {
          maxEl = Math.abs(A[k][i]);
          maxRow = k;
        }
      }

      for (let k = i; k < n; k++) {
        const tmp = A[maxRow][k];
        A[maxRow][k] = A[i][k];
        A[i][k] = tmp;
      }
      const tmp = b[maxRow];
      b[maxRow] = b[i];
      b[i] = tmp;

      for (let k = i + 1; k < n; k++) {
        const c = -A[k][i] / A[i][i];
        for (let j = i; j < n; j++) {
          if (i === j) {
            A[k][j] = 0;
          } else {
            A[k][j] += c * A[i][j];
          }
        }
        b[k] += c * b[i];
      }
    }

    const x = new Array(n).fill(0);
    for (let i = n - 1; i >= 0; i--) {
      x[i] = b[i] / A[i][i];
      for (let k = i - 1; k >= 0; k--) {
        b[k] -= A[k][i] * x[i];
      }
    }
    return x;
  }

  // Creates the dynamic, asynchronous Web Worker inline script Blob
  createWarpWorker(): Worker {
    const workerCode = `
      self.onmessage = function(e) {
        const { srcPixels, srcW, srcH, dstW, dstH, coeffs, filterType } = e.data;
        const [a, b, c, d, e, f, g, h] = coeffs;
        
        const dstData = new Uint8ClampedArray(dstW * dstH * 4);

        for (let yd = 0; yd < dstH; yd++) {
          for (let xd = 0; xd < dstW; xd++) {
            const denom = g * xd + h * yd + 1;
            const xs = (a * xd + b * yd + c) / denom;
            const ys = (d * xd + e * yd + f) / denom;

            if (xs >= 0 && xs < srcW - 1 && ys >= 0 && ys < srcH - 1) {
              const xFloor = Math.floor(xs);
              const yFloor = Math.floor(ys);
              const xCeil = xFloor + 1;
              const yCeil = yFloor + 1;

              const dx = xs - xFloor;
              const dy = ys - yFloor;

              const idx00 = (yFloor * srcW + xFloor) * 4;
              const idx10 = (yFloor * srcW + xCeil) * 4;
              const idx01 = (yCeil * srcW + xFloor) * 4;
              const idx11 = (yCeil * srcW + xCeil) * 4;

              const idxDst = (yd * dstW + xd) * 4;

              for (let ch = 0; ch < 4; ch++) {
                const c00 = srcPixels[idx00 + ch];
                const c10 = srcPixels[idx10 + ch];
                const c01 = srcPixels[idx01 + ch];
                const c11 = srcPixels[idx11 + ch];

                dstData[idxDst + ch] = 
                  (1 - dx) * (1 - dy) * c00 +
                  dx * (1 - dy) * c10 +
                  (1 - dx) * dy * c01 +
                  dx * dy * c11;
              }

              if (filterType !== 'original') {
                const r = dstData[idxDst];
                const gVal = dstData[idxDst + 1];
                const b = dstData[idxDst + 2];

                if (filterType === 'grayscale') {
                  let gray = 0.299 * r + 0.587 * gVal + 0.114 * b;
                  gray = ((gray - 128) * 1.55) + 128;
                  gray = Math.max(0, Math.min(255, gray));
                  dstData[idxDst] = gray;
                  dstData[idxDst + 1] = gray;
                  dstData[idxDst + 2] = gray;
                } else if (filterType === 'magic') {
                  let nr = ((r - 128) * 1.45) + 128 + 15;
                  let ng = ((gVal - 128) * 1.45) + 128 + 15;
                  let nb = ((b - 128) * 1.45) + 128 + 15;

                  const luma = 0.299 * nr + 0.587 * ng + 0.114 * nb;
                  if (luma > 190) {
                    const offset = (255 - luma) * 0.85;
                    nr = Math.min(255, nr + offset);
                    ng = Math.min(255, ng + offset);
                    nb = Math.min(255, nb + offset);
                  }

                  dstData[idxDst] = Math.max(0, Math.min(255, nr));
                  dstData[idxDst + 1] = Math.max(0, Math.min(255, ng));
                  dstData[idxDst + 2] = Math.max(0, Math.min(255, nb));
                }
              }
            }
          }
        }

        self.postMessage({ dstPixels: dstData }, [dstData.buffer]);
      };
    `;

    const blob = new Blob([workerCode], { type: 'application/javascript' });
    return new Worker(URL.createObjectURL(blob));
  }

  // Run synchronous projective fallback warp
  runWarpSync(
    srcPixels: Uint8ClampedArray,
    srcW: number,
    srcH: number,
    dstW: number,
    dstH: number,
    coeffs: number[],
    filterType: 'original' | 'magic' | 'grayscale',
    dstCanvas: HTMLCanvasElement,
    dstCtx: CanvasRenderingContext2D,
    successCallback: (base64: string) => void
  ) {
    const [a, b, c, d, e, f, g, h] = coeffs;
    const dstData = new Uint8ClampedArray(dstW * dstH * 4);

    for (let yd = 0; yd < dstH; yd++) {
      for (let xd = 0; xd < dstW; xd++) {
        const denom = g * xd + h * yd + 1;
        const xs = (a * xd + b * yd + c) / denom;
        const ys = (d * xd + e * yd + f) / denom;

        if (xs >= 0 && xs < srcW - 1 && ys >= 0 && ys < srcH - 1) {
          const xFloor = Math.floor(xs);
          const yFloor = Math.floor(ys);
          const xCeil = xFloor + 1;
          const yCeil = yFloor + 1;

          const dx = xs - xFloor;
          const dy = ys - yFloor;

          const idx00 = (yFloor * srcW + xFloor) * 4;
          const idx10 = (yFloor * srcW + xCeil) * 4;
          const idx01 = (yCeil * srcW + xFloor) * 4;
          const idx11 = (yCeil * srcW + xCeil) * 4;

          const idxDst = (yd * dstW + xd) * 4;

          for (let ch = 0; ch < 4; ch++) {
            const c00 = srcPixels[idx00 + ch];
            const c10 = srcPixels[idx10 + ch];
            const c01 = srcPixels[idx01 + ch];
            const c11 = srcPixels[idx11 + ch];

            dstData[idxDst + ch] = 
              (1 - dx) * (1 - dy) * c00 +
              dx * (1 - dy) * c10 +
              (1 - dx) * dy * c01 +
              dx * dy * c11;
          }

          if (filterType !== 'original') {
            const r = dstData[idxDst];
            const gVal = dstData[idxDst + 1];
            const b = dstData[idxDst + 2];

            if (filterType === 'grayscale') {
              let gray = 0.299 * r + 0.587 * gVal + 0.114 * b;
              gray = ((gray - 128) * 1.55) + 128;
              gray = Math.max(0, Math.min(255, gray));
              dstData[idxDst] = gray;
              dstData[idxDst + 1] = gray;
              dstData[idxDst + 2] = gray;
            } else if (filterType === 'magic') {
              let nr = ((r - 128) * 1.45) + 128 + 15;
              let ng = ((gVal - 128) * 1.45) + 128 + 15;
              let nb = ((b - 128) * 1.45) + 128 + 15;

              const luma = 0.299 * nr + 0.587 * ng + 0.114 * nb;
              if (luma > 190) {
                const offset = (255 - luma) * 0.85;
                nr = Math.min(255, nr + offset);
                ng = Math.min(255, ng + offset);
                nb = Math.min(255, nb + offset);
              }

              dstData[idxDst] = Math.max(0, Math.min(255, nr));
              dstData[idxDst + 1] = Math.max(0, Math.min(255, ng));
              dstData[idxDst + 2] = Math.max(0, Math.min(255, nb));
            }
          }
        }
      }
    }

    const clampedDst = new ImageData(dstData, dstW, dstH);
    dstCtx.putImageData(clampedDst, 0, 0);

    const croppedBase64 = dstCanvas.toDataURL('image/png');
    successCallback(croppedBase64);
  }

  // Performs perspective homography warping (async Web Worker / sync fallback)
  cropPerspective(
    rawUri: string,
    corners: Point[],
    filter: 'original' | 'magic' | 'grayscale',
    successCallback: (base64: string) => void,
    errorCallback: (err: any) => void
  ) {
    const img = new Image();
    img.src = rawUri;
    img.onerror = (err) => {
      console.error('[Warp Engine] Image preloading failed:', err);
      errorCallback(err);
    };

    img.onload = () => {
      try {
        const srcW = img.naturalWidth;
        const srcH = img.naturalHeight;

        const srcCanvas = document.createElement('canvas');
        srcCanvas.width = srcW;
        srcCanvas.height = srcH;
        const srcCtx = srcCanvas.getContext('2d');
        if (!srcCtx) {
          errorCallback('Canvas context not supported');
          return;
        }
        srcCtx.drawImage(img, 0, 0);

        const ptsSrc: Point[] = corners.map(pt => ({
          x: Math.max(0, Math.min(1, pt.x)) * srcW,
          y: Math.max(0, Math.min(1, pt.y)) * srcH
        }));

        const w0 = Math.hypot(ptsSrc[1].x - ptsSrc[0].x, ptsSrc[1].y - ptsSrc[0].y);
        const w1 = Math.hypot(ptsSrc[2].x - ptsSrc[3].x, ptsSrc[2].y - ptsSrc[3].y);
        const rawDstW = Math.round(Math.max(w0, w1));

        const h0 = Math.hypot(ptsSrc[3].x - ptsSrc[0].x, ptsSrc[3].y - ptsSrc[0].y);
        const h1 = Math.hypot(ptsSrc[2].x - ptsSrc[1].x, ptsSrc[2].y - ptsSrc[1].y);
        const rawDstH = Math.round(Math.max(h0, h1));

        let dstW = rawDstW;
        let dstH = rawDstH;
        const maxDimension = 1600;
        if (dstW > maxDimension || dstH > maxDimension) {
          const ratio = Math.min(maxDimension / dstW, maxDimension / dstH);
          dstW = Math.round(dstW * ratio);
          dstH = Math.round(dstH * ratio);
        }

        const dstCanvas = document.createElement('canvas');
        dstCanvas.width = dstW;
        dstCanvas.height = dstH;
        const dstCtx = dstCanvas.getContext('2d');
        if (!dstCtx) {
          errorCallback('Target canvas context not supported');
          return;
        }

        const ptsDst: Point[] = [
          { x: 0, y: 0 },
          { x: dstW, y: 0 },
          { x: dstW, y: dstH },
          { x: 0, y: dstH }
        ];

        const A: number[][] = [];
        const B: number[] = [];

        for (let i = 0; i < 4; i++) {
          const xs = ptsSrc[i].x;
          const ys = ptsSrc[i].y;
          const xd = ptsDst[i].x;
          const yd = ptsDst[i].y;

          A.push([xd, yd, 1, 0, 0, 0, -xd * xs, -yd * xs]);
          B.push(xs);

          A.push([0, 0, 0, xd, yd, 1, -xd * ys, -yd * ys]);
          B.push(ys);
        }

        const coeffs = this.solveMatrix(A, B);
        const srcData = srcCtx.getImageData(0, 0, srcW, srcH);

        try {
          const worker = this.createWarpWorker();

          worker.onmessage = (e) => {
            const { dstPixels } = e.data;
            const clampedDst = new ImageData(new Uint8ClampedArray(dstPixels), dstW, dstH);
            dstCtx.putImageData(clampedDst, 0, 0);

            const croppedBase64 = dstCanvas.toDataURL('image/png');
            successCallback(croppedBase64);
            worker.terminate();
          };

          worker.onerror = (err) => {
            console.warn('[Warp Engine] Web Worker thread error, running sync fallback:', err);
            worker.terminate();
            this.runWarpSync(srcData.data, srcW, srcH, dstW, dstH, coeffs, filter, dstCanvas, dstCtx, successCallback);
          };

          worker.postMessage({
            srcPixels: srcData.data,
            srcW,
            srcH,
            dstW,
            dstH,
            coeffs,
            filterType: filter
          });

        } catch (workerSetupError) {
          console.warn('[Warp Engine] Worker setup failed, running sync fallback:', workerSetupError);
          setTimeout(() => {
            this.runWarpSync(srcData.data, srcW, srcH, dstW, dstH, coeffs, filter, dstCanvas, dstCtx, successCallback);
          }, 50);
        }

      } catch (error) {
        console.error('[Warp Engine] Perspective warp failed:', error);
        errorCallback(error);
      }
    };
  }
}
