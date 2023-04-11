import { Observable } from 'rxjs';
import { Component, ViewChild, ViewEncapsulation, OnInit } from '@angular/core';
import { Validators, FormBuilder, FormGroup } from '@angular/forms';
import { RowClassArgs } from '@progress/kendo-angular-grid';

import {
  AddEvent,
  GridDataResult,
  CellClickEvent,
  CellCloseEvent,
  SaveEvent,
  CancelEvent,
  GridComponent,
  RemoveEvent,
} from '@progress/kendo-angular-grid';
import { State, process } from '@progress/kendo-data-query';

import { Keys } from '@progress/kendo-angular-common';
import { Category, Product } from './model';
import { EditService } from './edit.service';

import { map } from 'rxjs/operators';

@Component({
  selector: 'my-app',
  encapsulation: ViewEncapsulation.None,
  styles: [
    `
          #my-grid tr.gold {
            background-color: #ffc799;
          }

          
          #my-grid tr.red {
            background-color: #ff949d;
        }
    
          #my-grid tr.green {
            background-color: #b2f699;
          }
        `,
  ],
  template: `
        <kendo-grid
            #grid
            id="my-grid"
            [data]="view | async"
            [rowClass]="rowCallback"
            [pageSize]="gridState.take"
            [skip]="gridState.skip"
            [sort]="gridState.sort"
            [pageable]="true"
            [sortable]="true"
            (dataStateChange)="onStateChange($event)"
            (cellClick)="cellClickHandler($event)"
            (cellClose)="cellCloseHandler($event)"
            (cancel)="cancelHandler($event)"
            (save)="saveHandler($event)"
            (remove)="removeHandler($event)"
            (add)="addHandler($event)"
            [navigable]="true"
        >
            <ng-template kendoGridToolbarTemplate>
                <button kendoGridAddCommand>Add new</button>
                <button kendoButton [disabled]="!editService.hasChanges()" (click)="saveChanges(grid)">Save Changes</button>
                <button kendoButton [disabled]="!editService.hasChanges()" (click)="cancelChanges(grid)">Cancel Changes</button>
                <button kendoButton [disabled]="!editService.hasChanges()" (click)="showChangesOnly(grid)">{{ changesOnly ? "Show All" : "Show Changes Only" }}</button>                
            </ng-template>
            <kendo-grid-column field="ProductName" title="Product Name"></kendo-grid-column>
            <kendo-grid-column field="UnitPrice" editor="numeric" title="Price"></kendo-grid-column>
            <kendo-grid-column field="Discontinued" editor="boolean" title="Discontinued"></kendo-grid-column>
            <kendo-grid-column field="UnitsInStock" editor="numeric" title="Units In Stock"></kendo-grid-column>
            <kendo-grid-command-column title="command" [width]="220">
                <ng-template kendoGridCellTemplate let-isNew="isNew" let-dataItem>
                    <button kendoGridRemoveCommand>{{ removeButtonText(dataItem) }}</button>
                    <button class="k-button k-button-md k-button-solid-base" *ngIf=!isNew (click)="cloneItem(dataItem)">Clone</button>
                    <button kendoGridSaveCommand>Add</button>
                    <button kendoGridCancelCommand>Cancel</button>
                </ng-template>
            </kendo-grid-command-column>
        </kendo-grid>
    `,
})
export class AppComponent implements OnInit {
  public view: Observable<GridDataResult>;
  public gridState: State = {
    sort: [ 
        { 
            field: "ProductName", 
            dir:"asc" 
        }
    ],
    skip: 0,
    take: 20,
    filter: undefined
  };

  public changes = {};

  @ViewChild('grid') grid;

  constructor(
    private formBuilder: FormBuilder,
    public editService: EditService
  ) {}

  public changesOnly = false;  

  public ngOnInit(): void {
    this.loadGridData();
  }

