import { TlEventArtworkModule } from './tl-event-artwork.module';

describe('TlEventArtworkModule', () => {
  let tlEventArtworkModule: TlEventArtworkModule;

  beforeEach(() => {
    tlEventArtworkModule = new TlEventArtworkModule();
  });

  it('should create an instance', () => {
    expect(tlEventArtworkModule).toBeTruthy();
  });
});
