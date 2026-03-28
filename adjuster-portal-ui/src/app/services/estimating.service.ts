import { Injectable } from "@angular/core";
import { HttpClient, HttpRequest, HttpEvent } from "@angular/common/http";
import { Observable } from "rxjs";
import { map } from "rxjs/operators";
import { EstimateProject, EstimateRoom, EstimateLineItem, EstimatePhoto, PricingVersion } from "../models/estimating.model";
import {
  CarrierEstimate,
  CarrierPreviewResult,
  CarrierConfirmRequest,
  ComparisonResult,
  DefenseNotesPayload,
} from "../models/carrier-comparison.model";

@Injectable({
  providedIn: "root",
})
export class EstimatingService {
  constructor(private http: HttpClient) {}

  getEstimates(pageIndex: number = 1, pageSize: number = 10) {
    const params = {
      page: pageIndex.toString(),
      size: pageSize.toString(),
      sort_by: "created_at",
      order_by: "desc",
    };

    return this.http.get<any>("estimate-projects", { params }).pipe(
      map((response) => {
        return response;
      })
    );
  }

  getEstimate(id: string) {
    return this.http.get<EstimateProject>("estimate-projects/" + id).pipe(
      map((response) => {
        return response;
      })
    );
  }

  createEstimate(data: Partial<EstimateProject>) {
    return this.http.post("estimate-projects", data).pipe(
      map((response) => {
        return response;
      })
    );
  }

  updateEstimate(id: string, data: Partial<EstimateProject>) {
    return this.http.put("estimate-projects/" + id, data).pipe(
      map((response) => {
        return response;
      })
    );
  }

  deleteEstimate(id: string) {
    return this.http.delete<any>("estimate-projects/" + id).pipe(
      map((response) => {
        return response;
      })
    );
  }

  addRoom(projectId: string, data: Partial<EstimateRoom>) {
    return this.http.post("estimate-projects/" + projectId + "/rooms", data).pipe(
      map((response) => {
        return response;
      })
    );
  }

  updateRoom(roomId: string, data: Partial<EstimateRoom>) {
    return this.http.put("estimate-projects/rooms/" + roomId, data).pipe(
      map((response) => {
        return response;
      })
    );
  }

  deleteRoom(roomId: string) {
    return this.http.delete<any>("estimate-projects/rooms/" + roomId).pipe(
      map((response) => {
        return response;
      })
    );
  }

  addLineItem(roomId: string, data: Partial<EstimateLineItem>) {
    return this.http.post("estimate-projects/rooms/" + roomId + "/line-items", data).pipe(
      map((response) => {
        return response;
      })
    );
  }

  updateLineItem(lineItemId: string, data: Partial<EstimateLineItem>) {
    return this.http.put("estimate-projects/line-items/" + lineItemId, data).pipe(
      map((response) => {
        return response;
      })
    );
  }

  deleteLineItem(lineItemId: string) {
    return this.http.delete<any>("estimate-projects/line-items/" + lineItemId).pipe(
      map((response) => {
        return response;
      })
    );
  }

  searchPricing(query: string, region?: string) {
    const params: any = { q: query };
    if (region) params.region = region;
    return this.http.get<any[]>("pricing/search", { params });
  }

  // --- Pricing Version methods ---

  getPricingVersions(status?: string, source?: string, region?: string) {
    const params: any = {};
    if (status) params.status = status;
    if (source) params.source = source;
    if (region) params.region = region;
    return this.http.get<any>("pricing/versions", { params });
  }

  getPricingVersion(id: string) {
    return this.http.get<PricingVersion>("pricing/versions/" + id);
  }

  createPricingVersion(data: Partial<PricingVersion>) {
    return this.http.post<PricingVersion>("pricing/versions", data);
  }

  updatePricingVersion(id: string, data: Partial<PricingVersion>) {
    return this.http.patch<PricingVersion>("pricing/versions/" + id, data);
  }

  activatePricingVersion(id: string) {
    return this.http.post<PricingVersion>("pricing/versions/" + id + "/activate", {});
  }

  importPricingItems(versionId: string, file: File): Observable<HttpEvent<any>> {
    const formData = new FormData();
    formData.append("file", file);
    const req = new HttpRequest(
      "POST",
      "pricing/versions/" + versionId + "/import",
      formData,
      { reportProgress: true }
    );
    return this.http.request(req);
  }

  getPricingVersionItems(versionId: string, page: number = 1, size: number = 20) {
    return this.http.get<any>("pricing/versions/" + versionId + "/items", {
      params: { page: page.toString(), size: size.toString() },
    });
  }

  suggestFromPhotos(projectId: string): Observable<EstimateProject> {
    return this.http.post<EstimateProject>("estimate-projects/" + projectId + "/suggest", {});
  }

  analyzeForScope(projectId: string): Observable<any> {
    return this.http.post<any>("estimate-projects/" + projectId + "/analyze", {});
  }

  analyzePhotos(projectId: string): Observable<any> {
    return this.http.post<any>("estimate-projects/" + projectId + "/analyze-photos", {});
  }

  approveLineItem(lineItemId: string): Observable<EstimateLineItem> {
    return this.http.put<EstimateLineItem>("estimate-projects/line-items/" + lineItemId + "/approve", {});
  }

  rejectLineItem(lineItemId: string): Observable<any> {
    return this.http.delete<any>("estimate-projects/line-items/" + lineItemId + "/reject");
  }

  // --- Photo methods ---

