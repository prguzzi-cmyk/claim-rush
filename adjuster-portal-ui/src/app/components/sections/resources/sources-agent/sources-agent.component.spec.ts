import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SourcesAgentComponent } from './sources-agent.component';

describe('SourcesAgentComponent', () => {
  let component: SourcesAgentComponent;
  let fixture: ComponentFixture<SourcesAgentComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ SourcesAgentComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SourcesAgentComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
