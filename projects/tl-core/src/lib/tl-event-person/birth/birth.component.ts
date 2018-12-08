import { Component, OnInit } from '@angular/core';

@Component({
  selector: 'lib-birth',
  templateUrl: './birth.component.html',
  styleUrls: ['./birth.component.css']
})
export class BirthComponent implements OnInit {

  data;

  hasField(fname: string, data: [{key, value}]) {
    let ret = false;
    data.forEach(el => {
      if (el.key === fname) {
        ret = true;
      }
    });
    return ret;
  }

  getField(fname: string, data: [{key, value}]) {
    let ret = false;
    data.forEach(el => {
      if (el.key === fname) {
        ret = el.value;
      }
    });
    return ret;
  }

  constructor() { }

  ngOnInit() {
  }

}
