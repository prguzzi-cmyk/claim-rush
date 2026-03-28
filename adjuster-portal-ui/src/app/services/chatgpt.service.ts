import { Injectable } from "@angular/core";
import { Configuration, OpenAIApi } from "openai";
import { Observable, of } from "rxjs";
import { Message } from "../models/message.model";
import { environment } from "src/environments/environment";

@Injectable({
  providedIn: "root",
})
export class ChatgptService {
  constructor() {}

  configuration = new Configuration({
    organization: environment.openai.organizationId,
    apiKey: environment.openai.apiKey,
  });

  openai = new OpenAIApi(this.configuration);

  async sendMessage(messages: any): Promise<Observable<any>> {
    try {
      const completion = await this.openai.createChatCompletion({
        // model: "gpt-4-1106-preview",
        // gpt-3.5-turbo
        // gpt-4o
        // gpt-4o-mini
        model: "gpt-4o",
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
