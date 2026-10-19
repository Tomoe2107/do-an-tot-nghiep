import { db } from "../database";

export interface ProductMatch {
  MaSP: number;
  TenSP: string;
  GiaSauGiam: number;
  HinhAnh: string | null;
}

export const findMatchingProducts = async (
  keyword: string
): Promise<ProductMatch[]> => {
  const [rows]: any = await db.query(
    `SELECT MaSP, TenSP, GiaBan, HinhAnh,
            CASE WHEN Voucher IS NOT NULL AND Voucher != ''
                 THEN ROUND(GiaBan * (100 - CAST(REPLACE(Voucher, '%', '') AS DECIMAL(5,2))) / 100, 2)
                 ELSE GiaBan END AS GiaSauGiam
     FROM sanpham
     WHERE is_deleted = 0 AND TenSP LIKE ?
     LIMIT 5`,
    [`%${keyword}%`]
  );
  return rows;
};

// Dò lỏng hơn: dùng khi keyword là cả câu người dùng gõ (vd "tìm bún kèn"), không phải tên
// sản phẩm thuần. Khớp cả 2 chiều - tên sản phẩm chứa trong câu, hoặc câu chứa tên sản phẩm -
// để bắt được các câu có từ dẫn ("tìm ", "mua ", "giá ...") mà vẫn chứa đúng tên sản phẩm thật.
export const findMatchingProductsLoose = async (
  message: string
): Promise<ProductMatch[]> => {
  const [rows]: any = await db.query(
    `SELECT MaSP, TenSP, GiaBan, HinhAnh,
            CASE WHEN Voucher IS NOT NULL AND Voucher != ''
                 THEN ROUND(GiaBan * (100 - CAST(REPLACE(Voucher, '%', '') AS DECIMAL(5,2))) / 100, 2)
                 ELSE GiaBan END AS GiaSauGiam
     FROM sanpham
     WHERE is_deleted = 0
       AND (TenSP LIKE ? OR ? LIKE CONCAT('%', TenSP, '%'))
     LIMIT 5`,
    [`%${message}%`, message]
  );
  return rows;
};

export const formatProductReply = (
  rows: ProductMatch[],
  keyword: string
): string => {
  if (!rows.length) {
    return `Hiện chưa có sản phẩm nào khớp với "${keyword}" ạ.`;
  }

  const list = rows
    .map(
      (r) => `- ${r.TenSP}: ${Number(r.GiaSauGiam).toLocaleString("vi-VN")}đ`
    )
    .join("\n");

  return `Mình tìm thấy ${rows.length} sản phẩm phù hợp:\n${list}`;
};
