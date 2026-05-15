import { Component, Input } from '@angular/core';

/**
 * Honest signal that a dashboard is displaying sample / preview data
 * rather than live backend records.
 *
 * Why this exists: large parts of this codebase still seed component
 * arrays with hardcoded fixture rows (fake leads, fake adjusters,
 * fake metrics) as visual placeholders for surfaces whose backend
 * isn't wired yet. Stripping every fixture array would take days; in
 * the meantime, this banner gives expert reviewers an at-a-glance
 * signal of which surfaces are real vs sample so they don't mistake
 * placeholder content for live activity.
 *
 * Usage:
 *   <app-preview-data-banner></app-preview-data-banner>
 *   <app-preview-data-banner label="Sample inspection metrics — live integration pending"></app-preview-data-banner>
 *
 * The banner should be REMOVED from a given page once that page's
 * data source is wired to a real backend and the fixture arrays are
 * stripped. It is a transitional signal, not a permanent UI element.
 */
@Component({
  selector: 'app-preview-data-banner',
  templateUrl: './preview-data-banner.component.html',
  styleUrls: ['./preview-data-banner.component.scss'],
  standalone: false,
})
export class PreviewDataBannerComponent {
  @Input() label: string = 'Sample data shown — live integration pending';
}
