import { Response, NextFunction } from "express";
import { AuthRequest } from "./authMiddleware";

export const isAdmin = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  if (!req.user) {
    return res.status(401).json({ message: "Chưa đăng nhập" });
  }

  // Giả sử role admin được lưu trong token
  if (req.user.role !== "admin") {
    return res.status(403).json({ message: "Chỉ admin mới được phép" });
  }

  next();
};
