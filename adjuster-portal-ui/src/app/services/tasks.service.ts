import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map } from 'rxjs/operators';
import { Task } from '../models/task.model';

@Injectable({
  providedIn: 'root'
})
export class TasksService {

  constructor(
    private http: HttpClient
  ) { }

  getTasks(pageIndex: number = 1, pageSize: number = 10) {
    let params = {
      page: pageIndex,
      size: pageSize
    }
    
    return this.http.get<any>('tasks', {params})
    .pipe(map(response => {
      return response;
    }));
  }

  addTask(task: Task) {
    return this.http.post('tasks', task);
  }

  updateTask(task: Task, task_id) {
    return this.http.put(`tasks/${task_id}`, { ...task })
      .pipe(
        map(response => { return response; })
      )
  }

  deleteTask(id: string) {
    return this.http.delete<any>('tasks/' + id)
      .pipe(map((response) => {
        return response;
      }));
  }
}
