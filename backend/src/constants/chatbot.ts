// Link mở thẳng khung chat Messenger của shop - đỡ cho khách 1 bước bấm "Nhắn tin"
// so với link trang Facebook thường.
export const FACEBOOK_MESSENGER_URL =
  "https://web.facebook.com/messages/t/1358022647400564";

// Gắn vào cuối các câu trả lời mà bot không xử lý được, hướng khách sang
// nhắn tin trực tiếp với shop qua Messenger thay vì bị bí ở đây.
export const appendFacebookRedirect = (text: string): string =>
  `${text}\n\nBạn có thể nhắn trực tiếp cho shop qua Messenger để được hỗ trợ nhanh hơn: ${FACEBOOK_MESSENGER_URL}`;
