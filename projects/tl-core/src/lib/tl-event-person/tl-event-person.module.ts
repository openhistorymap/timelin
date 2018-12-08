import { TlEventRegistryService } from './../tl-event-registry.service';
import { TlCoreModule } from './../tl-core.module';
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BirthComponent } from './birth/birth.component';
import { DeathComponent } from './death/death.component';

@NgModule({
  imports: [
    CommonModule,
    TlCoreModule
  ],
  declarations: [BirthComponent, DeathComponent],
  exports: [BirthComponent, DeathComponent],
  entryComponents: [BirthComponent, DeathComponent],
})
export class TlEventPersonModule {
  constructor(
    private evt: TlEventRegistryService
  ) {
    this.evt.register('person:birth', BirthComponent);
    this.evt.register('person:death', DeathComponent);
  }
 }
