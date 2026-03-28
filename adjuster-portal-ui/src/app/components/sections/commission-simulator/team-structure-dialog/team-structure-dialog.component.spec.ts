import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TeamStructureDialogComponent } from './team-structure-dialog.component';

describe('TeamStructureDialogComponent', () => {
  let component: TeamStructureDialogComponent;
  let fixture: ComponentFixture<TeamStructureDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ TeamStructureDialogComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TeamStructureDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
