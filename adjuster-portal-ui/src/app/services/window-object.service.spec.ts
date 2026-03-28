import { TestBed } from '@angular/core/testing';

import { WindowObjectService } from './window-object.service';

describe('WindowObjectService', () => {
  let service: WindowObjectService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(WindowObjectService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
