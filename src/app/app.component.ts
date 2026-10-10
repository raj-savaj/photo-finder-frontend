import { Component } from '@angular/core';
import { SelfieSearchComponent } from './selfie-search/selfie-search.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [SelfieSearchComponent],
  template: `<app-selfie-search />`,
})
export class AppComponent {}
