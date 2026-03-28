import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ClientFilesDialogComponent } from './client-files-dialog.component';

describe('ClientFilesDialogComponent', () => {
  let component: ClientFilesDialogComponent;
  let fixture: ComponentFixture<ClientFilesDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ ClientFilesDialogComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ClientFilesDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
