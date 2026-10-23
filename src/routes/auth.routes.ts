import { Router } from "express";
import {
  register,
  login,
  logout,
  getProfile,
  updateUser,
} from "../controllers/auth.controller";
import { forgotPassword } from "../controllers/forgot.password.controller";
import { resetPassword } from "../controllers/reset.password.controller";
import { authMiddleware } from "../middlewares/authMiddleware";
import {
  forgotPasswordLimiter,
  resetPasswordLimiter,
} from "../middlewares/passwordResetRateLimit";

const router = Router();

router.post("/register", register);
router.post("/login", login);
router.post("/logout", logout);
router.get("/profile", authMiddleware, getProfile); // Router lấy thông tin tài khoản để hiện thị lên FE
router.put("/users/:id", authMiddleware, updateUser);
router.post("/forgot-password", forgotPasswordLimiter, forgotPassword);
router.post("/reset-password", resetPasswordLimiter, resetPassword);

export default router;
