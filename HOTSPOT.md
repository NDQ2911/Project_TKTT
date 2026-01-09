# Hướng dẫn: chạy Search API và truy cập qua Hotspot

## 1) Yêu cầu
- Elasticsearch đang chạy trên máy (mặc định: http://localhost:9200)
- Node.js cài đặt

## 2) Khởi động backend
1. Mở terminal, chuyển vào thư mục `backend`
2. Cài dependencies (nếu chưa): `npm install`
3. Chạy server: `npm start` (server lắng nghe trên `0.0.0.0:3000`)

## 3) Index dữ liệu vào ES
1. Từ root project, chạy: `node scripts/index_jobs.js` (script sẽ tìm `data/jobs_array.json` hoặc `data/jobs.json`)
2. Kiểm tra ES index: `http://localhost:9200/docs/_search?q=*` hoặc truy cập endpoint tìm kiếm qua API

## 4) Cấu hình Hotspot & Firewall (Windows)
1. Bật Mobile Hotspot (Settings → Network & internet → Mobile hotspot)
2. Tìm địa chỉ IP của máy chủ để các thiết bị khác có thể truy cập: mở `ipconfig` và tìm adapter Hotspot (ví dụ `192.168.137.1` hoặc `192.168.43.1`)
3. Mở port 3000 trong Windows Firewall (Private network):
   - Mở PowerShell với quyền Admin và chạy:
     ```powershell
     New-NetFirewallRule -DisplayName "Allow Node 3000" -Direction Inbound -LocalPort 3000 -Protocol TCP -Action Allow -Profile Private
     ```
4. Trên thiết bị kết nối hotspot, mở trình duyệt: `http://<HOST_IP>:3000/search.html`

## 5) Lưu ý bảo mật
- ES hiện tại không bị firewall-block; tốt nhất không để ES mở ra internet (chỉ truy cập nội bộ qua backend)
- Nếu cần, thêm API key hoặc Basic Auth cho endpoint `/api/search`

---
