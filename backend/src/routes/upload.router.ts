import { Router } from "express";
import { upload, uploadAvatar } from "../controllers/upload.controller";
import { authMiddleware } from "../middlewares/authMiddleware";

const router = Router();

// Endpoint upload avatar
router.post("/", authMiddleware, upload.single("file"), uploadAvatar);

export default router;
