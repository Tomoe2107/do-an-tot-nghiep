import api from "./axiosInstance";

const BASE_URL = import.meta.env.VITE_API_URL;

export interface ChatbotReply {
  sessionId: string;
  reply: string;
  intent: string | null;
  isFallback: boolean;
}

// Gửi tin nhắn tới chatbot Dialogflow (qua backend), trả về câu trả lời của bot.
// sessionId giữ nguyên xuyên suốt 1 phiên chat để Dialogflow nhớ ngữ cảnh hội thoại.
export const sendMessageToBot = async (
  message: string,
  sessionId?: string
): Promise<ChatbotReply> => {
  const res = await api.post<ChatbotReply>(`${BASE_URL}/chatbot/message`, {
    message,
    sessionId,
  });
  return res.data;
};
