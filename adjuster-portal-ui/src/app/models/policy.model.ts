export class Policy {
  id: string;

  permissions? : any = [

  ]
  created_by?: {
    first_name: string;
    last_name: string
  }
  updated_by?: {
    first_name: string;
    last_name: string;
  }
  created_at?: Date;
  updated_at?: Date;
}
