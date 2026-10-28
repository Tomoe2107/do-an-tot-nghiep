// Loại bỏ thẻ HTML/script khỏi nội dung người dùng tự nhập (bình luận đánh giá, phản hồi...).
// Các trường này hiện chỉ được hiển thị dạng text thuần ở FE (React tự escape, không dùng
// dangerouslySetInnerHTML) nên chưa thực sự khai thác được XSS ngay bây giờ, nhưng vẫn nên
// chặn từ gốc để dữ liệu lưu trong CSDL luôn sạch, phòng trường hợp sau này có chỗ hiển thị
// không an toàn (vd thêm rich text cho bình luận).
export const stripHtml = (text: string): string =>
  text.replace(/<[^>]*>/g, "").trim();
