import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CampaignBuilderComponent } from './campaign-builder.component';

describe('CampaignBuilderComponent', () => {
  let component: CampaignBuilderComponent;
  let fixture: ComponentFixture<CampaignBuilderComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [CampaignBuilderComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(CampaignBuilderComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
