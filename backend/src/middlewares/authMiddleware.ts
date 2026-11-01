import { Request, Response, NextFunction } from "express";
import jwt, { JwtPayload, TokenExpiredError } from "jsonwebtoken";
import dotenv from "dotenv";

dotenv.config();

if (!process.env.JWT_SECRET) {
  throw new Error(
    "Thiếu JWT_SECRET trong biến môi trường - không được phép chạy với secret mặc định"
  );
}
const JWT_SECRET = process.env.JWT_SECRET;

export interface AuthRequest extends Request {
  user?: JwtPayload & { id?: number; username?: string }; // tiện lấy id
}

export const authMiddleware = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers["authorization"];

    // Ưu tiên header Authorization (tương thích ngược với FE cũ chưa chuyển sang cookie);
    // nếu không có thì thử lấy từ httpOnly cookie "token" (FE mới, không tự lưu/gửi token
    // qua JS nữa - trình duyệt tự đính kèm cookie, an toàn hơn trước XSS).
    let token: string | undefined;

    if (authHeader) {
      const parts = authHeader.split(" ");
      if (parts.length !== 2 || parts[0] !== "Bearer") {
        return res.status(401).json({
          message: "Authorization header phải có dạng: Bearer <token>",
        });
      }
      token = parts[1];
    } else if ((req as any).cookies?.token) {
      token = (req as any).cookies.token;
    }

    if (!token) {
      return res
        .status(401)
        .json({ message: "Thiếu token (Authorization header hoặc cookie)" });
    }

    // ✅ Kiểm tra và giải mã token
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;

    req.user = decoded; // gắn user info vào request
    next();
  } catch (error: any) {
    // ✅ Nếu token hết hạn
    if (error instanceof TokenExpiredError) {
      return res.status(401).json({
        message: "Token đã hết hạn",
        error: "jwt expired",
      });
    }

    // ✅ Nếu token sai hoặc không giải mã được
    return res.status(403).json({
      message: "Token không hợp lệ",
      error: error.message,
    });
  }
};
