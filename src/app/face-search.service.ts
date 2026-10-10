import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../environments/environment';

export interface FaceMatch {
  fileId: string;
  fileName: string;
  score: number;
}

export interface SearchResponse {
  count: number;
  facesInSelfie: number;
  results: FaceMatch[];
}

@Injectable({ providedIn: 'root' })
export class FaceSearchService {
  private http = inject(HttpClient);
  private base = environment.apiUrl;

  search(selfie: Blob): Observable<SearchResponse> {
    const form = new FormData();
    form.append('file', selfie, 'selfie.jpg');
    return this.http.post<SearchResponse>(`${this.base}/api/search`, form);
  }

  thumbnailUrl(fileId: string, size = 400): string {
    return `${this.base}/api/thumbnail/${encodeURIComponent(fileId)}?size=${size}`;
  }
}
