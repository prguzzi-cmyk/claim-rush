import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map } from 'rxjs/operators';
import { UserTask } from '../models/user-task.model';
import { ClientTask } from '../models/client-task.model';

@Injectable({
  providedIn: 'root'
})
export class ClientTaskService {

  constructor(
    private http: HttpClient
  ) { }
  
  getUserTask(user_id: any) {
    return this.http.get<any>(`users/${user_id}/tasks?combined=true`)
    .pipe(map(response => {
      return response;
    }));
  }

  addUserTask(userTask: ClientTask) {
    return this.http.post('users/tasks', userTask);
  }
  
  updateUserTask(userTask: UserTask, task_id: any) {
    return this.http.put(`users/tasks/${task_id}`, { ...userTask })
      .pipe(
        map(response => { return response; })
      )
  }

  deleteUserTask(task_id: any) {
    return this.http.delete<any>(`users/tasks/${task_id}`)
      .pipe(map((response) => {
        return response;
      }));
  }
}
