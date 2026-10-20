import { Request, Response } from "express";
import jwt from "jsonwebtoken";
import { detectIntent } from "../services/dialogflow.service";
import {
  findMatchingProducts,
  findMatchingProductsLoose,
  formatProductReply,
  ProductMatch,
} from "../services/product-search.service";
import { markNeedsHuman, extractNeedsHuman } from "../constants/chatbot";

const JWT_SECRET = process.env.JWT_SECRET || "defaultsecret";

// Mã đơn hàng thật có dạng "DH1784819617645" hoặc 1 đoạn số (vd "45", "604805"),
// có thể kèm "#" phía trước. Dùng để phân biệt "gõ mã đơn" với "gõ tên sản phẩm" -
// NLU hay nhầm các từ ngắn như "khoai" thành ý định tra cứu đơn hàng.
const isOrderCodeShaped = (text: string): boolean =>
  /^#?(dh)?\d+$/i.test(text.trim());

// Phân biệt "gõ tên món ăn ngắn gọn" (vd "khoai", "cá kho") với "gõ cả câu hỏi dài"
// (vd "cụ thể chính sách như nào") khi cả 2 đều bị NLU nhận nhầm thành mã đơn hàng.
// Từ ngắn (≤4 từ) thì coi là tên món -> trả lời "shop chưa bán mặt hàng này" là đủ.
// Câu dài hơn thì không phải tên món mà là 1 câu hỏi bot không hiểu được -> nên
// chuyển hướng sang nhắn tin Messenger cho người thật xử lý, thay vì trả lời sai lạc đề.
const looksLikeFoodItemQuery = (text: string): boolean =>
  text.trim().split(/\s+/).length <= 4;

// Lưới an toàn thứ 2: 1 số intent Dialogflow có câu trả lời cấu hình cứng ngay trên
// console (không đi qua code này) mà nội dung thực chất là bảo khách tự liên hệ -
// vd "Bạn hãy chat trực tiếp với shop nha!". Dialogflow coi đây là match thành công
// (isFallback=false) nên lưới an toàn isFallback phía dưới không bắt được. Phát hiện
// thêm bằng từ khoá để vẫn tự điều hướng Messenger cho đúng ý, thay vì để khách tự đọc
// rồi tự tìm cách liên hệ.
const HUMAN_HANDOFF_HINTS = [
  "chat trực tiếp",
  "nhắn tin trực tiếp",
  "liên hệ trực tiếp",
  "inbox trực tiếp",
  "liên hệ shop",
  "liên hệ admin",
];
const mentionsDirectContact = (text: string): boolean => {
  const lower = text.toLowerCase();
  return HUMAN_HANDOFF_HINTS.some((hint) => lower.includes(hint));
};

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
    let products: ProductMatch[] = [];

    // Lưới an toàn: NLU của Dialogflow chỉ nhận đúng những câu/từ đã được train, không
    // bao giờ phủ hết được toàn bộ tên sản phẩm trong DB. Nên nếu Dialogflow chưa nhận ra
    // đây là câu tìm sản phẩm (intent khác TimSanPham), vẫn thử dò thẳng tên sản phẩm
    // trong DB theo đúng tin nhắn gốc - đảm bảo gõ đúng tên sản phẩm có thật luôn trả lời được.
    if (intent !== "TimSanPham") {
      const trimmed = message.trim();
      const loose = await findMatchingProductsLoose(trimmed);

      if (loose.length) {
        reply = formatProductReply(loose, trimmed);
        intent = "TimSanPham";
        isFallback = false;
        products = loose;
      } else {
        // Chỉ ghi đè khi Dialogflow đã THỰC SỰ trích ra giá trị cho ma_don_hang
        // (không rỗng) mà giá trị đó lại không giống mã đơn - tức bot nhận nhầm
        // 1 từ như "khoai" thành mã đơn hàng. Nếu ma_don_hang còn rỗng (Dialogflow
        // đang hỏi lại mã, vd "kiểm tra đơn hàng") thì giữ nguyên câu hỏi lại đó.
        const maDonHang = (result.parameters?.ma_don_hang as string) || "";
        if (
          intent === "TraCuuDonHang" &&
          maDonHang &&
          !isOrderCodeShaped(maDonHang)
        ) {
          reply = looksLikeFoodItemQuery(maDonHang)
            ? `Hiện tại shop mình chưa bán mặt hàng "${maDonHang}" ạ.`
            : markNeedsHuman("Mình chưa hiểu rõ câu hỏi này của bạn.");
          intent = "TimSanPham";
          isFallback = false;
        }
      }
    } else {
      // Dialogflow đã nhận đúng intent qua webhook riêng (không đi qua code này), nên
      // tự dò lại sản phẩm ở đây để lấy kèm ảnh minh hoạ gửi về cho FE hiển thị.
      const keyword =
        (result.parameters?.ten_san_pham as string) || message.trim();
      products = await findMatchingProducts(keyword);
    }

    // Bóc marker "cần người thật" nếu có (từ webhook tra đơn hàng, hoặc từ nhánh
    // câu hỏi dài phía trên) - gộp chung với cờ isFallback gốc của Dialogflow để
    // FE biết khi nào cần tự mở Messenger, không hiển thị link thô trong chat.
    const extracted = extractNeedsHuman(reply);
    reply = extracted.text;
    isFallback = isFallback || extracted.needsHuman || mentionsDirectContact(reply);

    res.json({
      sessionId: finalSessionId,
      reply,
      intent,
      isFallback,
      products: products.map((p) => ({
        id: p.MaSP,
        name: p.TenSP,
        price: p.GiaSauGiam,
        image: p.HinhAnh,
      })),
    });
  } catch (error) {
    console.error("❌ Lỗi chatbot sendMessage:", error);
    res.status(500).json({
      message: "Lỗi khi gửi tin nhắn tới chatbot",
      error: (error as Error).message,
    });
  }
};
