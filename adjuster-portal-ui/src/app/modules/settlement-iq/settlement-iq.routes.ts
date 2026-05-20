import { Route } from '@angular/router';

import { DataRequestComponent } from './data-request/data-request.component';
import { SettlementIqLayoutComponent } from './layout/settlement-iq-layout.component';
import { ConsultationComponent } from './residential/consultation/consultation.component';
import { DoorComponent } from './residential/door/door.component';
import { ReportComponent } from './residential/report/report.component';
import { UploadComponent } from './residential/upload/upload.component';

/**
 * Lazy-loaded route group for the Settlement IQ public surface.
 *
 * Mounted by app-routing.module.ts via loadChildren at /settlement-iq.
 * Hash routing carries over from the root forRoot config, so URLs look
 * like /#/settlement-iq/residential/upload until the Phase 1.5
 * useHash:false switch.
 */
export const SETTLEMENT_IQ_ROUTES: Route[] = [
  {
    path: '',
    component: SettlementIqLayoutComponent,
    children: [
      { path: '', redirectTo: 'residential', pathMatch: 'full' },
      { path: 'residential', component: DoorComponent },
      { path: 'residential/upload', component: UploadComponent },
      { path: 'residential/report/:scanId', component: ReportComponent },
      {
        path: 'residential/consultation/:scanId',
        component: ConsultationComponent,
      },
      { path: 'data-request', component: DataRequestComponent },
    ],
  },
];
