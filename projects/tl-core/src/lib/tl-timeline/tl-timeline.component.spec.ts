import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { TlTimelineComponent } from './tl-timeline.component';

describe('TlTimelineComponent', () => {
  let component: TlTimelineComponent;
  let fixture: ComponentFixture<TlTimelineComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ TlTimelineComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(TlTimelineComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
