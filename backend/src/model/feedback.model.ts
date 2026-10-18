// models/review.model.ts
export interface Feedback {
  id: number;
  user_id: number;
  rating: number; // 1–5
  comment: string;
  created_at?: Date;
  updated_at?: Date;
  fullname?: string; // join từ users
  avatar?: string; // join từ users
}
