import { TestBed, inject } from '@angular/core/testing';

import { TlEventService } from './tl-event.service';

describe('TlEventService', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [TlEventService]
    });
  });

  it('should be created', inject([TlEventService], (service: TlEventService) => {
    expect(service).toBeTruthy();
  }));
});
