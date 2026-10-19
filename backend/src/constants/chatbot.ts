export const FACEBOOK_PAGE_URL =
  "https://web.facebook.com/people/Shop-c%E1%BB%A7a-V%C5%A9-Thu%C3%BD-Hi%E1%BB%81n-%C4%90%E1%BA%B7c-s%E1%BA%A3n-Ba-mi%E1%BB%81n/61595698254439/";

// Gắn vào cuối các câu trả lời mà bot không xử lý được, hướng khách sang
// nhắn tin trực tiếp với shop qua Facebook thay vì bị bí ở đây.
export const appendFacebookRedirect = (text: string): string =>
  `${text}\n\nBạn có thể nhắn trực tiếp cho shop qua Facebook để được hỗ trợ nhanh hơn: ${FACEBOOK_PAGE_URL}`;
