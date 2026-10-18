import express from "express";
import {
  getAllSanPham,
  getSanPhamById,
  createSanPham,
  updateSanPham,
  deleteSanPham,
} from "../controllers/products.controller";
import { authMiddleware } from "../middlewares/authMiddleware";
import { verifyAdmin } from "../middlewares/verifyAdmin";

const router = express.Router();

// Public routes
router.get("/", getAllSanPham);
router.get("/:id", getSanPhamById);

// Admin-only routes
router.post("/", authMiddleware, verifyAdmin, createSanPham);
router.put("/:id", authMiddleware, verifyAdmin, updateSanPham);
router.delete("/:id", authMiddleware, verifyAdmin, deleteSanPham);

export default router;
