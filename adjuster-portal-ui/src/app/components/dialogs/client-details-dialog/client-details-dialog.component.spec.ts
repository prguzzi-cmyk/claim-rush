import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ClientDetailsDialogComponent } from './client-details-dialog.component';

describe('ClientDetailsDialogComponent', () => {
  let component: ClientDetailsDialogComponent;
  let fixture: ComponentFixture<ClientDetailsDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ ClientDetailsDialogComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ClientDetailsDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