  public loadGridData() {

    if (!this.changesOnly) {
      console.log('load grid data - all');
      this.gridState.take = 20;
      this.gridState.filter = undefined;
    }
    else {
      console.log('load grid data - changes only');
      this.gridState.skip = 0;
      this.gridState.take = 10000;
      this.gridState.filter = {
                 logic: "or",
                 filters: [
                   { field: "Changed", operator: "eq", value: true },
                   { field: "Deleted", operator: "eq", value: true },
                   { field: "ProductID", operator: "eq", value: null }
                 ]
        };
    }


    this.view = this.editService.pipe(
      map((data) => process(data, this.gridState))
    );
    this.editService.read();
     
  }

  public removeButtonText(item) {
    return item.Deleted ? 'Restore' : 'Delete';
  }

  public onStateChange(state: State): void {
    this.gridState = state;

    this.editService.read();
  }

  public cellClickHandler(args: CellClickEvent): void {
    if (!args.isEdited) {
      args.sender.editCell(
        args.rowIndex,
        args.columnIndex,
        this.createFormGroup(args.dataItem)
      );
    }
  }

  public cellCloseHandler(args: CellCloseEvent): void {
    const { formGroup, dataItem } = args;

    if (!formGroup.valid) {
      // prevent closing the edited cell if there are invalid values.
      args.preventDefault();
    } else if (formGroup.dirty) {
      if (args.originalEvent && args.originalEvent.keyCode === Keys.Escape) {
        return;
      }

      this.editService.assignValues(dataItem, formGroup.value);
      this.editService.update(dataItem);
    }
  }

  public addHandler(args: AddEvent): void {
    let p = new Product();
    args.sender.addRow(this.createFormGroup(p));
  }

  public cancelHandler(args: CancelEvent): void {
    args.sender.closeRow(args.rowIndex);
  }

  public showChangesOnly(args): void {
      this.changesOnly = !this.changesOnly;
      this.loadGridData();

    //args.sender.closeRow(args.rowIndex);
  }

  public saveHandler(args: SaveEvent): void {
    if (args.formGroup.valid) {
      this.editService.create(args.formGroup.value);
      args.sender.closeRow(args.rowIndex);
    }
  }

  public removeHandler(args: RemoveEvent): void {
    this.editService.remove(args.dataItem);
    args.sender.cancelCell();
  }

  public cloneItem(item) {
    console.log(item);
    let p = new Product();
    p.ProductID = null;
    p.ProductName = item.ProductName;
    p.Discontinued = item.Discontinued;
    p.UnitsInStock = item.UnitsInStock;
    p.UnitPrice = item.UnitPrice;
    if (item.Category) {
      p.Category = {
        CategoryID: item.Category.CategoryID,
        CategoryName: item.Category.CategoryName,
      };
    }
    p.Changed = false;
    p.Deleted = false;

    this.grid.addRow(this.createFormGroup(p));
  }

  public saveChanges(grid: GridComponent): void {
    grid.closeCell();
    grid.cancelCell();

    this.editService.saveChanges();

    this.changesOnly = false;
    this.loadGridData();
  }

  public cancelChanges(grid: GridComponent): void {
    grid.cancelCell();
    this.changesOnly = false;
    this.editService.cancelChanges();
    this.loadGridData();
  }

  public rowCallback = (context: RowClassArgs) => {
    // console.log('Callback');
    // console.log(context.dataItem);

    if (context.dataItem.Deleted) {
      return { red: true };
    } else if (!context.dataItem.ProductID) {
      return { green: true };
    } else if (context.dataItem.Changed) {
      return { gold: true };
    } else {
      return { green: false };
    }
  };

  public createFormGroup(dataItem: Product): FormGroup {
    return this.formBuilder.group({
      ProductID: dataItem.ProductID,
      ProductName: [dataItem.ProductName, Validators.required],
      UnitPrice: dataItem.UnitPrice,
      UnitsInStock: [
        dataItem.UnitsInStock,
        Validators.compose([
          Validators.required,
          Validators.pattern('^[0-9]{1,3}'),
        ]),
      ],
      Discontinued: dataItem.Discontinued,
    });
  }
}
