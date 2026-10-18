import { Response, NextFunction } from "express";
import { AuthRequest } from "./authMiddleware";

export const verifyAdmin = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const user = req.user as { role?: string };

    if (!user || user.role !== "admin") {
      return res.status(403).json({ message: "Chỉ admin mới được truy cập" });
    }

    next();
  } catch (error: any) {
    return res
      .status(500)
      .json({ message: "Lỗi xác thực admin", error: error.message });
  }
};
