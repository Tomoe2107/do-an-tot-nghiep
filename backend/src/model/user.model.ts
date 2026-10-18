export interface User {
  id: string; // 5 ký tự số
  fullname: string;
  username: string;
  password: string;
  email?: string;
  role?: "user" | "admin";
  avatar?: string;
  created_at?: Date;
  updated_at?: Date;
}
