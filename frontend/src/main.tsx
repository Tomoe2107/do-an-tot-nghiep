import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Dọn dữ liệu cũ còn sót lại trong localStorage từ trước khi chuyển sang chỉ lưu
// "userId" (token -> cookie httpOnly, object "user" đầy đủ -> gọi getProfile() khi
// cần). Những ai đã đăng nhập từ trước lúc đổi code vẫn còn 2 key cũ này trong trình
// duyệt, không tự mất cho tới khi có đoạn dọn 1 lần này.
localStorage.removeItem('token')
localStorage.removeItem('user')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
