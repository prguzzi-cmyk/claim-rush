import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map } from 'rxjs/operators';
import { UserTask } from '../models/user-task.model';

@Injectable({
  providedIn: 'root'
})
export class UserTaskService {

  constructor(
    private http: HttpClient
  ) { }
  
  getUserTask(user_id: any, pageIndex: number = 1, pageSize: number = 10000) {

    const params = {
      page: pageIndex.toString(),
      size: pageSize.toString(),
      sort_by: 'created_at',
      order_by: 'desc',
      combined: true
    };


    return this.http.get<any>(`users/${user_id}/tasks`, {params})
    .pipe(map(response => {
      return response;
    }));
  }

  addUserTask(userTask: UserTask) {
    return this.http.post('users/tasks', userTask);
  }
  
  updateUserTask(userTask: UserTask) {
    return this.http.put(`users/tasks/${userTask.id}`, { ...userTask })
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
  // http://api.staging.upaportal.org/v1/leads/tasks/{task_id}
  // updateLeadTask(leadTask, task_id: any) {
  //   return this.http.put(`leads/tasks/${task_id}`, { ...leadTask })
  //     .pipe(
  //       map(response => { return response; })
  //     )
  // }
}
