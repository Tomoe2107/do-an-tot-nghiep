// Script tiện ích: tự lấy URL public hiện tại từ ngrok (đang chạy ở máy)
// rồi cập nhật thẳng vào Fulfillment webhook của Dialogflow Agent qua API,
// khỏi phải vào Console copy/dán tay mỗi lần ngrok đổi link.
//
// Cách dùng:
//   1. Chạy backend: yarn dev
//   2. Mở terminal khác, chạy: ngrok http 4000
//   3. Mở terminal khác nữa, chạy: yarn update-webhook

import dotenv from "dotenv";
import dialogflow from "@google-cloud/dialogflow";

dotenv.config();

const projectId = process.env.DIALOGFLOW_PROJECT_ID || "";
const webhookSecret = process.env.DIALOGFLOW_WEBHOOK_SECRET || "";

const fulfillmentsClient = new dialogflow.FulfillmentsClient({
  projectId,
  credentials: {
    client_email: process.env.DIALOGFLOW_CLIENT_EMAIL,
    private_key: process.env.DIALOGFLOW_PRIVATE_KEY?.replace(/\\n/g, "\n"),
  },
});

// Lấy URL public hiện tại từ ngrok local API (http://127.0.0.1:4040)
const getNgrokUrl = async (): Promise<string> => {
  const res = await fetch("http://127.0.0.1:4040/api/tunnels");
  if (!res.ok) {
    throw new Error(
      "Không gọi được ngrok local API. Bạn đã chạy `ngrok http 4000` ở terminal khác chưa?"
    );
  }
  const data = (await res.json()) as {
    tunnels: { public_url: string; proto: string }[];
  };

  const httpsTunnel = data.tunnels.find((t) => t.proto === "https");
  if (!httpsTunnel) {
    throw new Error("Không tìm thấy tunnel https nào đang chạy trong ngrok.");
  }
  return httpsTunnel.public_url;
};

const main = async () => {
  if (!projectId) {
    throw new Error("Thiếu DIALOGFLOW_PROJECT_ID trong .env");
  }
  if (!webhookSecret) {
    throw new Error("Thiếu DIALOGFLOW_WEBHOOK_SECRET trong .env");
  }

  console.log("🔎 Đang lấy URL public từ ngrok...");
  const ngrokUrl = await getNgrokUrl();
  const webhookUrl = `${ngrokUrl}/api/chatbot/webhook`;
  console.log("🌐 URL ngrok hiện tại:", ngrokUrl);

  const fulfillmentName = `projects/${projectId}/agent/fulfillment`;

  console.log("🔄 Đang cập nhật Fulfillment webhook trên Dialogflow...");
  await fulfillmentsClient.updateFulfillment({
    fulfillment: {
      name: fulfillmentName,
      enabled: true,
      genericWebService: {
        uri: webhookUrl,
        requestHeaders: {
          "x-dialogflow-secret": webhookSecret,
        },
      },
    },
    updateMask: {
      paths: ["generic_web_service", "enabled"],
    },
  });

  console.log("✅ Đã cập nhật webhook thành công!");
  console.log("   Fulfillment URL:", webhookUrl);
};

main().catch((err) => {
  console.error("❌ Lỗi cập nhật webhook:", err.message || err);
  process.exit(1);
});
