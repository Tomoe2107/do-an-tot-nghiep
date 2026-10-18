import { Request, Response } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { db } from "../database";

// Cấu hình nơi lưu ảnh
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, "../../uploads");
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

export const upload = multer({ storage });

// Controller upload ảnh và lưu vào DB
export const uploadAvatar = async (req: Request, res: Response) => {
  if (!req.file) {
    return res.status(400).json({ message: "Không có file nào được upload" });
  }

  const { userId } = req.body;

  try {
    if (!userId) {
      return res.status(400).json({ message: "Thiếu userId" });
    }

    // Tạo URL tuyệt đối
    const fullUrl = `${req.protocol}://${req.get("host")}/uploads/${
      req.file.filename
    }`;

    // Lưu luôn URL tuyệt đối vào DB (để không bị mất ảnh khi login lại)
    await db.query("UPDATE users SET avatar = ? WHERE id = ?", [
      fullUrl,
      userId,
    ]);

    console.log("✅ Ảnh đã upload và lưu vào DB:", fullUrl);

    res.json({
      message: "Upload và cập nhật avatar thành công",
      url: fullUrl,
    });
  } catch (error) {
    console.error("Lỗi khi lưu avatar:", error);
    res.status(500).json({ message: "Lỗi khi lưu avatar vào DB" });
  }
};
