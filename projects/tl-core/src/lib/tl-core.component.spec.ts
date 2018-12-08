import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { TlCoreComponent } from './tl-core.component';

describe('TlCoreComponent', () => {
  let component: TlCoreComponent;
  let fixture: ComponentFixture<TlCoreComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ TlCoreComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(TlCoreComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
