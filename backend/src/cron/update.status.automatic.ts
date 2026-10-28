import cron from "node-cron";
import { db } from "../database";

// Lưu trữ đơn hàng đã xác nhận và thời gian xác nhận
const pendingOrders: Record<string, number> = {}; // MaDonHang -> timestamp xác nhận

// Hàm thêm đơn vừa xác nhận vào bộ nhớ
export function addPendingOrder(MaDonHang: string) {
  pendingOrders[MaDonHang] = Date.now();
  console.log(
    `🕒 Đơn ${MaDonHang} được thêm vào bộ nhớ để tự động cập nhật trạng thái`
  );
}

// Cron chạy mỗi giây để kiểm tra đơn hàng trong bộ nhớ
cron.schedule("* * * * * *", async () => {
  const now = Date.now();

  for (const [MaDonHang, ts] of Object.entries(pendingOrders)) {
    const diff = (now - ts) / 1000; // thời gian đã trôi qua (giây)

    try {
      if (diff >= 5 && diff < 15) {
        // 5s sau xác nhận → "Đang giao"
        await db.query(
          `UPDATE DonHang SET TrangThai = 'Đang giao' WHERE MaDonHang = ? AND TrangThai = 'Đã xác nhận'`,
          [MaDonHang]
        );
        console.log(`🚚 Đơn ${MaDonHang} → Đang giao`);
      } else if (diff >= 15) {
        // 10s sau "Đang giao" → "Hoàn thành"
        await db.query(
          `UPDATE DonHang SET TrangThai = 'Hoàn thành' WHERE MaDonHang = ? AND TrangThai = 'Đang giao'`,
          [MaDonHang]
        );
        console.log(`✅ Đơn ${MaDonHang} → Hoàn thành`);
        delete pendingOrders[MaDonHang]; // xong thì xoá khỏi memory
      }
    } catch (err) {
      console.error(`❌ Lỗi cập nhật đơn ${MaDonHang}:`, err);
    }
  }
});

// Thời hạn chờ khách hoàn tất thanh toán PayPal/Chuyển khoản trước khi tự động huỷ (phút).
// Các đơn này vẫn ở "Chờ thanh toán" (chưa trừ tồn kho, chưa dọn giỏ hàng - xem finalizeOrder
// trong order.controller.ts) nên huỷ ở đây chỉ cần đổi trạng thái, không phải hoàn trả gì cả.
const PAYMENT_TIMEOUT_MINUTES = 5;

// Cron chạy mỗi phút: quét DB trực tiếp (không cần nhớ trong bộ nhớ, sống sót qua restart
// server) để tự động đánh "Thanh toán thất bại" cho đơn quá hạn chưa thanh toán - giống cách
// các sàn TMĐT lớn tự huỷ đơn khi khách không quét QR/không hoàn tất thanh toán.
cron.schedule("* * * * *", async () => {
  try {
    const [result]: any = await db.query(
      `UPDATE donhang
       SET TrangThai = 'Thanh toán thất bại', NgayCapNhat = NOW()
       WHERE TrangThai = 'Chờ thanh toán'
         AND PhuongThucThanhToan IN ('PayPal', 'Chuyển khoản')
         AND NgayDat <= DATE_SUB(NOW(), INTERVAL ? MINUTE)`,
      [PAYMENT_TIMEOUT_MINUTES]
    );
    if (result.affectedRows > 0) {
      console.log(
        `⏱️ ${result.affectedRows} đơn quá hạn ${PAYMENT_TIMEOUT_MINUTES} phút chưa thanh toán → Thanh toán thất bại`
      );
    }
  } catch (err) {
    console.error("❌ Lỗi kiểm tra đơn quá hạn thanh toán:", err);
  }
});
