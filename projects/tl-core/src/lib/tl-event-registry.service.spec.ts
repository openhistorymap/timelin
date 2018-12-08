import { TestBed, inject } from '@angular/core/testing';

import { TlEventRegistryService } from './tl-event-registry.service';

describe('TlEventRegistryService', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [TlEventRegistryService]
    });
  });

  it('should be created', inject([TlEventRegistryService], (service: TlEventRegistryService) => {
    expect(service).toBeTruthy();
  }));
});
