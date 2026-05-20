import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

/**
 * Settlement IQ — Door (screen 1). Presentational only. Single CTA
 * routes to /settlement-iq/residential/upload.
 */
@Component({
  selector: 'si-door',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './door.component.html',
  styleUrls: ['./door.component.scss'],
})
export class DoorComponent {}
