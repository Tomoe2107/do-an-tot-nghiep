import { Request, Response } from "express";
import jwt from "jsonwebtoken";
import { detectIntent } from "../services/dialogflow.service";
import {
  findMatchingProductsLoose,
  formatProductReply,
} from "../services/product-search.service";

if (!process.env.JWT_SECRET) {
  throw new Error(
    "Thiếu JWT_SECRET trong biến môi trường - không được phép chạy với secret mặc định"
  );
}
const JWT_SECRET = process.env.JWT_SECRET;

// Chat cho cả khách lẫn người đã đăng nhập nên không bắt buộc Bearer token
// như authMiddleware - có thì giải mã lấy user_id để webhook tra đơn hàng dùng, không có thì bỏ qua.
const tryGetUserId = (req: Request): number | undefined => {
  const authHeader = req.headers["authorization"];
  if (!authHeader) return undefined;
  const [scheme, token] = authHeader.split(" ");
  if (scheme !== "Bearer" || !token) return undefined;
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { id?: number };
    return decoded.id;
  } catch {
    return undefined;
  }
};

// 🟢 Gửi tin nhắn người dùng tới Dialogflow, trả về câu trả lời đã khớp intent
export const sendMessage = async (req: Request, res: Response) => {
  try {
    const { message, sessionId } = req.body;

    if (!message || typeof message !== "string") {
      return res.status(400).json({ message: "Thiếu nội dung tin nhắn" });
    }

    const user_id = tryGetUserId(req);
    // Mỗi phiên chat cần 1 sessionId ổn định để Dialogflow giữ ngữ cảnh hội thoại giữa các lượt;
    // FE nên tự sinh & lưu sessionId (vd trong localStorage) rồi gửi lại cho các lượt chat sau.
    const finalSessionId =
      sessionId || `guest_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;

    const result = await detectIntent(
      finalSessionId,
      message,
      user_id ? { user_id } : undefined
    );

    let reply = result.fulfillmentText;
    let intent = result.intent;
    let isFallback = result.isFallback;

    // Lưới an toàn: NLU của Dialogflow chỉ nhận đúng những câu/từ đã được train, không
    // bao giờ phủ hết được toàn bộ tên sản phẩm trong DB. Nên nếu Dialogflow chưa nhận ra
    // đây là câu tìm sản phẩm (intent khác TimSanPham), vẫn thử dò thẳng tên sản phẩm
    // trong DB theo đúng tin nhắn gốc - đảm bảo gõ đúng tên sản phẩm có thật luôn trả lời được.
    if (intent !== "TimSanPham") {
      const products = await findMatchingProductsLoose(message.trim());
      if (products.length) {
        reply = formatProductReply(products, message.trim());
        intent = "TimSanPham";
        isFallback = false;
      }
    }

    res.json({
      sessionId: finalSessionId,
      reply,
      intent,
      isFallback,
    });
  } catch (error) {
    console.error("❌ Lỗi chatbot sendMessage:", error);
    res.status(500).json({
      message: "Lỗi khi gửi tin nhắn tới chatbot",
      error: (error as Error).message,
    });
  }
};
