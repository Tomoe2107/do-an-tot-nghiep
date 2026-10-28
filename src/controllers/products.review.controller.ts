// src/controllers/productReview.controller.ts

import { Response } from "express";
import { db } from "../database";
import { ProductReview } from "../model/products.review.model";
import { AuthRequest } from "../middlewares/authMiddleware";
import { stripHtml } from "../utils/sanitize";

// ============================
// 1. Thêm đánh giá
// ============================
export const createReview = async (req: AuthRequest, res: Response) => {
  try {
    const { MaSP, user_id, rating, comment } = req.body;

    if (!MaSP || !user_id || !rating) {
      return res.status(400).json({ message: "Thiếu dữ liệu bắt buộc!" });
    }

    // Lấy avatar của user từ bảng users
    const [userRows]: any = await db.execute(
      "SELECT avatar FROM users WHERE id = ?",
      [user_id]
    );

    const userAvatar = userRows[0]?.avatar || null;

    await db.execute(
      `INSERT INTO danhgiasanpham (MaSP, user_id, rating, comment, images)
       VALUES (?, ?, ?, ?, ?)`,
      [
        MaSP,
        user_id,
        rating,
        comment ? stripHtml(String(comment)) : "",
        JSON.stringify(userAvatar ? [userAvatar] : []),
      ]
    );

    return res.status(201).json({ message: "Thêm đánh giá thành công!" });
  } catch (error) {
    console.error("ERROR createReview:", error);
    return res.status(500).json({ error });
  }
};

// ============================
// 2. Lấy đánh giá theo sản phẩm
// ============================
export const getReviewsByProduct = async (req: AuthRequest, res: Response) => {
  try {
    const { MaSP } = req.params;

    const [rows]: any = await db.execute(
      `SELECT r.*, u.username, u.avatar
       FROM danhgiasanpham r
       JOIN users u ON r.user_id = u.id
       WHERE r.MaSP = ?
       ORDER BY r.created_at DESC`,
      [MaSP]
    );

    return res.status(200).json(rows);
  } catch (error) {
    console.error("ERROR getReviewsByProduct:", error);
    return res.status(500).json({ error });
  }
};

// ============================
// 3. Cập nhật đánh giá - chỉ chủ đánh giá hoặc admin
// ============================
export const updateReview = async (req: AuthRequest, res: Response) => {
  try {
    const { reviewId } = req.params;
    const { rating, comment, images } = req.body;
    const requesterId = req.user?.id;
    const isAdmin = req.user?.role === "admin";

    const [rows]: any = await db.execute(
      `SELECT user_id FROM danhgiasanpham WHERE id = ?`,
      [reviewId]
    );
    if (!rows.length) {
      return res.status(404).json({ message: "Không tìm thấy đánh giá" });
    }
    if (!isAdmin && String(rows[0].user_id) !== String(requesterId)) {
      return res
        .status(403)
        .json({ message: "Bạn không có quyền sửa đánh giá này" });
    }

    await db.execute(
      `UPDATE danhgiasanpham
       SET rating = ?, comment = ?, images = ?
       WHERE id = ?`,
      [
        rating,
        comment != null ? stripHtml(String(comment)) : comment,
        JSON.stringify(images || []),
        reviewId,
      ]
    );

    return res.status(200).json({ message: "Cập nhật đánh giá thành công!" });
  } catch (error) {
    console.error("ERROR updateReview:", error);
    return res.status(500).json({ error });
  }
};

// ============================
// 4. Xóa đánh giá - chỉ chủ đánh giá hoặc admin
// ============================
export const deleteReview = async (req: AuthRequest, res: Response) => {
  try {
    const { reviewId } = req.params;
    const requesterId = req.user?.id;
    const isAdmin = req.user?.role === "admin";

    const [rows]: any = await db.execute(
      `SELECT user_id FROM danhgiasanpham WHERE id = ?`,
      [reviewId]
    );
    if (!rows.length) {
      return res.status(404).json({ message: "Không tìm thấy đánh giá" });
    }
    if (!isAdmin && String(rows[0].user_id) !== String(requesterId)) {
      return res
        .status(403)
        .json({ message: "Bạn không có quyền xoá đánh giá này" });
    }

    await db.execute(`DELETE FROM danhgiasanpham WHERE id = ?`, [reviewId]);

    return res.status(200).json({ message: "Xóa đánh giá thành công!" });
  } catch (error) {
    console.error("ERROR deleteReview:", error);
    return res.status(500).json({ error });
  }
};

// ============================
// 5. Lấy điểm trung bình và tổng lượt đánh giá
// ============================
export const getAverageRating = async (req: AuthRequest, res: Response) => {
  try {
    const { MaSP } = req.params;

    const [rows]: any = await db.execute(
      `SELECT 
          AVG(rating) AS average_rating,
          COUNT(*) AS total_reviews
       FROM danhgiasanpham
       WHERE MaSP = ?`,
      [MaSP]
    );

    return res.status(200).json({
      average_rating: rows[0].average_rating || 0,
      total_reviews: rows[0].total_reviews || 0,
    });
  } catch (error) {
    console.error("ERROR getAverageRating:", error);
    return res.status(500).json({ error });
  }
};
