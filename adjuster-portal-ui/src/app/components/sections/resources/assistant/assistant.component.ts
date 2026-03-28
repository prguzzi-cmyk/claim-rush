import { Component, OnInit } from "@angular/core";
import { MatSnackBar } from "@angular/material/snack-bar";
import { NgxSpinnerService } from "ngx-spinner";
import { ChatgptService } from "src/app/services/chatgpt.service";
import { Message } from "src/app/models/message.model";

@Component({
    selector: "app-assistant",
    templateUrl: "./assistant.component.html",
    styleUrls: ["./assistant.component.scss"],
    standalone: false
})
export class AssistantComponent implements OnInit {
  messages: Message[] = [];

  userMessageContent: string = "";

  response: any;

  constructor(
    private chatgptService: ChatgptService,
    private spinner: NgxSpinnerService,
    private snackBar: MatSnackBar
  ) {}

  handleInputChange() {
  }

  checkIfEnterKeyWasPressed(event: { key: string }) {
    if (event.key == "Enter") {
      this.sendMessage();
    }
  }

  sendMessage() {
    const userMessage: Message = {
      role: "user",
      content: this.userMessageContent,
    };

    this.messages.push(userMessage);

    this.userMessageContent = "";

    //   let message =
    //   {
    //       "id":1,
    //       "content": "JSON stands for JavaScript Object Notation. It is a lightweight data interchange format that is easy for humans to read and write and easy for machines to parse and generate. JSON is based on a subset of the JavaScript programming language, Standard ECMA-262 3rd Edition - December 1999, but it is a language-independent data format. JSON is commonly used for representing structured data and exchanging information between a server and a web application.\n\nJSON format is text-only, and it can be easily sent between a server and a web client without any compatibility issues. It is often used as an alternative to XML as it is more compact and faster to parse.\n\nA JSON object is built on two structures:\n\n1. A collection of name/value pairs. In various languages, this is realized as an object, record, struct, dictionary, hash table, keyed list, or associative array.\n2. An ordered list of values. In most languages, this is realized as an array, vector, list, or sequence.\n\nHere's an example of JSON data representing a person:\n\n```json\n{\n  \"firstName\": \"John\",\n  \"lastName\": \"Doe\",\n  \"age\": 30,\n  \"isStudent\": false,\n  \"address\": {\n    \"street\": \"123 Main St\",\n    \"city\": \"Anytown\",\n    \"zip\": \"12345\"\n  },\n  \"phoneNumbers\": [\n    {\n      \"type\": \"home\",\n      \"number\": \"212-555-1234\"\n    },\n    {\n      \"type\": \"office\",\n      \"number\": \"646-555-4567\"\n    }\n  ]\n}\n```\n\nIn this example, you can see a JSON object containing string, number, boolean, null (if any field is set to null), object, and array data types. JSON is widely used in web applications, APIs, and configuration files for its simplicity and ease of use.",
    //       "role": "agent",
    //   }
    // ;

    // message.content = message.content
    // .replace(/(?:\r\n|\r|\n)/g, '<br>').replace("```json","<pre>").replace("```","</pre>");

    // console.log (message.content);

    // this.messages.push(message);

    this.spinner.show();
    this.chatgptService.sendMessage(this.messages).then((response) => {
      response.subscribe((message) => {
        this.spinner.hide();
        message.content = message.content
          .replace(/(?:\r\n|\r|\n)/g, "<br>")
          .replace("```json", "<pre>")
          .replace("```", "</pre>");
        this.messages.push(message);
      });
    });

    // const element = document.getElementById("message-display-container");
    // element.scrollTop = element.scrollHeight;
  }

  ngOnInit(): void {}
}
