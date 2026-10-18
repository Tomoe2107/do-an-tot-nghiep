# Dưới đây là thông tin chi tiết và hướng dẫn chạy dự án BackEnd

## Giới thiệu:

- Ngôn ngữ sử dụng: Javascript nâng cấp (TypeScript)
- Thư viện và framework: Express.js
- Môi trường để chạy dự án: NodeJs
- Trình quản lý gói (dùng để chạy server): Yarn
- Công cụ test API: Bruno
- Hệ quản trị CSDL: Mysql Workbench

### Gồm các thư mục và file quan trọng sau:

- Thư mục src:
- Thư mục node_modules: cả BE và FE đều cần, được tạo ra qua lệnh 'yarn'
- Thư mục dist: chứa file built để deploy (taml thời chưa cần quan tâm)
- File package.json: chứa các framework và thư viện đã cài thông qua lệnh terminal (không nên chỉnh sửa)
- File .env: dùng để lưu biến môi trường, thay vì code cứng, các giá trị quan trọng sẽ đc đặt trong này, VD: tên csdl, tài khoản, mật khẩu kết nối với mysql

### Chạy dự án (Với máy client)

- yarn
- yarn dev
