import { Component, Input } from '@angular/core';
import { ClientClaim, CLAIM_STAGES } from 'src/app/models/client-portal.model';

@Component({
  selector: 'app-cp-claim-overview',
  templateUrl: './cp-claim-overview.component.html',
  styleUrls: ['./cp-claim-overview.component.scss'],
  standalone: false,
})
export class CpClaimOverviewComponent {
  @Input() claim: ClientClaim;
  claimStages = CLAIM_STAGES;

  getStageIndex(stage: string): number {
    return CLAIM_STAGES.findIndex(s => s.key === stage);
  }
}
