import dialogflow from "@google-cloud/dialogflow";
import { jsonToStructProto, structProtoToJson } from "../utils/structjson";

const projectId = process.env.DIALOGFLOW_PROJECT_ID || "";

// Railway/host env không có chỗ upload file key.json ổn định, nên nhận
// service account qua 2 biến riêng (client_email + private_key) thay vì keyFilename.
const sessionClient = new dialogflow.SessionsClient({
  projectId,
  credentials: {
    client_email: process.env.DIALOGFLOW_CLIENT_EMAIL,
    // Railway/env file thường lưu \n dưới dạng chuỗi "\\n", cần thay lại thành xuống dòng thật
    private_key: process.env.DIALOGFLOW_PRIVATE_KEY?.replace(/\\n/g, "\n"),
  },
});

export interface DetectIntentResult {
  fulfillmentText: string;
  intent: string;
  parameters: Record<string, any>;
  isFallback: boolean;
}

/**
 * Gửi 1 câu nhắn của người dùng tới Dialogflow và trả về câu trả lời đã khớp intent.
 * sessionId dùng để Dialogflow nhớ ngữ cảnh hội thoại (contexts) giữa các lượt chat.
 * payload (nếu có, vd user_id khi đã đăng nhập) được đính kèm để webhook fulfillment đọc lại.
 */
export const detectIntent = async (
  sessionId: string,
  text: string,
  payload?: Record<string, any>,
  languageCode = "vi"
): Promise<DetectIntentResult> => {
  if (!projectId) {
    throw new Error("Thiếu DIALOGFLOW_PROJECT_ID trong biến môi trường");
  }

  const sessionPath = sessionClient.projectAgentSessionPath(
    projectId,
    sessionId
  );

  const request: any = {
    session: sessionPath,
    queryInput: {
      text: { text, languageCode },
    },
  };

  if (payload) {
    request.queryParams = { payload: jsonToStructProto(payload) };
  }

  const [response] = await sessionClient.detectIntent(request);
  const result = response.queryResult;

  return {
    fulfillmentText: result?.fulfillmentText || "",
    intent: result?.intent?.displayName || "",
    parameters: result?.parameters
      ? structProtoToJson(result.parameters as any)
      : {},
    isFallback: !!result?.intent?.isFallback,
  };
};
