# Scout Hub - Hệ thống Trích xuất & Quản lý Profile Thu nhỏ (Profile Intelligence)

## 📌 Tổng quan ứng dụng (App Overview)
**Scout Hub** (tên gọi khác: TikTok/Facebook Profile Extractor) là một ứng dụng web nội bộ được thiết kế đặc biệt cho các team Marketing, Booking, hoặc HR. Mục đích chính của ứng dụng là **tự động hoá việc thu thập thông tin (cào dữ liệu - scraping)** từ các hồ sơ mạng xã hội (TikTok, Facebook) và **quản lý dữ liệu tập trung (Mini CRM)**, giúp tiết kiệm thời gian tiếp cận Influencers/KOL/KOC.

Hệ thống cung cấp một quy trình khép kín:
1. **Thu thập dữ liệu cực nhanh:** Chỉ cần dán đường link Profile, hệ thống sẽ tự động quét Avatar, Tên, ID, Lượng Followers, Tiểu sử (Bio), và thông minh trích xuất luôn Số điện thoại / Email ẩn trong phần giới thiệu mà bình thường người dùng phải lọc bằng tay.
2. **Lưu trữ & Phân loại linh hoạt:** Cho phép gắn thẻ (Tier, Nhóm ngành, Vị trí địa lý, Chiến dịch), thêm ghi chú và lên báo giá cho từng hồ sơ.
3. **Đồng bộ thời gian thực:** Tất cả hồ sơ sau khi duyệt sẽ được đồng bộ trực tiếp lên một file Google Sheets trung tâm (thông qua Webhook), giúp cả team cùng chia sẻ và làm việc dễ dàng mà không bị mất dữ liệu.

---

## 🛠 Các chức năng chính (Core Features)

### 1. 🔍 Universal Extractor (Trình Quét Đa Nền Tảng)
- **Hỗ trợ đa nền tảng:** Quét tự động nội dung từ link **TikTok** và **Facebook** (Cá nhân hoặc Group).
- **Trích xuất thông minh:** 
  - Lấy các chỉ số công khai: Followers, Tên hiển thị, ID, Avatar...
  - Nhận diện Số điện thoại (SĐT) & Email: Sử dụng công nghệ Trí tuệ nhân tạo (Google Gemini AI) kết hợp với bộ lọc chuỗi (Regex Fallback) để tìm SĐT và Email ẩn sâu trong phần miêu tả/tiểu sử một cách tự động và cực kì chính xác, loại bỏ các chiêu trò che dấu số (VD: 09xx.xxx.zalo).
- **Thêm hàng loạt (Bulk Extract):** Người dùng có thể điền nhiều link cùng lúc hoặc tải lên file Excel (.xlsx, .csv) chứa danh sách link. App sẽ chạy song song để lấy dữ liệu đồng loạt, bớt công sức click từng trang.
- **Xuất file tạm:** Có thể xuất ngay những dữ liệu vừa quét ra file Excel để kiểm tra trước khi đưa vào CRM.

### 2. 🗃 Scout CRM (Hệ thống Quản lý Kênh/Influencer)
- **Ba chế độ hiển thị:** Danh sách (Table), Thẻ (Card), và Bảng Kanban (Campaign Board) giúp dễ dàng nhìn tổng quan và kéo thả.
- **Phân loại hồ sơ:** 
  - **Tier (Cấp độ):** Macro, Micro, Nano, UGC.
  - **Nhóm ngành:** Beauty, Fashion, Food, Tech, Lifestyle...
  - **Campaign:** Phân công hồ sơ vào từng chiến dịch (Tết 2026, Summer Promo...).
  - **Vị trí:** Phân loại theo khu vực (Bắc, Trung, Nam).
- **Báo giá & Lịch sử:** Tính năng `Báo giá` lưu trữ lại lịch sử giá book của influencer theo từng mốc thời gian. Đánh giá chất lượng bằng số sao Rating (1-5 sao).
- **Đồng bộ Google Sheets (Single Source of Truth):** Thông qua Webhook, app liên tục tải dữ liệu mới nhất hoặc đẩy dữ liệu cập nhật từ CRM vào Google Sheets.
- **Quản lý trùng lặp:** App tích hợp tính năng tự động tìm và xoá các đường link trùng lặp để dữ liệu nhàu quản sạch sẽ.

### 3. ⚙️ Cài đặt & Tiện ích (Settings & Bookmarklet)
- **Google Sheets Webhook:** Cho phép liên kết một URL Apps Script (Google) để cấu hình trực tiếp với Sheet làm cơ sở dữ liệu nền tảng.
- **Bookmarklet (Dấu trang nhanh):** Cung cấp một đoạn mã nhúng lên trình duyệt Chrome/Cốc Cốc. Khi lướt TikTok/FB gặp profile hay, chỉ cần bấm 1 phát vào dấu trang, app Scout Hub sẽ tự động mở lên và quét hồ sơ đó ngay tức khắc.

---

## 📖 Hướng dẫn sử dụng cơ bản

### Bước 1: Quét và thu thập dữ liệu (Extractor)
1. Mở app, chuyển sang tab **"Extractor"** (cột bên trái).
2. Dán một hoặc nhiều link TikTok/Facebook vào ô **Nhập link thủ công** (mỗi link 1 dòng), hoặc tải file danh sách Excel lên.
3. Nhấn **"Thêm vào danh sách"**, sau đó nhấn tiếp nút **"Bắt đầu trích xuất"**.
4. Chờ ứng dụng chạy và cập nhật cột trạng thái thành dấu Tick xanh (Thành công).
5. Các cột thông tin như SĐT, Email, Followers... sẽ hiện ra đầy đủ. Bấm **"Lưu vào CRM"** để đẩy dữ liệu này vào bộ nhớ quản lý.

### Bước 2: Quản lý và xử lý dữ liệu (Scout CRM)
1. Khi link đã được quét xong, chuyển sang tab **"Scout CRM"**.
2. Tại đây bạn sẽ thấy toàn bộ danh sách đã lưu.
3. Chấm điểm rà soát từng profile:
   - Thay đổi các Thẻ (Tier, Khu vực, Campaign) cho đúng nhu cầu chiến dịch bằng cách rê chuột tới ô tương ứng và chọn.
   - Viết Ghi chú tiến độ liên hệ (VD: "Đang chờ check giá", "Đã chốt kèo hẹn quay").
   - Ghi nhận lịch sử giá vào module quản lý rate nếu influencer báo giá mới.
4. Bấm nút **"Sync Sheet"** hoặc **"Xuất Excel"** để đồng bộ gửi lại danh sách xịn xò này cho Sếp hoặc đồng nghiệp.

### Bước 3: Cấu hình liên kết tự động (Settings) *Dành cho Quản trị viên*
- Chuyển sang mục **"Cài đặt"** (biểu tượng bánh răng).
- Cung cấp URL Google Apps Script vào phần "Webhook URL" và bấm Lưu. Sau thao tác này, mọi thay đổi trên CRM đều có tùy chọn tự động lưu vô tận lên trang tính Google Sheets của bạn. 
- Tại đây cũng có mã code Bookmarklet để bạn thêm vào tab trình duyệt giúp truy cập quét thông tin một cách chớp nhoáng.

---
*Hy vọng công cụ Scout Hub sẽ là cánh tay đắc lực giúp bạn và cộng sự chạy chiến dịch Influencer Marketing một cách tối ưu và gọn lẹ nhất!*
