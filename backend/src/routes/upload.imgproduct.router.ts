import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs"; // Thêm fs để kiểm tra thư mục
import { authMiddleware } from "../middlewares/authMiddleware";
import { verifyAdmin } from "../middlewares/verifyAdmin";

const router = express.Router();

// Chỉ cho phép đúng các định dạng ảnh raster thông thường - KHÔNG cho .svg/.html hay
// bất kỳ định dạng nào khác (mimetype client tự khai rất dễ giả, phải kiểm tra thêm
// đúng đuôi file thật).
const ALLOWED_EXTENSIONS = [".jpg", ".jpeg", ".png", ".gif", ".webp"];
const ALLOWED_MIMETYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
];

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
    const ext = path.extname(file.originalname).toLowerCase();
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, `${uniqueSuffix}${ext}`);
  },
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (
      !ALLOWED_EXTENSIONS.includes(ext) ||
      !ALLOWED_MIMETYPES.includes(file.mimetype)
    ) {
      return cb(new Error("Chỉ chấp nhận file ảnh (jpg, jpeg, png, gif, webp)!"));
    }
    cb(null, true);
  },
  limits: { fileSize: 5 * 1024 * 1024 },
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
