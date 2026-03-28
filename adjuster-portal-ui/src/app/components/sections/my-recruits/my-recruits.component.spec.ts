import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MyRecruitsComponent } from './my-recruits.component';

describe('MyTeamComponent', () => {
  let component: MyRecruitsComponent;
  let fixture: ComponentFixture<MyRecruitsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ MyRecruitsComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MyRecruitsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
