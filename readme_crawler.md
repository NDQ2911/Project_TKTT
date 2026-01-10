# Hướng dẫn chạy Project 🚀

## 1. Chạy Crawler (Docker)

```bash
cd job-crawler

# Build và start
just build
just up

# Xem stats
just stats

# Stop
just down
```

## 2. Chạy Backend + Frontend

```bash
# Từ thư mục gốc
just dev
```

Hoặc chạy riêng:

```bash
# Backend only
just backend

# Frontend only  
just frontend
```

## 3. Truy cập

- 🔍 Search: <http://localhost:8080/search>
- � Dashboard: <http://localhost:8080/dashboard>
- 📤 Upload: <http://localhost:8080/upload>
