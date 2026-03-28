import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ClientBulkFilesDialogComponent } from './client-bulk-files-dialog.component';

describe('ClientBulkFilesDialogComponent', () => {
  let component: ClientBulkFilesDialogComponent;
  let fixture: ComponentFixture<ClientBulkFilesDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ ClientBulkFilesDialogComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ClientBulkFilesDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
