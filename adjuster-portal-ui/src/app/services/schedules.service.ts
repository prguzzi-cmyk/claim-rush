import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map } from 'rxjs/operators';
import { Schedule } from '../models/schedule.model';

@Injectable({
  providedIn: 'root'
})
export class SchedulesService {

  constructor(
    private http: HttpClient
  ) { }

  getSchedules() {
    return this.http.get<any>('schedules')
    .pipe(map(response => {
      return response;
    }));
  }

  addSchedule(schedule: Schedule) {
    return this.http.post('schedules', schedule);
  }

  updateSchedule(schedule: Schedule, schedule_id) {
    return this.http.put(`schedules/${schedule_id}`, { ...schedule })
      .pipe(
        map(response => { return response; })
      )
  }

  deleteSchedule(id: Schedule) {
    return this.http.delete<any>('schedules/' + id)
      .pipe(map((response) => {
        return response;
      }));
  }
}
