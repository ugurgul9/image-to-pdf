export interface Point {
  x: number;
  y: number;
}

export interface ScanPage {
  id: string;
  rawUri: string;
  croppedUri: string | null;
  corners: Point[];
  filter: 'original' | 'magic' | 'grayscale';
}
