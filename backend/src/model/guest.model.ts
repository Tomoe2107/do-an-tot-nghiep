export interface KhachHang {
  MaKH: string;
  HoTen: string;
  Email?: string; // Có thể null
  SoDienThoai?: string;
  NgayDangKy?: Date;
  user_id: string; // Liên kết với users.id
  TinhThanh?: string;
  QuanHuyen?: string;
  PhuongXa?: string;
  DiaChiChiTiet?: string; // Địa chỉ chi tiết
  DiaChiDayDu?: string; // Cột sinh tự động (generated)
}
