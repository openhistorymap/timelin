import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { TlEventComponent } from './tl-event.component';

describe('TlEventComponent', () => {
  let component: TlEventComponent;
  let fixture: ComponentFixture<TlEventComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ TlEventComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(TlEventComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
