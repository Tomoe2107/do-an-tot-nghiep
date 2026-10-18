import { Request, Response } from "express";
import { db } from "../database";

export const FeedbackController = {
  // 📝 Gửi đánh giá
  async create(req: Request, res: Response) {
    try {
      const user_id = (req as any).user?.id;
      const { rating, comment } = req.body;

      console.log("📌 create feedback input:", { user_id, rating, comment });

      if (!user_id) return res.status(401).json({ message: "Chưa đăng nhập" });
      if (!rating || !comment)
        return res.status(400).json({ message: "Thiếu dữ liệu đánh giá" });

      const sql = `INSERT INTO feedback (user_id, rating, comment) VALUES (?, ?, ?)`;
      console.log("📌 Executing SQL:", sql, [user_id, rating, comment]);

      const [result]: any = await db.execute(sql, [user_id, rating, comment]);

      console.log("✅ feedback created:", {
        review_id: result.insertId,
        user_id,
      });

      return res.status(201).json({
        message: "Đánh giá thành công!",
        review_id: result.insertId,
      });
    } catch (err: any) {
      console.error("❌ Lỗi create review:", err);
      return res
        .status(500)
        .json({ message: "Lỗi server", error: err.sqlMessage || err.message });
    }
  },

  // 📋 Lấy toàn bộ đánh giá (có phân trang, kèm fullname + avatar + tỉnh thành)
  async getAll(req: Request, res: Response) {
    try {
      const page = Number(req.query.page) > 0 ? Number(req.query.page) : 1;
      const limit = Number(req.query.limit) > 0 ? Number(req.query.limit) : 6;
      const offset = (page - 1) * limit;

      console.log("📌 getAll feedback params:", { page, limit, offset });

      // Lấy tổng số feedback
      const [[{ total }]]: any = await db.execute(
        `SELECT COUNT(*) AS total FROM feedback`
      );
      const totalPages = Math.ceil(total / limit);
      console.log("📌 Total feedback:", total, "Total pages:", totalPages);

      const sql = `
      SELECT 
        f.id, f.rating, f.comment, f.created_at,
        u.fullname, u.avatar,
        k.TinhThanh
      FROM feedback AS f
      JOIN users AS u ON f.user_id = u.id
      LEFT JOIN khachhang AS k ON f.user_id = k.user_id
      ORDER BY f.created_at DESC
      LIMIT ${limit} OFFSET ${offset}
      `;
      console.log("📌 Executing SQL getAll:", sql);

      const [rows]: any = await db.query(sql);
      console.log("📌 Feedback rows fetched:", rows.length);

      return res.json({
        data: rows,
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1,
        },
      });
    } catch (err: any) {
      console.error("❌ Lỗi getAll feedback:", err);
      return res.status(500).json({
        message: "Lỗi server",
        error: err.sqlMessage || err.message,
      });
    }
  },

  // 👤 Lấy đánh giá theo user (có tỉnh thành)
  async getByUser(req: Request, res: Response) {
    try {
      const { id } = req.params;
      console.log("📌 getByUser feedback for user_id:", id);

      const sql = `
      SELECT 
        f.id, f.rating, f.comment, f.created_at,
        u.fullname, u.avatar,
        k.TinhThanh
      FROM feedback AS f
      JOIN users AS u ON f.user_id = u.id
      LEFT JOIN khachhang AS k ON f.user_id = k.user_id
      WHERE f.user_id = ?
      ORDER BY f.created_at DESC
      `;
      console.log("📌 Executing SQL getByUser:", sql, [id]);

      const [rows]: any = await db.execute(sql, [id]);
      console.log("📌 Feedback rows fetched by user:", rows.length);

      return res.json(rows);
    } catch (err: any) {
      console.error("❌ Lỗi getByUser:", err);
      return res
        .status(500)
        .json({ message: "Lỗi server", error: err.sqlMessage || err.message });
    }
  },

  // ❌ Xóa đánh giá (dành cho admin)
  async delete(req: Request, res: Response) {
    try {
      const { id } = req.params;
      console.log("📌 Delete feedback id:", id);

      const sql = `DELETE FROM feedback WHERE id = ?`;
      console.log("📌 Executing SQL delete:", sql, [id]);

      const [result]: any = await db.execute(sql, [id]);

      console.log("📌 Delete result:", result);

      if (result.affectedRows === 0)
        return res.status(404).json({ message: "Không tìm thấy đánh giá" });

      console.log("✅ Feedback deleted:", id);

      return res.json({ message: "Đã xóa đánh giá" });
    } catch (err: any) {
      console.error("❌ Lỗi delete review:", err);
      return res
        .status(500)
        .json({ message: "Lỗi server", error: err.sqlMessage || err.message });
    }
  },
};
