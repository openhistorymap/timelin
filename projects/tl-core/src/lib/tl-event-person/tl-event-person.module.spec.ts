import { TlEventPersonModule } from './tl-event-person.module';

describe('TlEventPersonModule', () => {
  let tlEventPersonModule: TlEventPersonModule;

  beforeEach(() => {
    tlEventPersonModule = new TlEventPersonModule();
  });

  it('should create an instance', () => {
    expect(tlEventPersonModule).toBeTruthy();
  });
});
