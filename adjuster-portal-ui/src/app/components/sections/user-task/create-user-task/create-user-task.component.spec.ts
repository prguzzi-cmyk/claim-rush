import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CreateUserTaskComponent } from './create-user-task.component';

describe('CreateUserTaskComponent', () => {
  let component: CreateUserTaskComponent;
  let fixture: ComponentFixture<CreateUserTaskComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ CreateUserTaskComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CreateUserTaskComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
