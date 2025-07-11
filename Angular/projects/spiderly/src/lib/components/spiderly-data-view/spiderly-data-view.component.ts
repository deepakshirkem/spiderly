import { Component, ContentChild, EventEmitter, Inject, Input, LOCALE_ID, OnInit, Output, TemplateRef, ViewChild } from '@angular/core';
import { Table, TableFilterEvent, TableLazyLoadEvent, TableModule } from 'primeng/table';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Observable } from 'rxjs';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { SpiderlyControlsModule } from '../../controls/spiderly-controls.module';
import { PaginatedResult } from '../../entities/paginated-result';
import { Filter } from '../../entities/filter';
import { TooltipModule } from 'primeng/tooltip';
import { ButtonModule } from 'primeng/button';
import { MultiSelectModule } from 'primeng/multiselect';
import { CheckboxModule } from 'primeng/checkbox';
import { MatchModeCodes } from '../../enums/match-mode-enum-codes';
import { Action } from '../spiderly-data-table/spiderly-data-table.component';
import { SelectItem } from 'primeng/api';
import { DatePickerModule } from 'primeng/datepicker';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { SelectModule } from 'primeng/select';
import { BaseEntity } from '../../entities/base-entity';
import { PrimengOption } from '../../entities/primeng-option';

@Component({
    selector: 'spiderly-data-view',
    templateUrl: './spiderly-data-view.component.html',
    styleUrl: 'spiderly-data-view.component.scss',
    imports: [
        FormsModule,
        CommonModule,
        TranslocoDirective,
        SpiderlyControlsModule,
        TableModule,
        ButtonModule,
        MultiSelectModule,
        CheckboxModule,
        TooltipModule,
        DatePickerModule,
        InputTextModule,
        InputNumberModule,
        SelectModule,
    ]
})
export class SpiderlyDataViewComponent<T> implements OnInit {
  @ViewChild('dt') table: Table;
  /**
   * List of items in the table.
   * Should be provided only when `hasLazyLoad === false`.
  */
  @Input() items: T[];
  @Input() rows: number = 10;
  @Input() filters: DataViewFilter<T>[] = [];
  totalRecords: number;
  @Output() onLazyLoad: EventEmitter<Filter> = new EventEmitter();

  @Input() showCardWrapper: boolean = true;
  /**
   * Whether to display additional data on the right side of the paginator.
   * Defaults to `false`.
   */
  @Input() showPaginatorRightData: boolean = false;
  @Input() showTotalRecordsNumber: boolean = false;
  @Input() applyFiltersIcon: string = 'pi pi-filter';
  @Input() clearFiltersIcon: string = 'pi pi-filter-slash';
  
  @Input() getPaginatedListObservableMethod: (filter: Filter) => Observable<PaginatedResult>;

  lastLazyLoadEvent: TableLazyLoadEvent;
  loading: boolean = true;

  matchModeDateOptions: SelectItem[] = [];
  matchModeNumberOptions: SelectItem[] = [];
  
  @ContentChild('cardBody', { read: TemplateRef }) cardBody!: TemplateRef<any>;

  constructor(
    private translocoService: TranslocoService,
    @Inject(LOCALE_ID) private locale: string
  ) {}

  ngOnInit(): void {
    this.matchModeDateOptions = [
      { label: this.translocoService.translate('OnDate'), value: MatchModeCodes.Equals },
      { label: this.translocoService.translate('DatesBefore'), value: MatchModeCodes.LessThan },
      { label: this.translocoService.translate('DatesAfter'), value: MatchModeCodes.GreaterThan },
    ];

    this.matchModeNumberOptions = [
      { label: this.translocoService.translate('Equals'), value: MatchModeCodes.Equals },
      { label: this.translocoService.translate('LessThan'), value: MatchModeCodes.LessThan },
      { label: this.translocoService.translate('MoreThan'), value: MatchModeCodes.GreaterThan },
    ];
  }
  
  lazyLoad(event: TableLazyLoadEvent) {
    this.lastLazyLoadEvent = event;
    
    const transformedFilter: { [K in keyof T]?: { value: any; matchMode: MatchModeCodes }[] } = {};

    for (const key in event.filters) {
      const filterMeta = event.filters[key];

      if (Array.isArray(filterMeta)) {
        transformedFilter[key] = filterMeta;
      } 
      else {
        transformedFilter[key] = [{
          value: filterMeta.value,
          matchMode: filterMeta.matchMode
        }];
      }
    }

    let tableFilter = event as unknown as Filter<T>;

    tableFilter.filters = transformedFilter;

    this.onLazyLoad.next(tableFilter);
    
    this.getPaginatedListObservableMethod(tableFilter).subscribe({
      next: async (res) => { 
        this.items = res.data;
        this.totalRecords = res.totalRecords;

        this.loading = false;
      },
      error: () => {
        this.loading = false;
      },
    });
  }

  filter(event: TableFilterEvent){
  }
  
  getDefaultMatchMode(filterType: string): any {
    switch (filterType) {
        case 'text':
          return MatchModeCodes.Contains;
        case 'date':
          return MatchModeCodes.Equals;
        case 'multiselect':
          return MatchModeCodes.In;
        case 'boolean':
          return MatchModeCodes.Equals;
        case 'numeric':
          return MatchModeCodes.Equals
        default:
          return null;
      }
  }

  getMatchModeOptions(filterType: string){
    switch (filterType) {
        case 'text':
          return [];
        case 'date':
          return this.matchModeDateOptions;
        case 'multiselect':
          return [];
        case 'boolean':
          return [];
        case 'numeric':
          return this.matchModeNumberOptions;
        default:
          return [];
      }
  }

  reload(){
    this.loading = true;
    this.items = null;
    this.lazyLoad(this.lastLazyLoadEvent);
  }

  colTrackByFn(index, item){
    return item.field;
  }

  actionTrackByFn(index, item: Action){
    return `${index}${item.field}`
  }

  applyFilters = () => {
    this.table._filter();
  }

  clearFilters() {
    this.table.clear();
  }
}

export interface DataViewCardBody<T> {
  $implicit: T;
  item: T;
  index: number;
}

export interface DataViewFilter<T extends BaseEntity> {
  label?: string;
  field?: string & keyof T;
  filterField?: string & keyof T; // Made specificaly for multiautocomplete, maybe for something more in the future
  type?: 'text' | 'date' | 'multiselect' | 'boolean' | 'numeric' | 'blob';
  placeholder?: string;
  showMatchModes?: boolean;
  dropdownOrMultiselectValues?: PrimengOption[];
}