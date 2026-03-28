export interface Resource {
  name: string;
  description?: string;
  items: {
    path: string;
    pathType?: string;
    buttonLabel: string;
  }[];
}
