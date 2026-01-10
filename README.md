# Project_TKTT — Simple Local Search API 🔎

Một hướng dẫn nhanh để chạy server, index dữ liệu vào Elasticsearch và truy cập API (kể cả qua hotspot nội bộ).

---

## Yêu cầu

- Node.js (>=14)
- Elasticsearch đang chạy (mặc định <http://localhost:9200>)

---

## Bắt đầu nhanh (Quickstart) ✅

1. Cài dependencies cho backend:

```bash
cd backend
npm install
```

1. Mở Elasticsearch (local) — đảm bảo ES reachable tại `http://localhost:9200`.

2. Index dữ liệu (từ thư mục gốc project):

```bash
node scripts/index_jobs.js
```

Script sẽ tìm `data/jobs_array.json` hoặc `data/jobs.json` và gửi bulk tới ES index `docs` (mặc định). Bạn có thể thay đổi index/ES node bằng biến môi trường `ES_INDEX` và `ES_NODE`.

1. Chạy backend:

```bash
cd backend
node main.js
```

1. truy cập <http://localhost:3000/> để sử dụng trên máy

Server sẽ lắng nghe trên `0.0.0.0:3000` và phục vụ frontend tĩnh từ `frontend/`.

---

## Các endpoint chính (API) 🔧

- GET /api/search?q=KEYWORD[&page=1&size=10]
  - Tham số: `q` bắt buộc; `page`, `size` tùy chọn (size tối đa 50)
  - Response: JSON { total, hits: [{ id, score, source, highlight }] }
  - Ví dụ:

```bash
curl "http://localhost:3000/api/search?q=nhân+viên"
```

- POST /search  (cũ, dùng JSON body { q }) — để tương thích với client cũ

- POST /upload  (multipart/form-data, trường `file`) — upload file JSON array; mỗi phần tử có trường `Id tin` sẽ được index với `_id = Id tin`.

- GET /job/:id — lấy chi tiết công việc theo id (trả về `_source`).

- Trang frontend: `/search.html`, `/job.html?id=...`, `/upload.html` (được phục vụ tĩnh từ server).

---

## Truy cập từ thiết bị khác qua Hotspot (Windows) 📶

1. Bật Mobile Hotspot (Settings → Network & internet → Mobile hotspot).
2. Tìm IP hotspot của máy chủ: mở `ipconfig` và tìm adapter Hotspot (ví dụ `192.168.137.1`).
3. Mở port 3000 trong Windows Firewall (Private):

```powershell
# chạy bằng PowerShell (Admin)
New-NetFirewallRule -DisplayName "Allow Node 3000" -Direction Inbound -LocalPort 3000 -Protocol TCP -Action Allow -Profile Private
```

1. Trên thiết bị kết nối hotspot, mở trình duyệt:

```
http://<HOST_IP>:3000/search.html
```

---

## Bảo mật & Lưu ý ⚠️

- Elasticsearch **không nên** để public ra Internet. Hiện triển khai phù hợp cho mạng nội bộ / hotspot.
- Nếu cần, thêm Basic Auth / API key hoặc rate-limiting vào endpoint `/api/search` để bảo vệ API.

---

## Troubleshooting (vấn đề thường gặp)

- Nếu `curl "http://localhost:3000/api/search?q=..."` báo lỗi, kiểm tra:
  - Elasticsearch đang chạy và index `docs` đã tồn tại
  - Backend đang chạy (port 3000 không bị chiếm)
- Nếu frontend không load trên thiết bị khác, kiểm tra firewall & địa chỉ IP của host.

---

## Muốn mở rộng?

- Thêm autocomplete (ES suggester), phân trang UI, filters theo công ty/địa điểm.
- Thêm auth/rate-limit nếu muốn mở cho nhiều user.

---
