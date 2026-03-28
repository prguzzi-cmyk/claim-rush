import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ImportClientsDialogComponent } from './import-clients-dialog.component';

describe('ImportClientsDialogComponent', () => {
  let component: ImportClientsDialogComponent;
  let fixture: ComponentFixture<ImportClientsDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ ImportClientsDialogComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ImportClientsDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
