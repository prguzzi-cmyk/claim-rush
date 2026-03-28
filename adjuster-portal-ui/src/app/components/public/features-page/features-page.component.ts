import { Component } from '@angular/core';

@Component({
  selector: 'app-features-page',
  templateUrl: './features-page.component.html',
  styleUrls: ['./features-page.component.scss'],
  standalone: false,
})
export class FeaturesPageComponent {
  features = [
    {
      icon: 'description',
      title: 'Claims Management',
      description: 'Track every claim from intake through settlement. Manage documents, ledgers, and communications in one centralized hub.',
    },
    {
      icon: 'headset_mic',
      title: 'Lead Pipeline',
      description: 'Capture, qualify, and convert leads with built-in follow-up tracking, source attribution, and approval workflows.',
    },
    {
      icon: 'local_atm',
      title: 'Commission Intelligence',
      description: 'Real-time commission calculations with team hierarchy breakdowns, payment readiness tracking, and simulator tools.',
    },
    {
      icon: 'assessment',
      title: 'Analytics & Insights',
      description: 'Visual dashboards with lead-by-source, claims-by-phase, and conversion metrics. Export reports with one click.',
    },
    {
      icon: 'people_outline',
      title: 'Recruit Management',
      description: 'Build and manage your team hierarchy. Track recruits, title changes, and organizational growth at every level.',
    },
    {
      icon: 'local_fire_department',
      title: 'RIN & Storm Intel',
      description: 'Real-time fire incident monitoring and storm intelligence maps with property damage filtering.',
    },
  ];
}
