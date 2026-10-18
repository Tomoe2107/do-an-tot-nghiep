import express from "express";
import {
  getAllUsers,
  createUser,
  updateUser,
  deleteUser,
} from "../controllers/admin.controller";
import { authMiddleware } from "../middlewares/authMiddleware"; // ✅ check token
import { verifyAdmin } from "../middlewares/verifyAdmin"; // ✅ check role admin

const router = express.Router();

// Lấy danh sách tài khoản (chỉ admin mới được xem)
router.get("/users", authMiddleware, verifyAdmin, getAllUsers);

// Thêm tài khoản mới (chỉ admin)
router.post("/users", authMiddleware, verifyAdmin, createUser);

// Sửa thông tin tài khoản (chỉ admin)
router.put("/users/:id", authMiddleware, verifyAdmin, updateUser);

// Xóa tài khoản (chỉ admin)
router.delete("/users/:id", authMiddleware, verifyAdmin, deleteUser);

export default router;
