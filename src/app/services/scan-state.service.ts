import { Injectable, signal, computed, inject } from '@angular/core';
import { Point, ScanPage } from '../models/scan.model';
import { WarpEngineService } from './warp-engine.service';

@Injectable({
  providedIn: 'root'
})
export class ScanStateService {
  private warpEngine = inject(WarpEngineService);
  private readonly DRAFT_STORAGE_KEY = 'docscan_active_draft_session';

  // Writable batch reactive signals
  pages = signal<ScanPage[]>([]);
  currentPageIndex = signal<number>(0);

  // Helper computed signals that resolve the active focused page context
  currentPage = computed(() => {
    const list = this.pages();
    const idx = this.currentPageIndex();
    return list.length > 0 && idx >= 0 && idx < list.length ? list[idx] : null;
  });

  rawImageUri = computed(() => this.currentPage()?.rawUri ?? null);
  croppedImageUri = computed(() => this.currentPage()?.croppedUri ?? null);

  // Draft Auto-Saving System
  saveDraftToStorage() {
    try {
      const draftData = JSON.stringify(this.pages());
      localStorage.setItem(this.DRAFT_STORAGE_KEY, draftData);
    } catch (e) {
      console.warn('Draft auto-save failed:', e);
    }
  }

  loadDraftFromStorage(): 'cropping' | 'preview' | 'welcome' {
    try {
      const draftData = localStorage.getItem(this.DRAFT_STORAGE_KEY);
      if (draftData) {
        const pagesList: ScanPage[] = JSON.parse(draftData);
        if (pagesList.length > 0) {
          this.pages.set(pagesList);
          
          const firstUncroppedIdx = pagesList.findIndex(p => p.croppedUri === null);
          if (firstUncroppedIdx !== -1) {
            this.currentPageIndex.set(firstUncroppedIdx);
            return 'cropping';
          } else {
            this.currentPageIndex.set(0);
            return 'preview';
          }
        }
      }
    } catch (e) {
      console.warn('Draft recovery failed:', e);
    }
    return 'welcome';
  }

  clearDraftFromStorage() {
    try {
      localStorage.removeItem(this.DRAFT_STORAGE_KEY);
    } catch (e) {
      console.warn('Clear draft failed:', e);
    }
  }

  // Add captured page to active document batch lists
  addNewScanPage(uri: string, appState: 'welcome' | 'cropping' | 'preview' = 'cropping') {
    const id = `page_${Date.now()}`;
    const defaultCorners = [
      { x: 0.15, y: 0.15 },
      { x: 0.85, y: 0.15 },
      { x: 0.85, y: 0.85 },
      { x: 0.15, y: 0.85 }
    ];

    const newPage: ScanPage = {
      id,
      rawUri: uri,
      croppedUri: null,
      corners: defaultCorners,
      filter: 'original'
    };

    // If currently in cropping view, perform background auto-crop on the page we are leaving before updating active page index
    if (appState === 'cropping') {
      const activeIdx = this.currentPageIndex();
      const list = this.pages();
      if (activeIdx >= 0 && activeIdx < list.length) {
        this.cropPageInBackground(activeIdx);
      }
    }

    const currentPages = [...this.pages(), newPage];
    this.pages.set(currentPages);
    this.currentPageIndex.set(currentPages.length - 1);
    this.saveDraftToStorage();
  }

  // Interactive reordering actions
  movePageLeft(index: number) {
    if (index <= 0) return;
    this.pages.update(list => {
      const newList = [...list];
      const temp = newList[index];
      newList[index] = newList[index - 1];
      newList[index - 1] = temp;
      return newList;
    });
    
    if (this.currentPageIndex() === index) {
      this.selectCurrentPage(index - 1, true);
    } else if (this.currentPageIndex() === index - 1) {
      this.selectCurrentPage(index, true);
    }
    this.saveDraftToStorage();
  }

  movePageRight(index: number) {
    const listLen = this.pages().length;
    if (index >= listLen - 1) return;
    this.pages.update(list => {
      const newList = [...list];
      const temp = newList[index];
      newList[index] = newList[index + 1];
      newList[index + 1] = temp;
      return newList;
    });

    if (this.currentPageIndex() === index) {
      this.selectCurrentPage(index + 1, true);
    } else if (this.currentPageIndex() === index + 1) {
      this.selectCurrentPage(index, true);
    }
    this.saveDraftToStorage();
  }

  // Select current focused page
  selectCurrentPage(index: number, skipBackgroundCrop = false, appState: 'welcome' | 'cropping' | 'preview' = 'preview') {
    const list = this.pages();
    if (index >= 0 && index < list.length) {
      if (appState === 'cropping' && !skipBackgroundCrop) {
        const activeIdx = this.currentPageIndex();
        if (activeIdx !== index && activeIdx >= 0 && activeIdx < list.length) {
          this.cropPageInBackground(activeIdx);
        }
      }

      this.currentPageIndex.set(index);
    }
  }

  // Remove page from current batch
  deletePage(index: number, appState: 'welcome' | 'cropping' | 'preview' = 'preview', onClearCallback: () => void) {
    const list = this.pages();
    if (list.length === 0) return;

    const newList = list.filter((_, idx) => idx !== index);
    this.pages.set(newList);

    if (newList.length === 0) {
      onClearCallback();
    } else {
      const nextIndex = Math.max(0, Math.min(newList.length - 1, index - 1));
      this.selectCurrentPage(nextIndex, true, appState);
      this.saveDraftToStorage();
    }
  }

  // Silent background perspective crop that does not change state or trigger navigation
  cropPageInBackground(idxToCrop: number) {
    const list = this.pages();
    if (idxToCrop < 0 || idxToCrop >= list.length) return;
    
    const page = list[idxToCrop];
    const rawUri = page.rawUri;
    if (!rawUri) return;

    const cornersToUse = [...page.corners];
    const filterToUse = page.filter;

    this.warpEngine.cropPerspective(
      rawUri,
      cornersToUse,
      filterToUse,
      (croppedBase64) => {
        this.pages.update(pagesList => {
          const newList = [...pagesList];
          if (newList[idxToCrop]) {
            newList[idxToCrop] = {
              ...newList[idxToCrop],
              croppedUri: croppedBase64
            };
          }
          return newList;
        });
        this.saveDraftToStorage();
      },
      (err) => {
        console.error(`[Background Crop] Failed for page ${idxToCrop}:`, err);
      }
    );
  }

  reset() {
    this.pages.set([]);
    this.currentPageIndex.set(0);
    this.clearDraftFromStorage();
  }
}
