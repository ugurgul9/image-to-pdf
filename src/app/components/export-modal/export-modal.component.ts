import { Component, input, output, signal, inject, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { 
  IonSpinner, 
  IonButton, 
  IonIcon
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { 
  documentTextOutline, 
  imageOutline, 
  downloadOutline, 
  arrowBackOutline, 
  refreshOutline, 
  closeOutline, 
  checkmarkOutline 
} from 'ionicons/icons';
import { jsPDF } from 'jspdf';
import { ScanPage } from '../../models/scan.model';

@Component({
  selector: 'app-export-modal',
  templateUrl: './export-modal.component.html',
  styleUrls: ['./export-modal.component.scss'],
  standalone: true,
  imports: [
    CommonModule, 
    FormsModule,
    IonSpinner, 
    IonButton, 
    IonIcon
  ]
})
export class ExportModalComponent {
  pages = input.required<ScanPage[]>();
  isOpen = input.required<boolean>();

  closeModal = output<void>();
  resetRequest = output<void>();

  // PDF Compilation Settings (managed locally in the modal!)
  fileName = signal<string>('');
  pageSize = signal<'borderless' | 'a4' | 'letter'>('borderless');

  // Export Progress State Signals
  isGenerating = signal<boolean>(false);
  exportStep = signal<'processing' | 'success' | 'error'>('processing');
  exportType = signal<'pdf' | 'png'>('pdf');
  compiledPdfUrl = signal<string | null>(null);
  compiledPngUrls = signal<string[]>([]);

  constructor() {
    addIcons({
      documentTextOutline, 
      imageOutline, 
      downloadOutline, 
      arrowBackOutline, 
      refreshOutline, 
      closeOutline, 
      checkmarkOutline
    });

    // Reset default filename with timestamp when modal opens
    effect(() => {
      if (this.isOpen()) {
        const now = new Date();
        const dateStr = now.toISOString().split('T')[0];
        const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '-');
        this.fileName.set(`scan_${dateStr}_${timeStr}`);
        
        // Reset modal steps
        this.exportStep.set('processing');
        this.compiledPdfUrl.set(null);
        this.compiledPngUrls.set([]);
      }
    });
  }

  // Load an image asynchronously
  private loadImageAsync(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.src = src;
      img.onload = () => resolve(img);
      img.onerror = (err) => reject(err);
    });
  }

  // Generate multi-page PDF
  async generatePdf() {
    const activePages = this.pages().filter(p => p.croppedUri !== null);
    if (activePages.length === 0) return;

    this.exportType.set('pdf');
    this.exportStep.set('processing');
    this.isGenerating.set(true);

    try {
      const images = await Promise.all(
        activePages.map(page => this.loadImageAsync(page.croppedUri!))
      );

      let pdf: jsPDF | null = null;

      for (let i = 0; i < activePages.length; i++) {
        const page = activePages[i];
        const img = images[i];
        const width = img.naturalWidth;
        const height = img.naturalHeight;
        const pageOrientation = width > height ? 'l' : 'p';

        if (i === 0) {
          if (this.pageSize() === 'borderless') {
            pdf = new jsPDF({
              orientation: pageOrientation,
              unit: 'px',
              format: [width, height]
            });
            pdf.addImage(page.croppedUri!, 'PNG', 0, 0, width, height, undefined, 'FAST');
          } else {
            const isA4 = this.pageSize() === 'a4';
            const format = isA4 ? 'a4' : 'letter';
            pdf = new jsPDF({
              orientation: pageOrientation,
              unit: 'mm',
              format: format
            });
            this.addPageWithMargins(pdf, page.croppedUri!, width, height);
          }
        } else {
          if (this.pageSize() === 'borderless') {
            pdf!.addPage([width, height], pageOrientation);
            pdf!.addImage(page.croppedUri!, 'PNG', 0, 0, width, height, undefined, 'FAST');
          } else {
            const isA4 = this.pageSize() === 'a4';
            const format = isA4 ? 'a4' : 'letter';
            pdf!.addPage(format, pageOrientation);
            this.addPageWithMargins(pdf!, page.croppedUri!, width, height);
          }
        }
      }

      const finalName = this.fileName().trim() || 'document_scan';
      pdf!.setProperties({
        title: finalName
      });

      const blob = pdf!.output('blob');
      const blobUrl = URL.createObjectURL(blob);
      this.compiledPdfUrl.set(blobUrl);

      this.exportStep.set('success');
      this.isGenerating.set(false);

    } catch (error) {
      console.error('PDF creation failed:', error);
      this.exportStep.set('error');
      this.isGenerating.set(false);
    }
  }

  // Draw scaled document inside template bounds centered with 10mm margins
  private addPageWithMargins(pdf: jsPDF, croppedUri: string, width: number, height: number) {
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const pageMargin = 10;
    
    const maxWidth = pageWidth - (pageMargin * 2);
    const maxHeight = pageHeight - (pageMargin * 2);

    const ratio = Math.min(maxWidth / width, maxHeight / height);
    const finalWidth = width * ratio;
    const finalHeight = height * ratio;

    const x = (pageWidth - finalWidth) / 2;
    const y = (pageHeight - finalHeight) / 2;

    pdf.addImage(croppedUri, 'PNG', x, y, finalWidth, finalHeight, undefined, 'FAST');
  }

  // Download high-resolution individual PNG images sequentially
  async exportImages() {
    const activePages = this.pages().filter(p => p.croppedUri !== null);
    if (activePages.length === 0) return;

    this.exportType.set('png');
    this.exportStep.set('processing');
    this.isGenerating.set(true);

    try {
      const baseName = this.fileName().trim() || 'document_scan';
      const urls: string[] = [];

      for (let i = 0; i < activePages.length; i++) {
        const page = activePages[i];
        if (page.croppedUri) {
          urls.push(page.croppedUri);
        }
        const link = document.createElement('a');
        link.download = `${baseName}_page_${i + 1}.png`;
        link.href = page.croppedUri!;
        link.click();
        
        await new Promise(r => setTimeout(r, 150));
      }

      this.compiledPngUrls.set(urls);
      this.exportStep.set('success');
      this.isGenerating.set(false);

    } catch (err) {
      console.error('Image export failed:', err);
      this.exportStep.set('error');
      this.isGenerating.set(false);
    }
  }

  // Synchronously open the compiled blob URL to prevent popup blocker blocking
  openCompiledFile() {
    if (this.exportType() === 'pdf') {
      const url = this.compiledPdfUrl();
      if (url) {
        window.open(url, '_blank');
      }
    } else {
      const urls = this.compiledPngUrls();
      if (urls.length > 0) {
        window.open(urls[0], '_blank');
      }
    }
  }

  closeExportModal() {
    this.closeModal.emit();
    this.compiledPdfUrl.set(null);
    this.compiledPngUrls.set([]);
  }

  resetAll() {
    this.closeExportModal();
    this.resetRequest.emit();
  }
}
