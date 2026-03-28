import { Component, OnInit } from "@angular/core";
import { AiIntakeService } from "src/app/services/ai-intake.service";
import {
  IntakeDashboardMetrics,
  IntakeSession,
  IntakeAppointment,
} from "src/app/models/intake-session.model";

@Component({
  selector: "app-ai-intake-dashboard",
  templateUrl: "./ai-intake-dashboard.component.html",
  styleUrls: ["./ai-intake-dashboard.component.scss"],
  standalone: false,
})
export class AiIntakeDashboardComponent implements OnInit {
  metrics: IntakeDashboardMetrics = {
    conversations_started: 0,
    completed_intakes: 0,
    appointments_booked: 0,
    clients_signed: 0,
    qualification_rate: 0,
    avg_qualification_score: 0,
  };

  recentSessions: IntakeSession[] = [];
  appointments: IntakeAppointment[] = [];
  isLoading = true;

  constructor(private intakeService: AiIntakeService) {}

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    this.isLoading = true;

    this.intakeService.getMetrics().subscribe({
      next: (m) => (this.metrics = m),
    });

    this.intakeService.getSessions().subscribe({
      next: (s) => (this.recentSessions = s.slice(0, 10)),
    });

    this.intakeService.getAppointments().subscribe({
      next: (a) => {
        this.appointments = a;
        this.isLoading = false;
      },
      error: () => (this.isLoading = false),
    });
  }

  getStatusClass(status: string): string {
    switch (status) {
      case "completed":
        return "status-completed";
      case "active":
        return "status-active";
      case "abandoned":
        return "status-abandoned";
      case "scheduled":
        return "status-scheduled";
      case "confirmed":
        return "status-confirmed";
      case "cancelled":
        return "status-cancelled";
      default:
        return "";
    }
  }

  getApptTypeIcon(type: string): string {
    switch (type) {
      case "inspection":
        return "home_repair_service";
      case "zoom":
        return "videocam";
      case "teams":
        return "groups";
      default:
        return "event";
    }
  }
}
