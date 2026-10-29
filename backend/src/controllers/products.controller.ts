import { Request, Response } from "express";
import { db } from "../database";
import { SanPham } from "../model/products.model";
import { AuthRequest } from "../middlewares/authMiddleware";

// 🟢 Lấy tất cả sản phẩm (chỉ hiển thị sản phẩm đang hoạt động)
export const getAllSanPham = async (req: Request, res: Response) => {
  try {
    const { vungmien, loaidan, keyword, xuatxu, minPrice, maxPrice, sort } =
      req.query;

    // Endpoint công khai (không cần đăng nhập) - chỉ trả tên người đăng để hiển thị, KHÔNG
    // được JOIN/trả số điện thoại hay địa chỉ nhà (dữ liệu cá nhân trong bảng khachhang),
    // tránh lộ thông tin liên hệ riêng tư của người bán cho bất kỳ ai xem danh sách sản phẩm.
    let sql = `
      SELECT sp.*,
             u.fullname AS NguoiDang,
             CASE
               WHEN sp.Voucher IS NOT NULL AND sp.Voucher != ''
               THEN ROUND(sp.GiaBan * (100 - CAST(REPLACE(sp.Voucher, '%', '') AS DECIMAL(5,2))) / 100, 2)
               ELSE sp.GiaBan
             END AS GiaSauGiam
      FROM sanpham sp
      JOIN users u ON sp.user_id = u.id
      WHERE sp.is_deleted = 0
    `;

    const params: any[] = [];

    if (vungmien) {
      sql += " AND sp.VungMien = ?";
      params.push(vungmien);
    }
    if (loaidan) {
      sql += " AND sp.LoaiDoAn = ?";
      params.push(loaidan);
    }
    if (keyword) {
      sql += " AND (sp.TenSP LIKE ? OR sp.MoTa LIKE ?)";
      params.push(`%${keyword}%`, `%${keyword}%`);
    }
    if (xuatxu) {
      sql += " AND sp.XuatXu LIKE ?";
      params.push(`%${xuatxu}%`);
    }

    const havingClauses: string[] = [];
    if (minPrice) {
      havingClauses.push("GiaSauGiam >= ?");
      params.push(Number(minPrice));
    }
    if (maxPrice) {
      havingClauses.push("GiaSauGiam <= ?");
      params.push(Number(maxPrice));
    }
    if (havingClauses.length) {
      sql += ` HAVING ${havingClauses.join(" AND ")}`;
    }

    const sortOptions: Record<string, string> = {
      gia_asc: "GiaSauGiam ASC",
      gia_tang: "GiaSauGiam ASC",
      gia_desc: "GiaSauGiam DESC",
      gia_giam: "GiaSauGiam DESC",
      moi_nhat: "sp.created_at DESC",
      ban_chay: "sp.DaBan DESC",
      danh_gia: "sp.DanhGiaTrungBinh DESC",
    };
    sql += ` ORDER BY ${sortOptions[sort as string] || "sp.created_at DESC"}`;

    const [rows] = await db.query(sql, params);
    res.json(rows);
  } catch (error) {
    console.error("❌ Lỗi getAllSanPham:", error);
    res.status(500).json({
      message: "Lỗi khi lấy danh sách sản phẩm",
      error: (error as any).message,
    });
  }
};

// 🟢 Lấy 1 sản phẩm theo id (không hiển thị nếu đã xóa)
export const getSanPhamById = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    // Endpoint công khai - cùng lý do như getAllSanPham, không trả SĐT/địa chỉ nhà người đăng.
    const [rows]: any = await db.query(
      `
       SELECT sp.*,
              u.fullname AS NguoiDang,
              CASE
                WHEN sp.Voucher IS NOT NULL AND sp.Voucher != ''
                THEN ROUND(sp.GiaBan * (100 - CAST(REPLACE(sp.Voucher, '%', '') AS DECIMAL(5,2))) / 100, 2)
                ELSE sp.GiaBan
              END AS GiaSauGiam
       FROM sanpham sp
       JOIN users u ON sp.user_id = u.id
       WHERE sp.MaSP = ? AND sp.is_deleted = 0
      `,
      [id]
    );

    if (!rows.length) {
      return res.status(404).json({
        message: "Không tìm thấy sản phẩm hoặc sản phẩm đã bị xóa",
      });
    }

    res.json(rows[0]);
  } catch (error) {
    console.error("❌ Lỗi getSanPhamById:", error);
    res.status(500).json({ message: "Lỗi khi lấy sản phẩm" });
  }
};

