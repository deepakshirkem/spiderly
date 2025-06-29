import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { BaseControl } from '../base-control';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { RequiredComponent } from '../../components/required/required.component';
import { TranslocoService } from '@jsverse/transloco';
import { CheckboxChangeEvent, CheckboxModule } from 'primeng/checkbox';
import { TooltipModule } from 'primeng/tooltip';

@Component({
    selector: 'spiderly-checkbox',
    templateUrl: './spiderly-checkbox.component.html',
    styleUrl: './spiderly-checkbox.component.scss',
    imports: [
        CommonModule,
        ReactiveFormsModule,
        FormsModule,
        CheckboxModule,
        TooltipModule,
        RequiredComponent
    ]
})
export class SpiderlyCheckboxComponent extends BaseControl implements OnInit {
    @Input() fakeLabel = true;
    @Input() initializeToFalse = false;
    @Input() inlineLabel = false;
    @Output() onChange = new EventEmitter<CheckboxChangeEvent>();

    constructor(
        protected override translocoService: TranslocoService,
    ) { 
        super(translocoService);
    }

     override ngOnInit(){
        if (this.initializeToFalse == true)
            this.control.setValue(false);

        super.ngOnInit();
    }

    change = (event: CheckboxChangeEvent) => {
        this.onChange.next(event);
    }
}
