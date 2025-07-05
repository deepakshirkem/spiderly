import { Component, EventEmitter, Input, Output } from "@angular/core";
import { CommonModule } from "@angular/common";
import { ButtonModule } from "primeng/button";
import { SplitButtonModule } from "primeng/splitbutton";
import { Subject, Subscription, throttleTime } from "rxjs";
import { Router } from "@angular/router";

@Component({
    selector: 'spiderly-button-base',
    template: ``,
    styles: [],
    imports: [
        CommonModule,
        ButtonModule,
        SplitButtonModule
    ]
})
export class SpiderlyButtonBaseComponent {
  @Input() icon: string;
  @Input() label: string;
  @Input() outlined: boolean = false;
  @Input() rounded: boolean = false;
  @Input() styleClass: string;
  @Input() routerLink: string;
  @Input() style: { [klass: string]: any; };
  @Input() class: string;
  @Input() severity: 'success' | 'info' | 'warn' | 'danger' | 'help' | 'primary' | 'secondary' | 'contrast' | null | undefined;
  @Input() size: 'small' | 'large' | undefined;
  @Input() disabled: boolean = false;

  @Output() onClick = new EventEmitter<Event>();
  private clickSubject = new Subject<Event>(); // Internal subject to handle click events.
  private subscription: Subscription;

  constructor(
    private router: Router
  ) {
      
  }

  ngOnInit(){
    this.subscription = this.clickSubject
        .pipe(throttleTime(500))
        .subscribe((event: Event) => this.onClick.emit(event));
  }

  handleClick = (event: Event) => {
    event.preventDefault();
    event.stopPropagation();
    if (this.routerLink !== undefined) {
      this.router.navigate([this.routerLink]);
    }
    else{
      this.clickSubject.next(event);
    }
  }

  ngOnDestroy() {
    this.subscription.unsubscribe();
  }
}