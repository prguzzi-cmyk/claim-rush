import { Injectable } from "@angular/core";
import { Configuration, OpenAIApi } from "openai";
import { Observable, of } from "rxjs";
import { Message } from "../models/message.model";

@Injectable({
  providedIn: "root",
})
export class AssistantService {
  constructor() {}

  configuration = new Configuration({
    organization: "org-o1DNEO5pUbY1j1YVb2Imkf91",
    apiKey: "OPENAI_API_KEY_PLACEHOLDER",
  });

  openai = new OpenAIApi(this.configuration);

  async sendMessage(messages: any): Promise<Observable<any>> {
    try {
      const completion = await this.openai.createChatCompletion({
        // model: "gpt-4-1106-preview",
        model: "gpt-3.5-turbo",
        messages: [
          { role: "system", content: "You are a helpful assistant." },
          ...messages,
        ],
      });

      const response = of(completion.data.choices[0].message);

      return response;
    } catch (err) {
      console.log(err);
    }
  }
}
