import { CommonModule } from '@angular/common';
import { TlEventRegistryService } from './tl-event-registry.service';
import { NgModule } from '@angular/core';
import { TlCoreComponent } from './tl-core.component';
import { TlEventComponent } from './tl-event/tl-event.component';
import { MnMetaRegistryService, MnRegistryModule } from '@modalnodes/mn-registry';
import { TlTimelineComponent } from './tl-timeline/tl-timeline.component';

@NgModule({
  imports: [
    CommonModule,
    MnRegistryModule
  ],
  declarations: [TlCoreComponent, TlEventComponent, TlTimelineComponent],
  exports: [TlCoreComponent, TlEventComponent, TlTimelineComponent],
  providers: [TlEventRegistryService],
  entryComponents: [TlEventComponent]
})
export class TlCoreModule {
  constructor(
    private meta: MnMetaRegistryService,
    private evreg: TlEventRegistryService
  ) {
    this.evreg.setDefault(TlEventComponent);
    this.meta.register('tl-events', this.evreg);
  }
}