// Tạo sản phẩm mới (admin)
export const createSanPham = async (req: AuthRequest, res: Response) => {
  try {
    const data: SanPham & { VungMien?: string; LoaiDoAn?: string } = req.body;
    if (data.HanSuDung)
      data.HanSuDung = new Date(data.HanSuDung).toISOString().split("T")[0];

    const user_id = req.user?.id;
    if (!user_id)
      return res.status(401).json({ message: "Token không hợp lệ" });

    const [existing]: any = await db.query(
      `SELECT MaSP FROM sanpham WHERE TenSP = ? AND XuatXu = ? AND VungMien = ?`,
      [data.TenSP, data.XuatXu, data.VungMien || "Bắc"]
    );

    if (existing.length > 0)
      return res.status(400).json({ message: "Sản phẩm này đã tồn tại" });

    let GiaSauGiam = data.GiaBan;
    if (data.Voucher && data.Voucher.includes("%")) {
      const percent = parseFloat(data.Voucher.replace("%", "")) || 0;
      GiaSauGiam = Math.round((data.GiaBan * (100 - percent)) / 100);
    }

    const generateRandomId = () => Math.floor(Math.random() * 900) + 100;
    let MaSP = generateRandomId();
    let exists = await db.query("SELECT MaSP FROM sanpham WHERE MaSP = ?", [
      MaSP,
    ]);
    while ((exists as any)[0].length) {
      MaSP = generateRandomId();
      exists = await db.query("SELECT MaSP FROM sanpham WHERE MaSP = ?", [
        MaSP,
      ]);
    }

    await db.query(
      `INSERT INTO sanpham
        (MaSP, TenSP, HinhAnh, GiaNhap, GiaBan, GiaSauGiam, SoLuongTon, DaBan, DanhGiaTrungBinh, TongLuotDanhGia, HanSuDung, XuatXu, MoTa, Voucher, user_id, VungMien, LoaiDoAn)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        MaSP,
        data.TenSP,
        data.HinhAnh,
        data.GiaNhap || 0,
        data.GiaBan,
        GiaSauGiam,
        data.SoLuongTon || 0,
        data.DaBan || 0,
        data.DanhGiaTrungBinh || 0,
        data.TongLuotDanhGia || 0,
        data.HanSuDung,
        data.XuatXu || "",
        data.MoTa,
        data.Voucher,
        user_id,
        data.VungMien || "Bắc",
        data.LoaiDoAn || "Đồ khô",
      ]
    );

    res.status(201).json({ message: "Thêm sản phẩm thành công", MaSP });
  } catch (error) {
    console.error("❌ Lỗi createSanPham:", error);
    if ((error as any).sqlMessage)
      console.error("SQL Message:", (error as any).sqlMessage);
    res.status(500).json({
      message: "Lỗi khi thêm sản phẩm",
      error: (error as Error).message,
    });
  }
};

// Cập nhật sản phẩm (admin)
export const updateSanPham = async (req: Request, res: Response) => {
  const { id } = req.params;
  const data: any = req.body;
  if (data.HanSuDung)
    data.HanSuDung = new Date(data.HanSuDung).toISOString().split("T")[0];

  try {
    delete data.user_id;

    Object.keys(data).forEach((key) => {
      if (data[key] === undefined || data[key] === null) delete data[key];
    });

    if (Object.keys(data).length === 0)
      return res.status(400).json({ message: "Không có dữ liệu để cập nhật" });

    if (data.Voucher || data.GiaBan) {
      const [sp]: any = await db.query(
        "SELECT GiaBan, Voucher FROM sanpham WHERE MaSP = ?",
        [id]
      );
      const current = sp[0];
      const newGiaBan = data.GiaBan ?? current.GiaBan;
      const newVoucher = data.Voucher ?? current.Voucher;
      let GiaSauGiam = newGiaBan;

      if (newVoucher && newVoucher.includes("%")) {
        const percent = parseFloat(newVoucher.replace("%", "")) || 0;
        GiaSauGiam = Math.round((newGiaBan * (100 - percent)) / 100);
      }
      data.GiaSauGiam = GiaSauGiam;
    }

    await db.query(`UPDATE sanpham SET ? WHERE MaSP = ?`, [data, id]);
    res.json({ message: "Cập nhật sản phẩm thành công" });
  } catch (error) {
    console.error("❌ Lỗi updateSanPham:", error);
    if ((error as any).sqlMessage)
      console.error("SQL Message:", (error as any).sqlMessage);
    res.status(500).json({
      message: "Lỗi khi cập nhật sản phẩm",
      error: (error as Error).message,
    });
  }
};

// 🗑️ Xóa mềm sản phẩm – Không lỗi khóa ngoại
export const deleteSanPham = async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const [result]: any = await db.query(
      `UPDATE sanpham 
       SET is_deleted = 1, 
           deleted_at = NOW() 
       WHERE MaSP = ? AND is_deleted = 0`,
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        message:
          "Không tìm thấy sản phẩm hoặc sản phẩm đã bị xóa trước đó rồi á ~",
      });
    }

    res.json({
      message:
        "Đã xóa sản phẩm thành công! (Đã ẩn khỏi hệ thống, đơn hàng cũ vẫn giữ nguyên nha chồng iu ♥)",
    });
  } catch (error) {
    console.error("❌ Lỗi soft delete sản phẩm:", error);
    res.status(500).json({
      message: "Có lỗi xảy ra khi xóa sản phẩm",
    });
  }
};
