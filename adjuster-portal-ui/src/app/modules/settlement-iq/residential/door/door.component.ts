import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { SettlementIqService } from '../../core/settlement-iq.service';

/**
 * Settlement IQ — Door (screen 1). Presentational only. Single CTA
 * routes to /settlement-iq/residential/upload.
 *
 * On init, captures `?rep=<slug>` from the URL (passed by community-
 * landing CTAs) and stores it on the service so the eventual scan
 * submission can attribute it. The Upload screen also reads the
 * param directly to support deep-links that bypass the Door.
 */
@Component({
  selector: 'si-door',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './door.component.html',
  styleUrls: ['./door.component.scss'],
})
export class DoorComponent implements OnInit {
  constructor(
    private readonly route: ActivatedRoute,
    private readonly service: SettlementIqService,
  ) {}

  ngOnInit(): void {
    const rep = this.route.snapshot.queryParamMap.get('rep');
    if (rep) {
      this.service.setReferralRepSlug(rep);
    }
  }
}
