import { Component, ElementRef, ViewChild, signal, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { 
  IonHeader, 
  IonToolbar, 
  IonTitle, 
  IonContent, 
  IonButton, 
  IonButtons, 
  IonIcon, 
  IonRow, 
  IonCol,
  IonSpinner,
  IonSegment,
  IonSegmentButton,
  IonLabel
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { 
  cameraOutline, 
  imageOutline, 
  cropOutline, 
  downloadOutline, 
  refreshOutline, 
  arrowBackOutline, 
  documentTextOutline, 
  closeOutline,
  checkmarkOutline,
  addOutline,
  trashOutline,
  arrowBack,
  arrowForward
} from 'ionicons/icons';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { ScanStateService } from '../services/scan-state.service';
import { WarpEngineService } from '../services/warp-engine.service';
import { PerspectiveCropperComponent } from '../components/perspective-cropper/perspective-cropper.component';
import { SheetsCarouselComponent } from '../components/sheets-carousel/sheets-carousel.component';
import { ExportModalComponent } from '../components/export-modal/export-modal.component';
import { Point } from '../models/scan.model';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    IonHeader, 
    IonToolbar, 
    IonTitle, 
    IonContent, 
    IonButton, 
    IonButtons, 
    IonIcon, 
    IonRow, 
    IonCol,
    IonSpinner,
    IonSegment,
    IonSegmentButton,
    IonLabel,
    PerspectiveCropperComponent,
    SheetsCarouselComponent,
    ExportModalComponent
  ]
})
export class HomePage implements OnInit {
  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('exportModal') exportModal!: ExportModalComponent;

  // Singletons injection
  scanService = inject(ScanStateService);
  warpEngine = inject(WarpEngineService);

  // Shell Layout State signals
  appState = signal<'welcome' | 'cropping' | 'preview'>('welcome');
  isExportOpen = signal<boolean>(false);
  isGenerating = signal<boolean>(false);

  // PDF Configuration settings synced to modal
  fileName = signal<string>('');
  pageSize = signal<'borderless' | 'a4' | 'letter'>('borderless');

  constructor() {
    addIcons({
      cameraOutline, 
      imageOutline, 
      cropOutline, 
      downloadOutline, 
      refreshOutline, 
      arrowBackOutline, 
      documentTextOutline, 
      closeOutline,
      checkmarkOutline,
      addOutline,
      trashOutline,
      arrowBack,
      arrowForward
    });
  }

  ngOnInit() {
    const recoveredState = this.scanService.loadDraftFromStorage();
    this.appState.set(recoveredState);
    this.setDefaultFileName();
  }

  private setDefaultFileName() {
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '-');
    this.fileName.set(`scan_${dateStr}_${timeStr}`);
  }

  // Camera integration using native Capacitor
  async captureImage(source: 'camera' | 'photos') {
    try {
      const image = await Camera.getPhoto({
        quality: 90,
        allowEditing: false,
        resultType: CameraResultType.Uri,
        source: source === 'camera' ? CameraSource.Camera : CameraSource.Photos
      });

      if (image && image.webPath) {
        this.scanService.addNewScanPage(image.webPath, this.appState());
        this.appState.set('cropping');
      }
    } catch (error) {
      console.warn('Capacitor camera failed, trying file input fallback:', error);
      this.triggerFileSelect();
    }
  }

  triggerFileSelect() {
    this.fileInput.nativeElement.click();
  }

  // Web input standard fallback handler
  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result) {
          this.scanService.addNewScanPage(e.target.result as string, this.appState());
          this.appState.set('cropping');
        }
      };
      reader.readAsDataURL(file);
    }
  }

  // React to draggable corners update from cropper component
  onCornersUpdated(corners: Point[]) {
    const activeIdx = this.scanService.currentPageIndex();
    this.scanService.pages.update(list => {
      const newList = [...list];
      if (newList[activeIdx]) {
        newList[activeIdx] = {
          ...newList[activeIdx],
          corners: corners
        };
      }
      return newList;
    });
    this.scanService.saveDraftToStorage();
  }

  // Foreground active manual homography crop
  cropPerspective() {
    const rawUri = this.scanService.rawImageUri();
    if (!rawUri) return;

    this.isGenerating.set(true);

    const activeIdx = this.scanService.currentPageIndex();
    const activePage = this.scanService.currentPage()!;

    this.warpEngine.cropPerspective(
      rawUri,
      activePage.corners,
      activePage.filter,
      (croppedBase64) => {
        this.scanService.pages.update(list => {
          const newList = [...list];
          if (newList[activeIdx]) {
            newList[activeIdx] = {
              ...newList[activeIdx],
              croppedUri: croppedBase64
            };
          }
          return newList;
        });

        this.scanService.saveDraftToStorage();
        this.isGenerating.set(false);

        if (this.appState() === 'preview') {
          return;
        }

        // Proceed to next page or preview workspace
        const nextIdx = activeIdx + 1;
        const currentList = this.scanService.pages();
        const isRecropAdjustment = nextIdx < currentList.length && currentList[nextIdx].croppedUri !== null;
        
        if (nextIdx < currentList.length && !isRecropAdjustment) {
          this.scanService.selectCurrentPage(nextIdx, true, this.appState());
        } else {
          this.appState.set('preview');
        }
      },
      (err) => {
        console.error('[Warp Engine] Active homography crop failed:', err);
        this.isGenerating.set(false);
      }
    );
  }

  // Filter preset selection
  updatePageFilter(preset: 'original' | 'magic' | 'grayscale') {
    const activeIdx = this.scanService.currentPageIndex();
    this.scanService.pages.update(list => {
      const newList = [...list];
      if (newList[activeIdx]) {
        newList[activeIdx] = {
          ...newList[activeIdx],
          filter: preset
        };
      }
      return newList;
    });
    this.scanService.saveDraftToStorage();

    // Re-warp active sheet to apply new filter preset dynamically
    this.cropPerspective();
  }

  // PDF Multi-page compile
  generatePdf() {
    this.isExportOpen.set(true);
    setTimeout(() => {
      if (this.exportModal) {
        this.exportModal.fileName.set(this.fileName());
        this.exportModal.pageSize.set(this.pageSize());
        this.exportModal.generatePdf();
      }
    });
  }

  // Images batch download
  exportImages() {
    this.isExportOpen.set(true);
    setTimeout(() => {
      if (this.exportModal) {
        this.exportModal.fileName.set(this.fileName());
        this.exportModal.exportImages();
      }
    });
  }

  // Back to cropping workspace
  backToCropping() {
    this.appState.set('cropping');
  }

  // Complete reset to clean welcome state
  reset() {
    this.scanService.reset();
    this.isExportOpen.set(false);
    this.appState.set('welcome');
  }
}
