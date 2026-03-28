import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TitleChangeComponent } from './title-change.component';

describe('MLMTitleChangeComponent', () => {
  let component: TitleChangeComponent;
  let fixture: ComponentFixture<TitleChangeComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ TitleChangeComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TitleChangeComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
