import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { Observable } from "rxjs";
import {
  IntakeChatMessage,
  IntakeChatResponse,
  IntakeSession,
  IntakeAppointment,
  IntakeDashboardMetrics,
} from "../models/intake-session.model";

@Injectable({
  providedIn: "root",
})
export class AiIntakeService {
  private basePath = "ai-intake";

  constructor(private http: HttpClient) {}

  /** Send a chat message (or start a new session with session_id=null) */
  chat(message: IntakeChatMessage): Observable<IntakeChatResponse> {
    return this.http.post<IntakeChatResponse>(`${this.basePath}/chat`, message);
  }

  /** List all intake sessions */
  getSessions(status?: string): Observable<IntakeSession[]> {
    const params: any = {};
    if (status) params.status = status;
    return this.http.get<IntakeSession[]>(`${this.basePath}/sessions`, { params });
  }

  /** Get a single intake session */
  getSession(sessionId: string): Observable<IntakeSession> {
    return this.http.get<IntakeSession>(`${this.basePath}/sessions/${sessionId}`);
  }

  /** List appointments */
  getAppointments(status?: string): Observable<IntakeAppointment[]> {
    const params: any = {};
    if (status) params.status = status;
    return this.http.get<IntakeAppointment[]>(`${this.basePath}/appointments`, { params });
  }

  /** Update an appointment */
  updateAppointment(appointmentId: string, data: Partial<IntakeAppointment>): Observable<IntakeAppointment> {
    return this.http.patch<IntakeAppointment>(`${this.basePath}/appointments/${appointmentId}`, data);
  }

  /** Get dashboard metrics */
  getMetrics(): Observable<IntakeDashboardMetrics> {
    return this.http.get<IntakeDashboardMetrics>(`${this.basePath}/metrics`);
  }
}
