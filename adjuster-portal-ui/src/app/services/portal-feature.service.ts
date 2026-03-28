import { Injectable } from "@angular/core";
import { Observable, of, BehaviorSubject } from "rxjs";
import { PortalFeature } from "../models/portal-feature.model";

@Injectable({
  providedIn: "root",
})
export class PortalFeatureService {
  private selectedPortalFeature$ = new BehaviorSubject({});
  selectedPortalFeature = this.selectedPortalFeature$.asObservable();

  // selectedPortalFeatureSubject = new BehaviorSubject({});

  portalFeatures: PortalFeature[] = [
    {
      id: "one",
      name: "AI Email Tracking",
      description:
        "Monitor and analyze your email interactions with the power of AI. Gain insights into response times and enhance communication efficiency for your insurance claims.",
      imgPath: "../../../assets/img/portal-features/ai-email-tracking/img.png",
      icon: "mail",
      position: "left",
    },
    {
      id: "two",
      name: "File Sharing",
      description:
        "Easily share and access important claim documents in a secure environment. Simplify collaboration and ensure all stakeholders are always up-to-date.",
      imgPath: "../../../assets/img/portal-features/file-sharing/img.png",
      icon: "description",
      position: "left",
    },
    {
      id: "three",
      name: "CRM System",
      description:
        "Manage client relationships and track claim progress seamlessly through an integrated CRM. Stay organized with all client details and case updates in one place.",
      imgPath: "../../../assets/img/portal-features/crm-system/img.png",
      icon: "headset_mic",
      position: "left",
    },
    {
      id: "four",
      name: "Task Board",
      description:
        "Stay on top of your daily tasks and claim activities with a clear, intuitive task board. Prioritize and manage your workflow efficiently for better claim outcomes.",
      imgPath: "../../../assets/img/portal-features/task-board/img.png",
      icon: "task",
      position: "right",
    },
    {
      id: "five",
      name: "Hierachy Structure",
      description:
        "Visualize your team's hierarchy and manage user roles with ease. Ensure efficient communication and reporting within your organization.",
      imgPath: "../../../assets/img/portal-features/hierachy-structure/img.png",
      icon: "account_tree",
      position: "right",
    },
    {
      id: "six",
      name: "Real-Time Alerts",
      description:
        "Receive instant notifications on claim updates and important activities. Stay informed and act promptly to handle time-sensitive matters.",
      imgPath: "../../../assets/img/portal-features/real-time-alerts/img.png",
      icon: "notifications",
      position: "right",
    },
  ];

  // selectedPortalFeature: ;
  // selectedPortalFeature: Observable<PortalFeature>;
  // selectedPortalFeature: PortalFeature;

  getPortalFeatures() {
    return this.portalFeatures;
  }

  getSelectedPortalFeature(): Observable<any> {
    return this.selectedPortalFeature;
  }

  setSelectedPortalFeature(selectedPortalFeature: PortalFeature) {
    this.selectedPortalFeature$.next(selectedPortalFeature);
  }

  constructor() {}
}
