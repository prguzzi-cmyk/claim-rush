import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CreateClientTaskComponent } from './create-client-task.component';

describe('CreateClientTaskComponent', () => {
  let component: CreateClientTaskComponent;
  let fixture: ComponentFixture<CreateClientTaskComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ CreateClientTaskComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CreateClientTaskComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
