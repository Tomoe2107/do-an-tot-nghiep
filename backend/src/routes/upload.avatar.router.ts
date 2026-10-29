import express from "express";
import multer from "multer";
import path from "path";
import { db } from "../database";
import fs from "fs";

import { authMiddleware } from "../middlewares/authMiddleware";

const router = express.Router();

// ⚙️ Cấu hình multer: lưu avatar vào upload/avatars (cùng thư mục có Volume bền
// vững với ảnh sản phẩm - Railway chỉ cho 1 volume/service nên gộp chung vào đây
// để avatar không bị mất mỗi lần deploy lại, thay vì public/avatars cũ không có volume)
// Chỉ cho phép đúng các định dạng ảnh raster thông thường - KHÔNG cho .svg (có thể
// chứa <script> chạy được nếu truy cập trực tiếp) hay bất kỳ định dạng nào khác như
// .html (multer mimetype chỉ dựa vào Content-Type client tự khai, giả mạo rất dễ -
// nên vẫn phải kiểm tra thêm đúng ĐUÔI FILE THẬT trước khi lưu).
const ALLOWED_EXTENSIONS = [".jpg", ".jpeg", ".png", ".gif", ".webp"];
const ALLOWED_MIMETYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
];

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const avatarPath = path.join(__dirname, "../../upload/avatars");
    if (!fs.existsSync(avatarPath)) {
      fs.mkdirSync(avatarPath, { recursive: true });
      console.log("📂 Đã tạo thư mục:", avatarPath);
    }
    cb(null, avatarPath);
  },
  filename: (req, file, cb) => {
    // Không dùng thẳng file.originalname - vừa tránh path traversal (originalname có
    // thể chứa "../"), vừa tránh double-extension trick (vd "avatar.html.jpg").
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

// 📸 Endpoint upload avatar user
router.post(
  "/avatar",
  authMiddleware,
  upload.single("avatar"),
  async (req: express.Request, res: express.Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "Vui lòng chọn ảnh avatar!" });
      }

      const imageUrl = `/avatars/${req.file.filename}`;
      console.log("✅ Avatar upload thành công:", imageUrl);

      // ✅ Lưu vào DB
      const userId = (req as any).user?.id;
      if (userId) {
        await db.query("UPDATE users SET avatar = ? WHERE id = ?", [
          imageUrl,
          userId,
        ]);
        console.log(`📸 Avatar user ${userId} đã được cập nhật DB`);
      }

      res.status(200).json({
        message: "Upload avatar thành công",
        url: imageUrl,
      });
    } catch (error) {
      console.error("❌ Lỗi upload avatar:", (error as Error).message);
      res.status(500).json({
        message: "Lỗi khi upload avatar",
        error: (error as Error).message,
      });
    }
  }
);

export const uploadAvatarRouter = router;
