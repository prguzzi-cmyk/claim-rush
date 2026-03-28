import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ImportantLinksComponent } from './important-links.component';

describe('ImportantLinksComponent', () => {
  let component: ImportantLinksComponent;
  let fixture: ComponentFixture<ImportantLinksComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ ImportantLinksComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ImportantLinksComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
