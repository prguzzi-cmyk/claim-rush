export interface ClaimFileShareRequest {
  claim_file_ids: string[];
  email_files_to: string[];
  share_type: number;
  file_share_id: string;
  expiration_date?: string;  // Optional since it's commented out in the example
  message: string;
}



