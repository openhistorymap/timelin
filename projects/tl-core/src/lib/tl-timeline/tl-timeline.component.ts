import { Component, OnInit, Input } from '@angular/core';

@Component({
  selector: 'tl-timeline',
  templateUrl: './tl-timeline.component.html',
  styleUrls: ['./tl-timeline.component.css']
})
export class TlTimelineComponent implements OnInit {

  @Input() public tlfor: any;

  constructor() { }

  ngOnInit() {
  }

}
