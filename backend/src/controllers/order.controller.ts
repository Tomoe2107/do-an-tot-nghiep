// 📁 src/controllers/order.controller.ts
import { Response } from "express";
import { db } from "../database";
import { AuthRequest } from "../middlewares/authMiddleware";
import { addPendingOrder } from "../cron/update.status.automatic";

// ===================== HOÀN TẤT ĐƠN HÀNG KHI ĐÃ XÁC NHẬN THANH TOÁN THẬT =====================
// Dùng chung cho mọi phương thức thanh toán "chờ xác nhận" (PayPal, Chuyển khoản QR...).
// Đơn tạo qua checkout()/checkoutDirectly() với các phương thức này KHÔNG hề đụng tới giỏ
// hàng/tồn kho lúc tạo - GhiChu tạm lưu JSON { SanPhamDaChon | items, GhiChu } để tại đây mới
// thực sự chuyển sản phẩm từ giỏ sang đơn thật + trừ tồn kho, đúng lúc thanh toán được xác
// nhận thật sự (PayPal capture COMPLETED, hoặc admin tự tay xác nhận đã nhận chuyển khoản).
export async function finalizeOrder(MaDonHang: string): Promise<boolean> {
  const [orderRows]: any = await db.query(
    "SELECT user_id, GhiChu, TrangThai FROM donhang WHERE MaDonHang = ?",
    [MaDonHang]
  );
  const order = orderRows[0];
  if (!order) return false;

  // Đã xử lý rồi (vd webhook và FE cùng gọi vào) thì bỏ qua, tránh trừ tồn kho 2 lần.
  if (order.TrangThai === "Đã xác nhận") return true;

  let stash: any = {};
  try {
    stash = JSON.parse(order.GhiChu || "{}");
  } catch {
    stash = {};
  }
  const directItems = Array.isArray(stash.items) ? stash.items : [];
  const SanPhamDaChon = Array.isArray(stash.SanPhamDaChon)
    ? stash.SanPhamDaChon
    : [];

  if (!directItems.length && !SanPhamDaChon.length) {
    // Không có gì cần chuyển (đơn không qua giỏ hàng/mua ngay kiểu hoãn) - chỉ đổi trạng thái.
    await db.query(
      "UPDATE donhang SET TrangThai = 'Đã xác nhận', NgayCapNhat = NOW() WHERE MaDonHang = ?",
      [MaDonHang]
    );
    return true;
  }

  const connection = await db.getConnection();
  await connection.beginTransaction();
  try {
    if (directItems.length) {
      for (const item of directItems) {
        await connection.query(
          `INSERT INTO chitietdonhang (MaDonHang, MaSP, SoLuong, GiaBanTaiThoiDiem) VALUES (?, ?, ?, ?)`,
          [MaDonHang, item.MaSP, item.SoLuong, item.GiaBanTaiThoiDiem]
        );
        await connection.query(
          `UPDATE sanpham SET SoLuongTon = SoLuongTon - ?, DaBan = DaBan + ? WHERE MaSP = ?`,
          [item.SoLuong, item.SoLuong, item.MaSP]
        );
      }
    } else {
      const tempOrderId = `CART_${order.user_id}`;
      const [cartItems]: any = await connection.query(
        `SELECT MaSP, SoLuong FROM chitietdonhang WHERE MaDonHang = ? AND MaSP IN (?) FOR UPDATE`,
        [tempOrderId, SanPhamDaChon]
      );
      await connection.query(
        `UPDATE chitietdonhang SET MaDonHang = ? WHERE MaDonHang = ? AND MaSP IN (?)`,
        [MaDonHang, tempOrderId, SanPhamDaChon]
      );
      for (const item of cartItems) {
        await connection.query(
          `UPDATE sanpham SET SoLuongTon = SoLuongTon - ?, DaBan = DaBan + ? WHERE MaSP = ?`,
          [item.SoLuong, item.SoLuong, item.MaSP]
        );
      }
    }

    await connection.query(
      "UPDATE donhang SET TrangThai = 'Đã xác nhận', GhiChu = ?, NgayCapNhat = NOW() WHERE MaDonHang = ?",
      [stash.GhiChu || null, MaDonHang]
    );
    await connection.commit();
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
  return true;
}

export const OrderController = {
  // Lấy danh sách đơn hàng
  async getAll(req: AuthRequest, res: Response) {
    try {
      const user_id = req.user?.id;
      const role = req.user?.role;

      if (!user_id) return res.status(401).json({ message: "Chưa đăng nhập" });

      const { keyword, status, tuNgay, denNgay } = req.query;

      let query = `
        SELECT dh.*, kh.HoTen, kh.SoDienThoai
        FROM donhang dh
        LEFT JOIN khachhang kh ON dh.MaKH = kh.MaKH
      `;
      const conditions: string[] = [];
      const params: any[] = [];

      if (role !== "admin") {
        conditions.push("dh.user_id = ?");
        params.push(user_id);
      }
      if (keyword) {
        conditions.push(
          "(dh.MaDonHang LIKE ? OR kh.HoTen LIKE ? OR kh.SoDienThoai LIKE ?)"
        );
        params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
      }
      if (status) {
        conditions.push("dh.TrangThai = ?");
        params.push(status);
      }
      if (tuNgay) {
        conditions.push("DATE(dh.NgayDat) >= ?");
        params.push(tuNgay);
      }
      if (denNgay) {
        conditions.push("DATE(dh.NgayDat) <= ?");
        params.push(denNgay);
      }

      if (conditions.length) {
        query += " WHERE " + conditions.join(" AND ");
      }
      query += " ORDER BY dh.NgayDat DESC";

      const [rows]: any = await db.query(query, params);
      res.json(rows);
    } catch (err) {
      console.error("Lỗi khi lấy danh sách đơn hàng:", err);
      res
        .status(500)
        .json({ message: "Lỗi khi lấy danh sách đơn hàng", error: err });
    }
  },

  // Lấy đơn hàng theo ID
  async getById(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const user_id = req.user?.id;
      const role = req.user?.role;

      if (!user_id) return res.status(401).json({ message: "Chưa đăng nhập" });

      const [order]: any = await db.query(
        role === "admin"
          ? "SELECT * FROM donhang WHERE MaDonHang = ?"
          : "SELECT * FROM donhang WHERE MaDonHang = ? AND user_id = ?",
        role === "admin" ? [id] : [id, user_id]
      );

      if (!order.length)
        return res.status(404).json({ message: "Không tìm thấy đơn hàng" });

      const [details]: any = await db.query(
        `SELECT ctdh.*, sp.TenSP, sp.HinhAnh
         FROM chitietdonhang ctdh
         JOIN sanpham sp ON ctdh.MaSP = sp.MaSP
         WHERE ctdh.MaDonHang = ?`,
        [id]
      );

      res.json({ ...order[0], ChiTiet: details });
    } catch (err) {
      res.status(500).json({ message: "Lỗi khi lấy đơn hàng", error: err });
    }
  },

  // Cập nhật trạng thái - Chỉ admin
  async updateStatus(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const user_id = req.user?.id;
      const role = req.user?.role;
      const { TrangThai } = req.body;

      if (!user_id) return res.status(401).json({ message: "Chưa đăng nhập" });
      if (!TrangThai)
        return res.status(400).json({ message: "Thiếu trạng thái" });

      // Chuẩn hoá chuỗi trạng thái - tiếng Việt có nhiều cách gõ dấu hợp lệ cho cùng 1 từ
      // (vd "huỷ" dấu trên y / "hủy" dấu trên u), so sánh tuyệt đối rất dễ lệch giữa FE/BE
      // (đã lệch 2 lần rồi). Dùng hàm chuẩn hoá để nhận diện đúng ý định bất kể FE gõ dấu
      // kiểu nào, đồng thời LUÔN ghi giá trị chuẩn (đúng theo enum trong model) vào DB,
      // không ghi thẳng chuỗi thô của client - tránh DB có nhiều biến thể của cùng 1 trạng thái.
      const normalize = (s: string) =>
        s.trim().toLowerCase().normalize("NFC").replace(/\s+/g, " ");
      const CANCEL_ALIASES = ["đã hủy", "đã huỷ", "hủy", "huỷ", "huỷ đơn", "hủy đơn"];
      const CLAIM_ALIASES = ["chờ xác nhận"];
      const normalized = normalize(TrangThai);
      const isCancelRequest = CANCEL_ALIASES.includes(normalized);
      const isClaimRequest = CLAIM_ALIASES.includes(normalized);

      // Khách hàng chỉ được: (1) tự huỷ đơn của mình, hoặc (2) tự báo "Chờ xác nhận" (vd bấm
      // "Đã chuyển khoản - Hoàn tất" trên mã QR) - đây chỉ là LỜI KHAI, không có quyền lực gì,
      // không trừ kho/không dọn giỏ hàng. Khách KHÔNG được tự đặt "Đã xác nhận" hay các bước
      // sau - đó là lúc admin xác nhận đã thật sự nhận được tiền/chuyển khoản (có finalizeOrder
      // lo phần trừ kho + chuyển giỏ hàng sang đơn thật). Nếu không chặn, khách có thể tự gọi
      // API này để "thanh toán giả" mà không cần trả tiền.
      if (role !== "admin" && !isCancelRequest && !isClaimRequest) {
        return res.status(403).json({
          message:
            "Bạn chỉ có thể huỷ đơn hoặc báo đã chuyển khoản, việc xác nhận đơn hàng do quản trị viên thực hiện",
        });
      }

      if (role === "admin" && TrangThai === "Đã xác nhận") {
        const finalized = await finalizeOrder(id);
        if (!finalized)
          return res.status(404).json({ message: "Không tìm thấy đơn hàng" });
        addPendingOrder(id);
        return res.json({ message: "Cập nhật trạng thái thành công" });
      }

      // Ghi giá trị chuẩn thay vì chuỗi thô của client cho 2 trường hợp khách tự gửi, để DB
      // luôn nhất quán 1 cách viết duy nhất. Dùng "Hủy" (không phải "Đã hủy" như khai báo
      // trong order.model.ts) vì đó mới là chuỗi FE thực sự đang so khớp ở mọi nơi (badge
      // trạng thái, lọc tab trong order-manage.tsx/order-detail.tsx) - model.ts chỉ là kiểu
      // TypeScript tham khảo, không ràng buộc DB, và đang lệch so với FE thật.
      const finalTrangThai = isCancelRequest
        ? "Hủy"
        : isClaimRequest
        ? "Chờ xác nhận"
        : TrangThai;

      const [result]: any = await db.query(
        role === "admin"
          ? "UPDATE donhang SET TrangThai = ? WHERE MaDonHang = ?"
          : "UPDATE donhang SET TrangThai = ? WHERE MaDonHang = ? AND user_id = ?",
        role === "admin"
          ? [finalTrangThai, id]
          : [finalTrangThai, id, user_id]
      );

      if (result.affectedRows === 0)
        return res
          .status(404)
          .json({ message: "Không tìm thấy đơn hàng hoặc bạn không có quyền" });

      res.json({ message: "Cập nhật trạng thái thành công" });
    } catch (err) {
      res.status(500).json({ message: "Lỗi khi cập nhật", error: err });
    }
  },

  // Xóa đơn hàng
  async delete(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const user_id = req.user?.id;
      const role = req.user?.role;

      if (!user_id) return res.status(401).json({ message: "Chưa đăng nhập" });

      const [result]: any = await db.query(
        role === "admin"
          ? "DELETE FROM donhang WHERE MaDonHang = ?"
          : "DELETE FROM donhang WHERE MaDonHang = ? AND user_id = ?",
        role === "admin" ? [id] : [id, user_id]
      );

      if (result.affectedRows === 0)
        return res
          .status(404)
          .json({ message: "Không tìm thấy đơn hàng hoặc bạn không có quyền" });

      res.json({ message: "Xóa đơn hàng thành công" });
    } catch (err) {
      res.status(500).json({ message: "Lỗi khi xóa", error: err });
    }
  },

  // Thanh toán giỏ hàng
  async checkout(req: AuthRequest, res: Response) {
    const connection = await db.getConnection();
    await connection.beginTransaction();

    try {
      const user_id = req.user?.id;
      if (!user_id)
        return res.status(401).json({ message: "Vui lòng đăng nhập" });

      const {
        PhuongThucThanhToan,
        DiaChiGiaoHang,
        GhiChu,
        SanPhamDaChon,
        KhoangCach,
        PhiShip = 0,
      } = req.body;

      if (!PhuongThucThanhToan || !DiaChiGiaoHang)
        return res.status(400).json({ message: "Thiếu thông tin thanh toán" });

      if (!Array.isArray(SanPhamDaChon) || SanPhamDaChon.length === 0)
        return res
          .status(400)
          .json({ message: "Không có sản phẩm nào được chọn để thanh toán" });

      const tempOrderId = `CART_${user_id}`;

      const [cartItems]: any = await connection.query(
        `SELECT ctdh.*, sp.SoLuongTon, sp.TenSP 
         FROM chitietdonhang ctdh
         JOIN sanpham sp ON ctdh.MaSP = sp.MaSP
         WHERE ctdh.MaDonHang = ? AND ctdh.MaSP IN (?) FOR UPDATE`,
        [tempOrderId, SanPhamDaChon]
      );

      if (!cartItems.length)
        return res
          .status(400)
          .json({ message: "Không tìm thấy sản phẩm trong giỏ" });

      for (const item of cartItems) {
        if (!Number.isInteger(item.SoLuong) || item.SoLuong <= 0) {
          await connection.rollback();
          return res
            .status(400)
            .json({ message: "Số lượng sản phẩm trong giỏ không hợp lệ" });
        }
        if (item.SoLuongTon < item.SoLuong) {
          await connection.rollback();
          return res.status(400).json({
            message: `Sản phẩm "${item.TenSP}" chỉ còn ${item.SoLuongTon} cái`,
          });
        }
      }

      const [khach]: any = await connection.query(
        `SELECT MaKH FROM khachhang WHERE user_id = ?`,
        [user_id]
      );
      if (!khach.length) {
        await connection.rollback();
        return res
          .status(400)
          .json({ message: "Chưa có thông tin khách hàng" });
      }
      const MaKH = khach[0].MaKH;

      const [lastOrder]: any = await connection.query(
        `SELECT MaDonHang FROM donhang ORDER BY MaDonHang DESC LIMIT 1`
      );
      const lastNum = lastOrder.length
        ? parseInt(lastOrder[0].MaDonHang.replace("DH", ""), 10)
        : 0;
      const MaDonHang = `DH${String(lastNum + 1).padStart(4, "0")}`;

      const TongTienSanPham = cartItems.reduce(
        (sum: number, item: any) => sum + item.SoLuong * item.GiaBanTaiThoiDiem,
        0
      );
      const TongTien = TongTienSanPham + Number(PhiShip);

      // PayPal: chưa chắc khách đã thật sự trả tiền tại thời điểm bấm "Thanh toán" (họ có
      // thể huỷ/bấm back ngay trên trang PayPal) - nên KHÔNG được trừ tồn kho hay dọn khỏi
      // giỏ hàng ở đây. Tạo đơn ở trạng thái "Chờ thanh toán" và giữ nguyên giỏ hàng; việc
      // trừ tồn kho + chuyển hàng từ giỏ sang đơn thật chỉ thực hiện trong paypalSuccess/
      // paypalWebhook khi PayPal xác nhận COMPLETED thật sự (xem paypal.controller.ts).
      const needsPaymentConfirmation = PhuongThucThanhToan === "PayPal" || PhuongThucThanhToan === "Chuyển khoản";

      await connection.query(
        `INSERT INTO donhang
         (MaDonHang, MaKH, user_id, TongTien, TrangThai, PhuongThucThanhToan, DiaChiGiaoHang, GhiChu, NgayDat, KhoangCach, PhiShip)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?, ?)`,
        [
          MaDonHang,
          MaKH,
          user_id,
          TongTien,
          needsPaymentConfirmation ? "Chờ thanh toán" : "Chờ xác nhận",
          PhuongThucThanhToan,
          DiaChiGiaoHang,
          needsPaymentConfirmation
            ? JSON.stringify({ SanPhamDaChon, GhiChu: GhiChu || null })
            : GhiChu || null,
          KhoangCach || null,
          PhiShip,
        ]
      );

      if (!needsPaymentConfirmation) {
        await connection.query(
          `UPDATE chitietdonhang
           SET MaDonHang = ?
           WHERE MaDonHang = ? AND MaSP IN (?)`,
          [MaDonHang, tempOrderId, SanPhamDaChon]
        );

        for (const item of cartItems) {
          await connection.query(
            `UPDATE sanpham
             SET SoLuongTon = SoLuongTon - ?, DaBan = DaBan + ?
             WHERE MaSP = ?`,
            [item.SoLuong, item.SoLuong, item.MaSP]
          );
        }
      }

      await connection.commit();
      res.status(201).json({
        message: needsPaymentConfirmation
          ? "Đã tạo đơn, đang chờ xác nhận thanh toán PayPal"
          : "Thanh toán thành công!",
        MaDonHang,
      });
    } catch (err) {
      await connection.rollback();
      console.error("Lỗi checkout:", err);
      res.status(500).json({ message: "Lỗi khi thanh toán", error: err });
    } finally {
      connection.release();
    }
  },

  // Lấy giỏ hàng
  async getCart(req: AuthRequest, res: Response) {
    try {
      const user_id = req.user?.id;
      if (!user_id) return res.status(401).json({ message: "Chưa đăng nhập" });

      const tempOrderId = `CART_${user_id}`;
      const [rows]: any = await db.query(
        `SELECT ctdh.*, sp.TenSP, sp.HinhAnh, (ctdh.SoLuong * ctdh.GiaBanTaiThoiDiem) AS ThanhTien
         FROM chitietdonhang ctdh
         JOIN sanpham sp ON ctdh.MaSP = sp.MaSP
         WHERE ctdh.MaDonHang = ?`,
        [tempOrderId]
      );
      res.json(rows);
    } catch (err) {
      res.status(500).json({ message: "Lỗi khi lấy giỏ hàng", error: err });
    }
  },

  // Xóa sản phẩm trong giỏ
  async deleteFromCart(req: AuthRequest, res: Response) {
    try {
      const user_id = req.user?.id;
      const { MaSP } = req.params;
      if (!user_id || !MaSP)
        return res.status(400).json({ message: "Thiếu thông tin" });

      const tempOrderId = `CART_${user_id}`;
      const [result]: any = await db.query(
        `DELETE FROM chitietdonhang WHERE MaDonHang = ? AND MaSP = ?`,
        [tempOrderId, MaSP]
      );

      if (result.affectedRows === 0)
        return res.status(404).json({ message: "Không tìm thấy sản phẩm" });

      res.json({ message: "Xóa sản phẩm thành công!" });
    } catch (err) {
      res.status(500).json({ message: "Lỗi khi xóa", error: err });
    }
  },

  // THANH TOÁN TRỰC TIẾP – MUA NGAY
  async checkoutDirectly(req: AuthRequest, res: Response) {
    const connection = await db.getConnection();
    await connection.beginTransaction();

    try {
      const user_id = req.user?.id;
      if (!user_id)
        return res.status(401).json({ message: "Vui lòng đăng nhập" });

      const {
        PhuongThucThanhToan,
        DiaChiGiaoHang,
        GhiChu,
        items,
        KhoangCach,
        PhiShip = 0,
      } = req.body;

      if (!PhuongThucThanhToan || !DiaChiGiaoHang)
        return res.status(400).json({ message: "Thiếu thông tin thanh toán" });

      if (!Array.isArray(items) || items.length === 0)
        return res
          .status(400)
          .json({ message: "Không có sản phẩm nào để thanh toán" });

      const placeholders = items.map(() => "?").join(",");
      const maSPList = items.map((i: any) => i.MaSP);

      const [products]: any = await connection.query(
        `SELECT MaSP, TenSP, SoLuongTon 
         FROM sanpham 
         WHERE MaSP IN (${placeholders}) FOR UPDATE`,
        maSPList
      );

      if (products.length !== items.length) {
        await connection.rollback();
        return res
          .status(400)
          .json({ message: "Một số sản phẩm không tồn tại!" });
      }

      for (const item of items) {
        if (!Number.isInteger(item.SoLuong) || item.SoLuong <= 0) {
          await connection.rollback();
          return res
            .status(400)
            .json({ message: "Số lượng sản phẩm phải là số nguyên dương" });
        }

        const product = products.find((p: any) => p.MaSP === item.MaSP);
        if (!product || product.SoLuongTon < item.SoLuong) {
          await connection.rollback();
          return res.status(400).json({
            message: `Sản phẩm "${product?.TenSP || item.MaSP}" chỉ còn ${
              product?.SoLuongTon || 0
            } cái`,
          });
        }
      }

      const [khach]: any = await connection.query(
        `SELECT MaKH FROM khachhang WHERE user_id = ?`,
        [user_id]
      );
      if (!khach.length) {
        await connection.rollback();
        return res
          .status(400)
          .json({ message: "Chưa có thông tin khách hàng" });
      }
      const MaKH = khach[0].MaKH;

      const MaDonHang = "DH" + Date.now();

      const TongTienSanPham = items.reduce(
        (sum: number, item: any) => sum + item.SoLuong * item.GiaBanTaiThoiDiem,
        0
      );
      const TongTien = TongTienSanPham + Number(PhiShip);

      // PayPal: chưa chắc khách đã trả tiền thật lúc bấm "Mua ngay" (có thể huỷ/back ở trang
      // PayPal) - không được trừ tồn kho ngay. Tạo đơn "Chờ thanh toán", lưu tạm danh sách
      // sản phẩm để finalizePaypalOrder() trong paypal.controller.ts tạo chi tiết đơn + trừ
      // tồn kho khi PayPal xác nhận COMPLETED thật sự.
      const needsPaymentConfirmation = PhuongThucThanhToan === "PayPal" || PhuongThucThanhToan === "Chuyển khoản";

      await connection.query(
        `INSERT INTO donhang
         (MaDonHang, MaKH, user_id, TongTien, TrangThai, PhuongThucThanhToan, DiaChiGiaoHang, GhiChu, NgayDat, KhoangCach, PhiShip)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?, ?)`,
        [
          MaDonHang,
          MaKH,
          user_id,
          TongTien,
          needsPaymentConfirmation ? "Chờ thanh toán" : "Chờ xác nhận",
          PhuongThucThanhToan,
          DiaChiGiaoHang,
          needsPaymentConfirmation ? JSON.stringify({ items, GhiChu: GhiChu || null }) : GhiChu || null,
          KhoangCach || null,
          PhiShip,
        ]
      );

      if (!needsPaymentConfirmation) {
        for (const item of items) {
          await connection.query(
            `INSERT INTO chitietdonhang
             (MaDonHang, MaSP, SoLuong, GiaBanTaiThoiDiem)
             VALUES (?, ?, ?, ?)`,
            [MaDonHang, item.MaSP, item.SoLuong, item.GiaBanTaiThoiDiem]
          );
        }

        for (const item of items) {
          await connection.query(
            `UPDATE sanpham
             SET SoLuongTon = SoLuongTon - ?, DaBan = DaBan + ?
             WHERE MaSP = ?`,
            [item.SoLuong, item.SoLuong, item.MaSP]
          );
        }
      }

      await connection.commit();
      res.status(201).json({
        message: needsPaymentConfirmation
          ? "Đã tạo đơn, đang chờ xác nhận thanh toán PayPal"
          : "Thanh toán trực tiếp thành công!",
        MaDonHang,
      });
    } catch (err: any) {
      await connection.rollback();
      console.error("Lỗi checkoutDirectly:", err);
      res.status(500).json({
        message: "Lỗi khi thanh toán trực tiếp",
        error: err.message,
      });
    } finally {
      connection.release();
    }
  },
};
