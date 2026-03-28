import { Injectable } from "@angular/core";
import { Observable, of } from "rxjs";
import { Source } from "../models/source.model";

@Injectable({
  providedIn: "root",
})
export class SourceService {
  source: Source;
  sources: Source[] = [
    {
      name: "npo_initiative",
      displayName: "NPO Initiative",
    },

    {
      name: "partnership",
      displayName: "Partnership",
    },

    {
      name: "network",
      displayName: "Network",
    },
  ];
  leadsLocation;

  constructor() {}

  getSource(): Observable<Source> {
    if (this.source) {
      const source = of(this.source);
      return source;
    } else {
      const source = of(JSON.parse(localStorage.getItem("source")));
      return source;
    }
  }

  getSources(): Observable<Source[]> {
    const sources = of(this.sources);

    return sources;
  }

  setSource(sourceName: string): Observable<Source> {
    this.sources.forEach((source) => {
      if (source.name == sourceName) {
        this.source = source;
      }
    });

    localStorage.setItem("source", JSON.stringify(this.source));

    const source = of(this.source);

    return source;
  }

  setLeadsLocation(leadsLocation) {
    this.leadsLocation = leadsLocation;
  }
}