  uploadPhoto(
    projectId: string,
    file: File,
    photoType?: string,
    caption?: string,
    roomId?: string
  ): Observable<HttpEvent<EstimatePhoto>> {
    const formData = new FormData();
    formData.append("file", file);
    if (photoType) formData.append("photo_type", photoType);
    if (caption) formData.append("caption", caption);
    if (roomId) formData.append("room_id", roomId);

    const req = new HttpRequest(
      "POST",
      "estimate-projects/" + projectId + "/photos",
      formData,
      { reportProgress: true }
    );
    return this.http.request<EstimatePhoto>(req);
  }

  getPhotos(projectId: string, roomId?: string) {
    const params: any = {};
    if (roomId) params.room_id = roomId;
    return this.http.get<EstimatePhoto[]>(
      "estimate-projects/" + projectId + "/photos",
      { params }
    );
  }

  updatePhoto(photoId: string, data: Partial<EstimatePhoto>) {
    return this.http.put<EstimatePhoto>(
      "estimate-projects/photos/" + photoId,
      data
    );
  }

  deletePhoto(photoId: string) {
    return this.http.delete<any>("estimate-projects/photos/" + photoId);
  }

  // --- Carrier Comparison methods ---

  uploadCarrierEstimate(
    projectId: string,
    file: File,
    carrierName: string
  ): Observable<HttpEvent<CarrierEstimate>> {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("carrier_name", carrierName);

    const req = new HttpRequest(
      "POST",
      "estimate-projects/" + projectId + "/carrier-estimates/upload",
      formData,
      { reportProgress: true }
    );
    return this.http.request<CarrierEstimate>(req);
  }

  pasteCarrierEstimate(projectId: string, carrierName: string, pastedText: string) {
    return this.http.post<CarrierEstimate>(
      "estimate-projects/" + projectId + "/carrier-estimates/paste",
      { carrier_name: carrierName, pasted_text: pastedText }
    );
  }

  previewCarrierEstimate(
    projectId: string,
    file: File
  ): Observable<HttpEvent<CarrierPreviewResult>> {
    const formData = new FormData();
    formData.append("file", file);

    const req = new HttpRequest(
      "POST",
      "estimate-projects/" + projectId + "/carrier-estimates/preview",
      formData,
      { reportProgress: true }
    );
    return this.http.request<CarrierPreviewResult>(req);
  }

  previewPasteCarrierEstimate(projectId: string, carrierName: string, pastedText: string) {
    return this.http.post<CarrierPreviewResult>(
      "estimate-projects/" + projectId + "/carrier-estimates/preview-paste",
      { carrier_name: carrierName, pasted_text: pastedText }
    );
  }

  confirmCarrierEstimate(projectId: string, body: CarrierConfirmRequest) {
    return this.http.post<CarrierEstimate>(
      "estimate-projects/" + projectId + "/carrier-estimates/confirm",
      body
    );
  }

  getCarrierEstimates(projectId: string) {
    return this.http.get<CarrierEstimate[]>(
      "estimate-projects/" + projectId + "/carrier-estimates"
    );
  }

  deleteCarrierEstimate(id: string) {
    return this.http.delete<any>("estimate-projects/carrier-estimates/" + id);
  }

  runComparison(projectId: string, carrierEstimateId: string, priceThreshold: number = 5.0) {
    return this.http.post<ComparisonResult>(
      "estimate-projects/" + projectId + "/carrier-comparison/run",
      { carrier_estimate_id: carrierEstimateId, price_threshold: priceThreshold }
    );
  }

  getComparison(projectId: string) {
    return this.http.get<ComparisonResult | null>(
      "estimate-projects/" + projectId + "/carrier-comparison"
    );
  }

  sendSupplementEmail(projectId: string, data: FormData): Observable<any> {
    return this.http.post(
      "estimate-projects/" + projectId + "/supplement-email/send",
      data
    );
  }

  generatePolicyArgument(projectId: string, argumentType: string, carrierEstimateId?: string) {
    return this.http.post<{ argument_type: string; argument_text: string }>(
      "estimate-projects/" + projectId + "/policy-argument/generate",
      { argument_type: argumentType, carrier_estimate_id: carrierEstimateId }
    );
  }

  generateSupplementArgument(projectId: string, carrierEstimateId?: string) {
    return this.http.post<{ argument_text: string; has_policy_support: boolean }>(
      "estimate-projects/" + projectId + "/supplement-argument/generate",
      { carrier_estimate_id: carrierEstimateId }
    );
  }

  // --- Carrier Payment methods ---

  getCarrierPayments(projectId: string) {
    return this.http.get<any[]>(
      "estimate-projects/" + projectId + "/carrier-payments"
    );
  }

  createCarrierPayment(projectId: string, payment: { payment_amount: number; payment_date: string; payment_type: string; note?: string }) {
    return this.http.post<any>(
      "estimate-projects/" + projectId + "/carrier-payments",
      payment
    );
  }

  deleteCarrierPayment(projectId: string, paymentId: string) {
    return this.http.delete<any>(
      "estimate-projects/" + projectId + "/carrier-payments/" + paymentId
    );
  }

  getClaimRecoveryDashboard() {
    return this.http.get<any>("claim-recovery/dashboard");
  }

  // --- Defense Notes methods ---

  getDefenseNotes(projectId: string) {
    return this.http.get<DefenseNotesPayload>(
      "estimate-projects/" + projectId + "/defense-notes"
    );
  }

  saveDefenseNotes(projectId: string, notes: DefenseNotesPayload) {
    return this.http.put<DefenseNotesPayload>(
      "estimate-projects/" + projectId + "/defense-notes",
      notes
    );
  }

  generateDefenseNoteDraft(projectId: string, section: string, carrierEstimateId?: string) {
    return this.http.post<{ section: string; draft_text: string; has_policy_support: boolean }>(
      "estimate-projects/" + projectId + "/defense-notes/generate",
      { section, carrier_estimate_id: carrierEstimateId }
    );
  }
}
