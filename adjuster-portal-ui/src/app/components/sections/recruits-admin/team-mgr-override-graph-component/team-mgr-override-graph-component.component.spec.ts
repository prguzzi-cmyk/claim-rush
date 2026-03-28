import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TeamMgrOverrideGraphComponentComponent } from './team-mgr-override-graph-component.component';

describe('TeamMgrOverrideGraphComponentComponent', () => {
  let component: TeamMgrOverrideGraphComponentComponent;
  let fixture: ComponentFixture<TeamMgrOverrideGraphComponentComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ TeamMgrOverrideGraphComponentComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TeamMgrOverrideGraphComponentComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
