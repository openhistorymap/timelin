import { TestBed, inject } from '@angular/core/testing';

import { TlCoreService } from './tl-core.service';

describe('TlCoreService', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [TlCoreService]
    });
  });

  it('should be created', inject([TlCoreService], (service: TlCoreService) => {
    expect(service).toBeTruthy();
  }));
});
