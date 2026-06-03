import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonIcon } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { arrowBack, arrowForward, trashOutline, addOutline } from 'ionicons/icons';
import { ScanPage } from '../../models/scan.model';

@Component({
  selector: 'app-sheets-carousel',
  templateUrl: './sheets-carousel.component.html',
  styleUrls: ['./sheets-carousel.component.scss'],
  standalone: true,
  imports: [CommonModule, IonIcon]
})
export class SheetsCarouselComponent {
  pages = input.required<ScanPage[]>();
  currentIndex = input.required<number>();

  selectPage = output<number>();
  deletePage = output<number>();
  movePageLeft = output<number>();
  movePageRight = output<number>();
  addPage = output<void>();

  constructor() {
    addIcons({
      arrowBack,
      arrowForward,
      trashOutline,
      addOutline
    });
  }
}
