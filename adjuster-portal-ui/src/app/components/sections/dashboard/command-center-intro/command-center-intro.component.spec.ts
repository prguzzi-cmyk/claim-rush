import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CommandCenterIntroComponent } from './command-center-intro.component';

describe('CommandCenterIntroComponent', () => {
  let component: CommandCenterIntroComponent;
  let fixture: ComponentFixture<CommandCenterIntroComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [CommandCenterIntroComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(CommandCenterIntroComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
