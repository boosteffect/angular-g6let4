import { Observable } from 'rxjs';
import { Component, OnInit } from '@angular/core';
import { Validators, FormBuilder, FormGroup } from '@angular/forms';

import {
    AddEvent,
    GridDataResult,
    CellClickEvent,
    CellCloseEvent,
    SaveEvent,
    CancelEvent,
    GridComponent,
    RemoveEvent
} from '@progress/kendo-angular-grid';
import { State, process } from '@progress/kendo-data-query';

import { Keys } from '@progress/kendo-angular-common';
import { Product } from './model';
import { EditService } from './edit.service';

import { map } from 'rxjs/operators';

@Component({
    selector: 'my-app',
    template: `
        <kendo-grid
            #grid
            [data]="view | async"
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
            </ng-template>
            <kendo-grid-column field="ProductName" title="Product Name"></kendo-grid-column>
            <kendo-grid-column field="UnitPrice" editor="numeric" title="Price"></kendo-grid-column>
            <kendo-grid-column field="Discontinued" editor="boolean" title="Discontinued"></kendo-grid-column>
            <kendo-grid-column field="UnitsInStock" editor="numeric" title="Units In Stock"></kendo-grid-column>
            <kendo-grid-command-column title="command" [width]="220">
                <ng-template kendoGridCellTemplate let-isNew="isNew">
                    <button kendoGridRemoveCommand>Remove</button>
                    <button kendoGridSaveCommand>Add</button>
                    <button kendoGridCancelCommand>Cancel</button>
                </ng-template>
            </kendo-grid-command-column>
        </kendo-grid>
    `
})
export class AppComponent implements OnInit {
    public view: Observable<GridDataResult>;
    public gridState: State = {
        sort: [],
        skip: 0,
        take: 5
    };

    public changes = {};

    constructor(private formBuilder: FormBuilder, public editService: EditService) {}

    public ngOnInit(): void {
        this.view = this.editService.pipe(map((data) => process(data, this.gridState)));

        this.editService.read();
    }

    public onStateChange(state: State): void {
        this.gridState = state;

        this.editService.read();
    }

    public cellClickHandler(args: CellClickEvent): void {
        if (!args.isEdited) {
            args.sender.editCell(args.rowIndex, args.columnIndex, this.createFormGroup(args.dataItem));
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
        args.sender.addRow(this.createFormGroup(new Product()));
    }

    public cancelHandler(args: CancelEvent): void {
        args.sender.closeRow(args.rowIndex);
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

    public saveChanges(grid: GridComponent): void {
        grid.closeCell();
        grid.cancelCell();

        this.editService.saveChanges();
    }

    public cancelChanges(grid: GridComponent): void {
        grid.cancelCell();

        this.editService.cancelChanges();
    }

    public createFormGroup(dataItem: Product): FormGroup {
        return this.formBuilder.group({
            ProductID: dataItem.ProductID,
            ProductName: [dataItem.ProductName, Validators.required],
            UnitPrice: dataItem.UnitPrice,
            UnitsInStock: [dataItem.UnitsInStock, Validators.compose([Validators.required, Validators.pattern('^[0-9]{1,3}')])],
            Discontinued: dataItem.Discontinued
        });
    }
}
