export interface SanPham {
  MaSP?: number;
  TenSP: string;
  HinhAnh?: string;
  GiaNhap?: number;
  GiaBan: number;
  GiaSauGiam?: number;
  SoLuongTon?: number;
  DaBan?: number;
  DanhGiaTrungBinh?: number;
  TongLuotDanhGia?: number;
  HanSuDung?: string;
  XuatXu?: string;
  MoTa?: string;
  Voucher?: string;
  user_id: number;
  VungMien?: "bac" | "trung" | "nam";
  LoaiDoAn?: "tai_cho" | "do_kho";
  created_at?: string;
  updated_at?: string;
}
