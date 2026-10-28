import { Request, Response } from "express";
import crypto from "crypto";
import bcrypt from "bcrypt";
import { db } from "../database";
import { sendEmail } from "../email.service";

const GENERIC_SUCCESS_MESSAGE =
  "Nếu email tồn tại trong hệ thống, mật khẩu tạm thời đã được gửi tới email đó!";

export const forgotPassword = async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res
        .status(400)
        .json({ success: false, message: "Email không được để trống!" });
    }

    const [rows]: any = await db.execute(
      "SELECT id FROM users WHERE email = ?",
      [email]
    );

    // Không tiết lộ email có tồn tại hay không (tránh user enumeration) - luôn trả cùng 1
    // thông báo, chỉ thực sự gửi mail khi email có tồn tại.
    if (!rows || rows.length === 0) {
      return res.json({ success: true, message: GENERIC_SUCCESS_MESSAGE });
    }

    const user = rows[0];

    // Mật khẩu tạm 16 ký tự hex (64-bit) - đủ dài để chống dò brute-force trong 15 phút hiệu lực
    const tempPassword = crypto.randomBytes(8).toString("hex");
    const tempPasswordHash = await bcrypt.hash(tempPassword, 10);
    const expireDate = new Date(Date.now() + 15 * 60 * 1000); // 15 phút từ bây giờ

    // Chỉ lưu hash mật khẩu tạm vào reset_token - KHÔNG đụng vào cột password thật, để
    // request quên mật khẩu (có thể bị ai đó gửi hộ bằng email của nạn nhân) không tự ý
    // "đá" người dùng thật ra khỏi tài khoản của họ khi họ chưa xác nhận đổi mật khẩu.
    await db.execute(
      "UPDATE users SET reset_token = ?, reset_expire = ? WHERE id = ?",
      [tempPasswordHash, expireDate, user.id]
    );

    await sendEmail({
      to: email,
      subject: "Mật khẩu tạm thời của bạn",
      html: `Mật khẩu tạm thời (hiệu lực 15 phút): <strong>${tempPassword}</strong><br><br>
         Dùng mật khẩu này tại trang đặt lại mật khẩu để đổi sang mật khẩu mới.<br>
         Nếu bạn không yêu cầu đổi mật khẩu, hãy bỏ qua email này.<br>
         <a href="https://vuthuyhien.id.vn/login">Đăng nhập tại đây</a>`,
      replyTo: email,
    });

    return res.json({ success: true, message: GENERIC_SUCCESS_MESSAGE });
  } catch (error) {
    console.error("Forgot password error:", error); // Chỉ log server
    return res.status(500).json({ success: false, message: "Lỗi server" });
  }
};
