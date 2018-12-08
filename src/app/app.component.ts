import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit {
  title = 'app';
  caesar = {};

  constructor(
    private http: HttpClient
  ) { }

  ngOnInit() {
    this.http.get('assets/ohm-p-1.json').subscribe(res => {
      this.caesar = res;
    });
  }

}
