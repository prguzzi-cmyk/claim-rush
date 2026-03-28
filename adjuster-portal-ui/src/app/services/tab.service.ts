import { Injectable } from "@angular/core";
import { BehaviorSubject, Observable } from "rxjs";

@Injectable({
  providedIn: "root",
})
export class TabService {
  private _itemList: any[] = [];
  private _itemList$ = new BehaviorSubject<Array<any>>([]);
  private _side$ = new BehaviorSubject<string>("Dashboard");
  private _focus$ = new BehaviorSubject<number>(0);

  constructor() {
    this._itemList = this.getTabItems();
    this._itemList$.next(this._itemList);
    this._side$.next(localStorage.getItem("currentSide"));
    this._focus$.next(0);
  }

  get itemList$(): Observable<Array<any>> {
    return this._itemList$.asObservable();
  }
  side$ = this._side$.asObservable();
  focus$ = this._focus$.asObservable();

  addItem(newItem: any) {
    const existingClientIndex = this._itemList.findIndex(
      (c) => c.id === newItem.id
    );
    if (existingClientIndex === -1) {
      this._itemList.push(newItem);
      localStorage.setItem("tabItems", JSON.stringify(this._itemList));
      this._itemList$.next(this._itemList);
      this._focus$.next(this._itemList.length);
    } else {
      this._focus$.next(existingClientIndex + 1);
    }
  }

  removeItem(index: number) {
    if (index >= 0 && index <= this._itemList.length) {
      this._itemList.splice(index, 1);
      localStorage.setItem("tabItems", JSON.stringify(this._itemList));
      this._itemList$.next(this._itemList);
    }
  }

  removeItemById(id: string) {
    const index = this._itemList.findIndex((c) => c.id === id);
    if (index >= 0 && index <= this._itemList.length) {
      this._itemList.splice(index, 1);
      localStorage.setItem("tabItems", JSON.stringify(this._itemList));
      this._itemList$.next(this._itemList);
    }
  }

  getTabItems(): any[] {
    const data = localStorage.getItem("tabItems");
    if (data) return JSON.parse(data);
    return [];
  }

  setItemList(data: any[]) {
    this._itemList = data;
    localStorage.setItem("tabItems", JSON.stringify(this._itemList));
    this._itemList$.next(this._itemList);
  }

  setSideTitle(data: string) {
    localStorage.setItem("currentSide", data);
    this._side$.next(data);
    // Only switch to main tab if not already there — avoids re-rendering
    // the router-outlet tab and interfering with in-progress navigation
    if (this._focus$.getValue() !== 0) {
      this._focus$.next(0);
    }
  }

  setFocus(index: number) {
    this._focus$.next(index);
  }
}
