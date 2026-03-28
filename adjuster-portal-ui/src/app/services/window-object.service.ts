import { Injectable, InjectionToken } from "@angular/core";

@Injectable({
  providedIn: "root",
})
export class WindowObjectService {
  WINDOW = new InjectionToken<Window>("Global window object", {
    factory: () => window,
  });

  constructor() {}
}
