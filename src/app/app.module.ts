import { TlEventPersonModule } from '@timelin/tl-core';
import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';
import { HttpClientModule } from '@angular/common/http';

import { AppComponent } from './app.component';
import { TlCoreModule } from '@timelin/tl-core';

@NgModule({
  declarations: [
    AppComponent
  ],
  imports: [
    BrowserModule,
    HttpClientModule,
    TlCoreModule,
    TlEventPersonModule
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
