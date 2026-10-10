import {
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  ViewChild,
  inject,
  signal,
} from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FaceMatch, FaceSearchService } from '../face-search.service';

type Stage = 'start' | 'camera' | 'preview' | 'searching' | 'results';

@Component({
  selector: 'app-selfie-search',
  standalone: true,
  templateUrl: './selfie-search.component.html',
  styleUrl: './selfie-search.component.css',
})
export class SelfieSearchComponent implements OnDestroy {
  private api = inject(FaceSearchService);

  stage = signal<Stage>('start');
  error = signal<string | null>(null);
  selfieUrl = signal<string | null>(null);
  results = signal<FaceMatch[]>([]);
  open = signal<FaceMatch | null>(null);

  private stream: MediaStream | null = null;
  private video?: HTMLVideoElement;
  private selfieBlob: Blob | null = null;

  // Runs whenever the <video> element appears in the view; attaches the camera stream.
  @ViewChild('video')
  set videoRef(el: ElementRef<HTMLVideoElement> | undefined) {
    this.video = el?.nativeElement;
    if (this.video && this.stream) {
      this.video.srcObject = this.stream;
      this.video.play().catch(() => {});
    }
  }

  async startCamera(): Promise<void> {
    this.error.set(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      this.error.set('This browser can’t open the camera here. Upload a photo instead.');
      return;
    }
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 960 } },
        audio: false,
      });
      this.stage.set('camera');
    } catch {
      this.error.set('Camera access was blocked. Allow the camera in your browser settings, or upload a photo instead.');
    }
  }

  async capture(): Promise<void> {
    const v = this.video;
    if (!v || !v.videoWidth) return;

    const canvas = document.createElement('canvas');
    canvas.width = v.videoWidth;
    canvas.height = v.videoHeight;
    canvas.getContext('2d')!.drawImage(v, 0, 0);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', 0.92),
    );
    if (!blob) {
      this.error.set('Couldn’t capture the photo. Try again.');
      return;
    }
    this.useSelfie(blob);
    this.stopCamera();
  }

  onFilePicked(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      this.error.set('Pick an image file, such as a JPG or PNG.');
      return;
    }
    this.error.set(null);
    this.stopCamera();
    this.useSelfie(file);
  }

  findPhotos(): void {
    if (!this.selfieBlob) return;
    this.error.set(null);
    this.stage.set('searching');

    this.api.search(this.selfieBlob).subscribe({
      next: (res) => {
        this.results.set(res.results);
        this.stage.set('results');
      },
      error: (err: HttpErrorResponse) => {
        const detail = typeof err.error?.detail === 'string' ? err.error.detail : null;
        this.error.set(
          detail ??
            (err.status === 0
              ? 'Can’t reach the photo server. Check your connection and try again.'
              : 'Search failed. Try again in a moment.'),
        );
        this.stage.set('preview');
      },
    });
  }

  retake(): void {
    this.clearSelfie();
    this.results.set([]);
    this.startCamera();
  }

  startOver(): void {
    this.stopCamera();
    this.clearSelfie();
    this.results.set([]);
    this.error.set(null);
    this.stage.set('start');
  }

  thumb(m: FaceMatch, size = 400): string {
    return this.api.thumbnailUrl(m.fileId, size);
  }

  onThumbError(event: Event): void {
    (event.target as HTMLImageElement).classList.add('broken');
  }

  @HostListener('document:keydown.escape')
  closeViewer(): void {
    this.open.set(null);
  }

  ngOnDestroy(): void {
    this.stopCamera();
    this.clearSelfie();
  }

  private useSelfie(blob: Blob): void {
    this.clearSelfie();
    this.selfieBlob = blob;
    this.selfieUrl.set(URL.createObjectURL(blob));
    this.stage.set('preview');
  }

  private clearSelfie(): void {
    const url = this.selfieUrl();
    if (url) URL.revokeObjectURL(url);
    this.selfieUrl.set(null);
    this.selfieBlob = null;
  }

  private stopCamera(): void {
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    if (this.video) this.video.srcObject = null;
  }
}
