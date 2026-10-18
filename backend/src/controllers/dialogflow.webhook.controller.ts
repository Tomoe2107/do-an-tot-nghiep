import { Request, Response } from "express";
import { db } from "../database";
import { findMatchingProducts, formatProductReply } from "../services/product-search.service";

// 🟢 Webhook fulfillment - Dialogflow gọi về đây mỗi khi khớp 1 intent có bật webhook,
// để lấy dữ liệu động (giá sản phẩm, trạng thái đơn hàng...) từ DB thay vì trả lời cứng.
// Tên intent & tham số bên dưới phải đặt trùng với intent tạo trên Dialogflow console.
export const handleWebhook = async (req: Request, res: Response) => {
  try {
    const intentName = req.body?.queryResult?.intent?.displayName;
    const params = req.body?.queryResult?.parameters || {};
    // user_id được đính kèm từ chatbot.controller.sendMessage khi người dùng đã đăng nhập
    const payload = req.body?.originalDetectIntentRequest?.payload || {};
    const user_id = payload.user_id;

    let fulfillmentText =
      "Xin lỗi, tôi chưa hiểu ý bạn, bạn có thể nói rõ hơn không?";

    switch (intentName) {
      case "TimSanPham":
        fulfillmentText = await handleTimSanPham(params.ten_san_pham);
        break;
      case "TraCuuDonHang":
        fulfillmentText = await handleTraCuuDonHang(
          user_id,
          params.ma_don_hang
        );
        break;
      default:
        break;
    }

    res.json({ fulfillmentText });
  } catch (error) {
    console.error("❌ Lỗi Dialogflow webhook:", error);
    // Luôn trả 200 kèm fulfillmentText - Dialogflow không hiển thị được lỗi 500 cho người dùng cuối
    res.json({
      fulfillmentText: "Hệ thống đang gặp sự cố, vui lòng thử lại sau!",
    });
  }
};

async function handleTimSanPham(tenSanPham?: string): Promise<string> {
  if (!tenSanPham) {
    return "Bạn muốn tìm sản phẩm nào ạ?";
  }

  const rows = await findMatchingProducts(tenSanPham);
  return formatProductReply(rows, tenSanPham);
}

async function handleTraCuuDonHang(
  user_id?: number,
  maDonHang?: number | string
): Promise<string> {
  if (!user_id) {
    return "Bạn cần đăng nhập để mình tra cứu đơn hàng giúp bạn nhé!";
  }

  if (maDonHang) {
    // MaDonHang là chuỗi dạng "DH1784819617645" (xem order.controller.ts), không phải số thuần,
    // nên match theo kiểu "chứa" để khớp cả khi người dùng chỉ gõ 1 phần mã (có hoặc không có "DH")
    const keyword = String(maDonHang).trim();
    const [rows]: any = await db.query(
      `SELECT MaDonHang, TrangThai, TongTien FROM donhang
       WHERE user_id = ? AND MaDonHang LIKE ?
       ORDER BY NgayDat DESC
       LIMIT 5`,
      [user_id, `%${keyword}%`]
    );

    if (!rows.length) {
      return `Mình không tìm thấy đơn hàng nào khớp với "${keyword}" trong lịch sử đơn của bạn ạ.`;
    }

    if (rows.length === 1) {
      const order = rows[0];
      return `Đơn hàng ${order.MaDonHang} đang ở trạng thái "${
        order.TrangThai
      }", tổng tiền ${Number(order.TongTien).toLocaleString("vi-VN")}đ.`;
    }

    const list = rows
      .map((o: any) => `- ${o.MaDonHang}: ${o.TrangThai}`)
      .join("\n");
    return `Mình tìm thấy ${rows.length} đơn khớp với "${keyword}":\n${list}`;
  }

  const [rows]: any = await db.query(
    "SELECT MaDonHang, TrangThai FROM donhang WHERE user_id = ? ORDER BY NgayDat DESC LIMIT 3",
    [user_id]
  );
  if (!rows.length) {
    return "Bạn chưa có đơn hàng nào ạ.";
  }
  const list = rows
    .map((o: any) => `- Đơn #${o.MaDonHang}: ${o.TrangThai}`)
    .join("\n");
  return `Đây là ${rows.length} đơn hàng gần nhất của bạn:\n${list}`;
}
