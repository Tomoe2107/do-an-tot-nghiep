// src/routes/productReview.router.ts

import express from "express";
import {
  createReview,
  getReviewsByProduct,
  updateReview,
  deleteReview,
  getAverageRating,
} from "../controllers/products.review.controller";
import { authMiddleware } from "../middlewares/authMiddleware";

const router = express.Router();

router.post("/", authMiddleware, createReview); // Thêm đánh giá
router.get("/:MaSP", getReviewsByProduct); // Lấy đánh giá theo sản phẩm
router.get("/average/:MaSP", getAverageRating);

router.put("/:reviewId", authMiddleware, updateReview); // Cập nhật đánh giá - chỉ chủ đánh giá/admin
router.delete("/:reviewId", authMiddleware, deleteReview); // Xóa đánh giá - chỉ chủ đánh giá/admin

export default router;
