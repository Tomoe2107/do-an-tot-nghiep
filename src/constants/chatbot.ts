// Link mở thẳng khung chat Messenger của shop - đỡ cho khách 1 bước bấm "Nhắn tin".
// FE (chat-widget.tsx) dùng đúng URL này để tự mở Messenger, nên đổi thì sửa cả 2 chỗ.
export const FACEBOOK_MESSENGER_URL =
  "https://web.facebook.com/messages/t/1358022647400564";

// Chuỗi thường, không dùng ký tự null - vì marker "chưa tìm thấy đơn hàng" phải
// đi qua Dialogflow (webhook -> Dialogflow -> detectIntent) trước khi về lại BE,
// ký tự điều khiển qua trung gian đó dễ bị chuẩn hoá/cắt mất.
const REDIRECT_MARKER = "[[needs_human_handoff]]";

// Đánh dấu 1 câu trả lời là "bot không xử lý được, cần người thật" bằng 1 marker ẩn,
// thay vì dán sẵn link thô vào nội dung chat - FE sẽ bóc marker này ra, tự mở Messenger
// và hiển thị nút bấm riêng, không hiển thị URL dạng text cho khách.
export const markNeedsHuman = (text: string): string => `${text}${REDIRECT_MARKER}`;

export const extractNeedsHuman = (
  text: string
): { text: string; needsHuman: boolean } => {
  if (text.includes(REDIRECT_MARKER)) {
    return { text: text.split(REDIRECT_MARKER).join(""), needsHuman: true };
  }
  return { text, needsHuman: false };
};
