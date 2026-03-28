export interface FileResource {
  id?: string;
  file?: any;
  name?: string;
  file_name?: string;
  description: string;
  type?: string;
  size?: number;
  path?: string;
  can_be_removed: boolean;
  tags: any;
  created_by?: {
    first_name: string;
    last_name: string;
  };
  updated_by?: {
    first_name: string;
    last_name: string;
  };
  created_at?: Date;
  updated_at?: Date;
}
