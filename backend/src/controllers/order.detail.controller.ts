// 📁 src/controllers/order.detail.controller.ts
import { Response } from "express";
import { db } from "../database";
import { AuthRequest } from "../middlewares/authMiddleware";

interface AddToCart {
  MaSP: number;
  SoLuong?: number;
  GiaBanTaiThoiDiem: number;
  GhiChu?: string;
}

export const OrderDetailController = {
  // 🟢 Thêm vào giỏ hàng – KHÔNG TẠO DonHang
  async addToCart(req: AuthRequest, res: Response) {
    const connection = await db.getConnection();
    await connection.beginTransaction();

    try {
      const user_id = req.user?.id;
      if (!user_id) {
        await connection.rollback();
        return res
          .status(401)
          .json({ message: "Không xác định được người dùng" });
      }

      const {
        MaSP,
        SoLuong = 1,
        GiaBanTaiThoiDiem,
        GhiChu,
      }: AddToCart = req.body;

      if (!MaSP || !GiaBanTaiThoiDiem) {
        await connection.rollback();
        return res
          .status(400)
          .json({ message: "Thiếu MaSP hoặc GiaBanTaiThoiDiem" });
      }

      if (!Number.isInteger(SoLuong) || SoLuong === 0) {
        await connection.rollback();
        return res
          .status(400)
          .json({ message: "Số lượng không hợp lệ" });
      }

      const tempOrderId = `CART_${user_id}`;

      // SoLuong ở đây là số cộng/trừ vào giỏ (nút +/- của FE dùng số âm để giảm), nên phải tính
      // ra số lượng CUỐI CÙNG trong giỏ trước khi ghi, không được để nó về 0 hoặc âm.
      const [existingCart]: any = await connection.query(
        `SELECT SoLuong FROM chitietdonhang WHERE MaDonHang = ? AND MaSP = ? FOR UPDATE`,
        [tempOrderId, MaSP]
      );
      const currentSoLuong = existingCart.length ? existingCart[0].SoLuong : 0;
      const newSoLuong = currentSoLuong + SoLuong;

      if (newSoLuong <= 0) {
        await connection.rollback();
        return res.status(400).json({
          message:
            "Số lượng sản phẩm không thể về 0 hoặc âm, hãy xóa sản phẩm khỏi giỏ nếu không muốn mua nữa",
        });
      }

      // Kiểm tra tồn kho - so với tổng số lượng SAU khi cộng/trừ, không phải chỉ riêng phần vừa gửi lên
      const [stock]: any = await connection.query(
        `SELECT SoLuongTon FROM sanpham WHERE MaSP = ? FOR UPDATE`,
        [MaSP]
      );
      if (!stock.length || stock[0].SoLuongTon < newSoLuong) {
        await connection.rollback();
        return res.status(400).json({
          message: `Sản phẩm chỉ còn ${
            stock[0]?.SoLuongTon || 0
          } cái trong kho`,
        });
      }

      // THÊM THẲNG VÀO ChiTietDonHang – KHÔNG TẠO DonHang
      const sql = `
      INSERT INTO chitietdonhang 
        (MaDonHang, MaSP, SoLuong, GiaBanTaiThoiDiem, GhiChu)
      VALUES (?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE 
        SoLuong = SoLuong + VALUES(SoLuong)
    `;

      await connection.query(sql, [
        tempOrderId,
        MaSP,
        SoLuong,
        GiaBanTaiThoiDiem,
        GhiChu || null,
      ]);

      await connection.commit();
      res.status(201).json({
        message: "Thêm vào giỏ thành công!",
        cartId: tempOrderId,
      });
    } catch (err: any) {
      await connection.rollback();
      console.error("Lỗi addToCart:", err);
      res.status(500).json({
        message: "Lỗi server",
        error: err.message || err,
      });
    } finally {
      connection.release();
    }
  },
  // 🟡 Lấy giỏ hàng
  async getCart(req: AuthRequest, res: Response) {
    const connection = await db.getConnection();
    await connection.beginTransaction();

    try {
      const user_id = req.user?.id;
      if (!user_id) {
        await connection.rollback();
        return res
          .status(401)
          .json({ message: "Không xác định được người dùng" });
      }

      const tempOrderId = `CART_${user_id}`;

      const sql = `
      SELECT 
        ctdh.MaCTDH,
        ctdh.MaSP,
        sp.TenSP,
        sp.HinhAnh,
        ctdh.SoLuong,
        ctdh.GiaBanTaiThoiDiem,
        (ctdh.SoLuong * ctdh.GiaBanTaiThoiDiem) AS ThanhTien,
        ctdh.GhiChu,
        sp.LoaiDoAn  -- ← THÊM DÒNG NÀY
      FROM chitietdonhang ctdh
      JOIN sanpham sp ON ctdh.MaSP = sp.MaSP
      WHERE ctdh.MaDonHang = ? 
      FOR UPDATE
    `;

      const [rows]: any = await connection.query(sql, [tempOrderId]);

      await connection.commit();
      res.json(rows);
    } catch (err: any) {
      await connection.rollback();
      console.error("Lỗi getCart:", err);
      res.status(500).json({
        message: "Lỗi lấy giỏ hàng",
        error: err.message || err,
      });
    } finally {
      connection.release();
    }
  },

  // 🔴 Xóa sản phẩm
  async deleteFromCart(req: AuthRequest, res: Response) {
    const connection = await db.getConnection();
    await connection.beginTransaction();

    try {
      const user_id = req.user?.id;
      if (!user_id) {
        await connection.rollback();
        return res
          .status(401)
          .json({ message: "Không xác định được người dùng" });
      }

      const { MaSP } = req.params;
      if (!MaSP) {
        await connection.rollback();
        return res.status(400).json({ message: "Thiếu MaSP" });
      }

      const tempOrderId = `CART_${user_id}`;

      const [result]: any = await connection.query(
        `DELETE FROM chitietdonhang WHERE MaDonHang = ? AND MaSP = ?`,
        [tempOrderId, MaSP]
      );

      if (result.affectedRows === 0) {
        await connection.rollback();
        return res
          .status(404)
          .json({ message: "Không tìm thấy sản phẩm trong giỏ" });
      }

      await connection.commit();
      res.json({ message: "Xóa sản phẩm thành công!" });
    } catch (err: any) {
      await connection.rollback();
      console.error("Lỗi deleteFromCart:", err);
      res.status(500).json({
        message: "Lỗi xóa sản phẩm",
        error: err.message || err,
      });
    } finally {
      connection.release();
    }
  },
};
