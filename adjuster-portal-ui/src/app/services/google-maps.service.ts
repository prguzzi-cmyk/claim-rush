import { Injectable } from "@angular/core";
import { HttpClient, HttpBackend, HttpHeaders } from "@angular/common/http";

@Injectable({
  providedIn: "root",
})
export class GoogleMapsService {
  private httpClient: HttpClient;

  constructor(private handler: HttpBackend) {
    this.httpClient = new HttpClient(handler);
  }

  // constructor(private http: HttpClient) {}

  getLeads(reqBody: any) {
    // const headers = new this.httpHeaders({
    //   "Content-Type": "application/json",
    //   "X-Goog-Api-Key": "AIzaSyAiDFmhITXqV-OI6d-4_OziagsV76EJzME",
    //   "X-Goog-FieldMask":
    //     "places.displayName,places.formattedAddress,places.nationalPhoneNumber",
    // });

    // const httpHeaders: HttpHeaders = new HttpHeaders({
    //   "Content-Type": "application/json",
    //   "X-Goog-Api-Key": "AIzaSyAiDFmhITXqV-OI6d-4_OziagsV76EJzME",
    //   "X-Goog-FieldMask":
    //     "places.displayName,places.formattedAddress,places.nationalPhoneNumber",
    // });

    return this.httpClient.post(
      "https://places.googleapis.com/v1/places:searchText",
      reqBody,
      {
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": "AIzaSyAiDFmhITXqV-OI6d-4_OziagsV76EJzME",
          "X-Goog-FieldMask":
            "places.displayName,places.formattedAddress,places.nationalPhoneNumber",
        },
      }
    );
  }

  // async getLeads(query: string): Promise<Observable<any>> {
  //   try {
  //     const completion = await this.openai.createChatCompletion({
  //       // model: "gpt-4-1106-preview",
  //       // gpt-3.5-turbo
  //       // gpt-4o
  //       // gpt-4o-mini
  //       model: "gpt-4o",
  //       messages: [
  //         { role: "system", content: "You are a helpful assistant." },
  //         ...messages,
  //       ],
  //     });

  //     const response = of(completion.data.choices[0].message);

  //     return response;
  //   } catch (err) {
  //     console.log(err);
  //   }
  // }
}
