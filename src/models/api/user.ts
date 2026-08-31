export interface DeleteAccountResponse {
  status: string;
  message: string;
}

export interface ReportedMessage {
  id: string;
  content: string;
  sender_id: string;
  created_at: number;
}

export interface ReportUserRequest {
  reportedUserId: string;
  reason: string;
  messages: ReportedMessage[];
}

export interface ReportUserResponse {
  status: "success";
  reportId: string;
}
