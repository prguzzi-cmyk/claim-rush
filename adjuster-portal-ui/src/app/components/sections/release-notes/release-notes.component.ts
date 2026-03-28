import { Component, OnInit } from '@angular/core';
import { TabService } from 'src/app/services/tab.service';

@Component({
    selector: 'app-release-notes',
    templateUrl: './release-notes.component.html',
    styleUrls: ['./release-notes.component.scss'],
    standalone: false
})
export class ReleaseNotesComponent implements OnInit {

  role: any;

  constructor(
    private tabService: TabService,
  ) { 
    this.role = localStorage.getItem('role-name');
  }

  ngOnInit(): void {
  }

  onNavigate(side: string) {
    this.tabService.setSideTitle(side);
  }

}
