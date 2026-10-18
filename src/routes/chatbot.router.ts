import express, { Request, Response, NextFunction } from "express";
import { sendMessage } from "../controllers/chatbot.controller";
import { handleWebhook } from "../controllers/dialogflow.webhook.controller";

const router = express.Router();

// Endpoint cho FE: khách hoặc user gõ chat, backend proxy sang Dialogflow detectIntent
router.post("/message", sendMessage);

// Endpoint Dialogflow gọi ngược về (Fulfillment URL) - public trên internet nên xác thực
// nhẹ bằng secret header nếu có cấu hình DIALOGFLOW_WEBHOOK_SECRET; chưa cấu hình thì bỏ qua check.
const verifyWebhookSecret = (req: Request, res: Response, next: NextFunction) => {
  const expected = process.env.DIALOGFLOW_WEBHOOK_SECRET;
  if (!expected) return next();

  const received = req.headers["x-dialogflow-secret"];
  if (received !== expected) {
    return res.status(403).json({ message: "Webhook secret không hợp lệ" });
  }
  next();
};

router.post("/webhook", verifyWebhookSecret, handleWebhook);

export default router;
