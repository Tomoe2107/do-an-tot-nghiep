import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs"; // Thêm fs để kiểm tra thư mục
import { authMiddleware } from "../middlewares/authMiddleware";
import { verifyAdmin } from "../middlewares/verifyAdmin";

const router = express.Router();

// Cấu hình multer để lưu ảnh vào upload (cùng cấp với src)
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, "../../upload/"); // Quay về gốc dự án, trỏ đến upload
    // Kiểm tra và tạo thư mục nếu chưa tồn tại
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
      console.log("Đã tạo thư mục upload tại:", uploadPath); // Debug
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, `${uniqueSuffix}-${file.originalname}`);
  },
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      return cb(new Error("Chỉ chấp nhận file ảnh!"));
    }
    cb(null, true);
  },
});

// Endpoint upload ảnh sản phẩm (admin-only)
router.post(
  "/imgproduct",
  authMiddleware,
  verifyAdmin,
  upload.single("image"),
  (req: express.Request, res: express.Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "Vui lòng chọn file ảnh!" });
      }
      const imageUrl = `/uploads/${req.file.filename}`;
      console.log("Ảnh upload thành công:", imageUrl); // Debug
      res.status(200).json({ url: imageUrl });
    } catch (error) {
      console.error("Lỗi upload ảnh:", (error as Error).message); // Debug
      res.status(500).json({
        message: "Lỗi khi upload ảnh",
        error: (error as Error).message,
      });
    }
  }
);

export default router;
