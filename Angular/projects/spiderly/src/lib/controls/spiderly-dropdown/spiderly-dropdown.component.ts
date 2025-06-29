import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { RequiredComponent } from '../../components/required/required.component';
import { BaseDropdownControl } from '../base-dropdown-control';
import { TranslocoService } from '@jsverse/transloco';
import { DropdownChangeEvent } from 'primeng/dropdown';
import { SelectModule } from 'primeng/select';
import { TooltipModule } from 'primeng/tooltip';

@Component({
    selector: 'spiderly-dropdown',
    templateUrl: './spiderly-dropdown.component.html',
    styles: [],
    imports: [
        ReactiveFormsModule,
        FormsModule,
        SelectModule,
        TooltipModule,
        CommonModule,
        RequiredComponent,
    ]
})
export class SpiderlyDropdownComponent extends BaseDropdownControl implements OnInit {
    @Input() isBooleanPicker: boolean = false;
    @Output() onChange = new EventEmitter<DropdownChangeEvent>();

    constructor(
        protected override translocoService: TranslocoService,
    ) { 
        super(translocoService);
    }

    override ngOnInit(){
        if (this.isBooleanPicker) {
            this.options = [
                {label: this.translocoService.translate('True'), code: true},
                {label: this.translocoService.translate('False'), code: false},
                {label: this.translocoService.translate('Empty'), code: null},
            ]
        }

        super.ngOnInit();
    }

    change(event: DropdownChangeEvent){
        this.onChange.next(event);
    }

}
