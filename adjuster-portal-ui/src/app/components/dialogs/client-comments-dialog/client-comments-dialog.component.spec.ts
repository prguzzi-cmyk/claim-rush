import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ClientCommentsDialogComponent } from './client-comments-dialog.component';

describe('ClientCommentsDialogComponent', () => {
  let component: ClientCommentsDialogComponent;
  let fixture: ComponentFixture<ClientCommentsDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ ClientCommentsDialogComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ClientCommentsDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
