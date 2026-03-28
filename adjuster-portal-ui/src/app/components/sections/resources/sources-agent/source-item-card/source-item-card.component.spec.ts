import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SourceItemCardComponent } from './source-item-card.component';

describe('SourceItemCardComponent', () => {
  let component: SourceItemCardComponent;
  let fixture: ComponentFixture<SourceItemCardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ SourceItemCardComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SourceItemCardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
