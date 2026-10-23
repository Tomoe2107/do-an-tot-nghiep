import rateLimit from "express-rate-limit";

// Chặn spam /forgot-password - giới hạn số lần yêu cầu mật khẩu tạm theo IP, tránh gửi
// hàng loạt mail hoặc lợi dụng để khóa tài khoản người khác (mỗi lần gọi đổi reset_token).
export const forgotPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Bạn yêu cầu quá nhiều lần, vui lòng thử lại sau 15 phút!",
  },
});

// Chặn brute-force /reset-password - giới hạn số lần thử mật khẩu tạm theo IP trong
// đúng khung thời gian mật khẩu tạm còn hiệu lực (15 phút).
export const resetPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Bạn thử sai quá nhiều lần, vui lòng thử lại sau 15 phút!",
  },
});
