# Job Crawler - Kiến trúc Hệ thống

## Tổng quan

Job Crawler là hệ thống thu thập và xử lý dữ liệu việc làm từ các trang tuyển dụng Việt Nam, được thiết kế theo kiến trúc **microservices** với **event-driven architecture** sử dụng Redis làm message broker.

---

## Kiến trúc tổng thể

```
┌───────────────────────────────────────────────────────────────────────────────┐
│                              JOB CRAWLER SYSTEM                               │
├───────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐           │
│  │   📦 CRAWLER    │    │   🔧 ENRICHER   │    │   📊 WORKER     │           │
│  │                 │    │                 │    │                 │           │
│  │ • API Fetching  │    │ • HTML Scraping │    │ • Normalization │           │
│  │ • Deduplication │    │ • JSON-LD Parse │    │ • HTML Cleaning │           │
│  │ • Rate Limiting │    │ • Data Merge    │    │ • Bulk Indexing │           │
│  └────────┬────────┘    └────────┬────────┘    └────────┬────────┘           │
│           │                      │                      │                     │
│           │   ┌──────────────────┼──────────────────┐   │                     │
│           └──►│       💾 REDIS MESSAGE BROKER       │◄──┘                     │
│               │                                      │                        │
│               │  • jobs:pending:{source}  (Stage 1→2)│                        │
│               │  • jobs:raw:{source}      (Stage 2→3)│                        │
│               │  • job:seen:*             (Dedup)    │                        │
│               └──────────────────────────────────────┘                        │
│                                      │                                        │
│                                      ▼                                        │
│               ┌──────────────────────────────────────┐                        │
│               │      🔍 ELASTICSEARCH                │                        │
│               │                                      │                        │
│               │  • jobs_{source} index               │                        │
│               │  • Vietnamese full-text search       │                        │
│               │  • Aggregations & Analytics          │                        │
│               └──────────────────────────────────────┘                        │
│                                                                               │
└───────────────────────────────────────────────────────────────────────────────┘
```

---

## Các thành phần chính

### 1. Crawler Service (Stage 1)

**Chức năng:** Thu thập danh sách jobs từ API của các trang tuyển dụng.

| Thuộc tính | Mô tả |
|------------|-------|
| **Input** | External APIs (Vieclam24h, VietnamWorks, TopDev, CareerViet) |
| **Output** | Redis Queue `jobs:pending:{source}` |
| **Scheduling** | Cron (mỗi 6 giờ) hoặc manual trigger |
| **Rate Limiting** | 3-6 giây delay giữa mỗi request |

**Luồng xử lý:**

1. Gọi API lấy danh sách jobs theo phân trang
2. Với mỗi job, kiểm tra Redis dedup key
3. Nếu job mới/cập nhật → push vào pending queue
4. Đánh dấu job đã xử lý trong Redis với TTL

### 2. Enricher Service (Stage 2)

**Chức năng:** Bổ sung dữ liệu chi tiết bằng cách scrape HTML.

| Thuộc tính | Mô tả |
|------------|-------|
| **Input** | Redis Queue `jobs:pending:{source}` |
| **Output** | Redis Queue `jobs:raw:{source}` |
| **Processing** | Sequential (tránh rate limiting) |
| **Data Source** | HTML detail page + JSON-LD schema |

**Dữ liệu bổ sung:**

- Mô tả chi tiết công việc (`description`)
- Quyền lợi (`benefits`)
- Kỹ năng yêu cầu (`skills`)
- Thông tin địa điểm chi tiết (`location_city`, `location_district`)

### 3. Worker Service (Stage 3)

**Chức năng:** Chuẩn hóa dữ liệu và index vào Elasticsearch.

| Thuộc tính | Mô tả |
|------------|-------|
| **Input** | Redis Queue `jobs:raw:{source}` |
| **Output** | Elasticsearch index `jobs_{source}` |
| **Processing** | Batch processing (100 jobs/batch) |
| **Concurrency** | 5 goroutines (configurable) |

**Xử lý chính:**

- Clean HTML → plain text
- Normalize các fields về format chuẩn
- Parse salary (VND → triệu)
- Map experience → tags (A-F)
- Bulk index vào Elasticsearch

---

## Data Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              DATA FLOW DIAGRAM                               │
└─────────────────────────────────────────────────────────────────────────────┘

  EXTERNAL                   CRAWLER                 ENRICHER                WORKER
     │                          │                       │                       │
     │    GET /api/jobs         │                       │                       │
     │◄─────────────────────────┤                       │                       │
     │                          │                       │                       │
     │    JSON Response         │                       │                       │
     ├─────────────────────────►│                       │                       │
     │                          │                       │                       │
     │                          │   Check Dedup         │                       │
     │                          ├─────────┐             │                       │
     │                          │         │ Redis GET   │                       │
     │                          │◄────────┘             │                       │
     │                          │                       │                       │
     │                          │   LPUSH pending       │                       │
     │                          ├──────────────────────►│                       │
     │                          │                       │                       │
     │                          │                       │   BRPOP pending       │
     │                          │                       │◄──────────────────────┤
     │                          │                       │                       │
     │   GET /job-detail.html   │                       │                       │
     │◄─────────────────────────────────────────────────┤                       │
     │                          │                       │                       │
     │   HTML + JSON-LD         │                       │                       │
     ├─────────────────────────────────────────────────►│                       │
     │                          │                       │                       │
     │                          │                       │   LPUSH raw           │
     │                          │                       ├──────────────────────►│
     │                          │                       │                       │
     │                          │                       │                       │   Batch RPOP
     │                          │                       │                       │◄──────────────┐
     │                          │                       │                       │               │
     │                          │                       │                       │   Normalize   │
     │                          │                       │                       ├───────────────┘
     │                          │                       │                       │
     │                          │                       │                       │   Bulk Index
     │                          │                       │                       ├────────────────►ES
```

---

## Queue System

### Queue Naming Convention

```
jobs:{stage}:{source}
```

| Queue Name | Stage | Producer | Consumer |
|------------|-------|----------|----------|
| `jobs:pending:vieclam24h` | 1→2 | Crawler | Enricher |
| `jobs:raw:vieclam24h` | 2→3 | Enricher | Worker |
| `jobs:jsonld:vieclam24h` | - | Enricher | (Validation) |

### Deduplication Keys

```
job:seen:{source}:{job_id}
```

| Key Pattern | Value | TTL |
|-------------|-------|-----|
| `job:seen:vieclam24h:123456` | `updated_at` timestamp | `expired_at + 24h` |

**Dedup Logic:**

- `ResultNew`: Key không tồn tại → Process job
- `ResultUpdated`: Key tồn tại, value khác → Re-process job
- `ResultUnchanged`: Key tồn tại, value giống → Skip job

---

## Domain Models

### RawJob (Internal Transport)

```go
type RawJob struct {
    ID            string         // Job ID từ source
    URL           string         // URL chi tiết job
    Source        string         // "vieclam24h", "vietnamworks"...
    LastUpdatedOn string         // Timestamp cho dedup check
    ExpiredOn     time.Time      // Ngày hết hạn (cho TTL)
    RawData       map[string]any // Dữ liệu thô từ API/HTML
    ExtractedAt   time.Time      // Thời điểm crawl
}
```

### Job (Elasticsearch Document)

```go
type Job struct {
    ID               string     // Unique ID
    Source           string     // Source identifier
    SourceURL        string     // Original URL
    Title            string     // Job title
    Company          string     // Company name
    CompanyLogo      string     // Logo URL
    Description      string     // Job description (plain text)
    Requirements     string     // Requirements (plain text)
    Benefits         string     // Benefits (plain text)
    Location         string     // Display location
    LocationCity     []string   // Cities (for filtering)
    LocationDistrict []string   // Districts
    Salary           string     // Display salary text
    SalaryMin        int        // Min salary (triệu VND)
    SalaryMax        int        // Max salary (triệu VND)
    IsNegotiable     bool       // Thỏa thuận flag
    Experience       string     // Experience display text
    ExperienceTags   []string   // A/B/C/D/E/F tags
    Skills           []string   // Skill list
    Industry         []string   // Industry categories
    TotalViews       int        // View count
    TotalApplied     int        // Application count
    ResponseRate     int        // Company response rate
    CreatedAt        time.Time  // Job created at source
    UpdatedAt        time.Time  // Job updated at source
    ExpiredAt        time.Time  // Expiry date
    CrawledAt        time.Time  // Crawl timestamp
}
```

---

## Technology Stack

| Layer | Technology | Mục đích |
|-------|------------|----------|
| **Language** | Go 1.21+ | Performance, concurrency |
| **Message Queue** | Redis | Queue + Deduplication |
| **Search Engine** | Elasticsearch 8.x | Full-text search, aggregations |
| **Container** | Docker + Docker Compose | Deployment |
| **Scheduling** | robfig/cron | Periodic crawling |
| **HTML Parsing** | goquery, bluemonday | Scraping, sanitization |

---

## Configuration

### Environment Variables

| Variable | Default | Mô tả |
|----------|---------|-------|
| `REDIS_ADDR` | `redis:6379` | Redis connection |
| `REDIS_PASSWORD` | (empty) | Redis auth |
| `REDIS_DB` | `0` | Redis database |
| `REDIS_JOB_QUEUE` | `jobs:raw:vieclam24h` | Worker input queue |
| `ELASTICSEARCH_URL` | `http://elasticsearch:9200` | ES connection |
| `ELASTICSEARCH_INDEX` | `jobs_vieclam24h` | Target index |
| `CRAWLER_DELAY_MS` | `2000` | Request delay (ms) |
| `WORKER_CONCURRENCY` | `5` | Worker goroutines |
| `WORKER_BATCH_SIZE` | `100` | Batch size |

---

## Scalability Considerations

### Horizontal Scaling

```
                    ┌─────────────────────────────────────┐
                    │          LOAD BALANCER              │
                    └─────────────────────────────────────┘
                                     │
         ┌───────────────────────────┼───────────────────────────┐
         │                           │                           │
         ▼                           ▼                           ▼
  ┌─────────────┐            ┌─────────────┐            ┌─────────────┐
  │  Crawler 1  │            │  Crawler 2  │            │  Crawler 3  │
  │ (vieclam24h)│            │(vietnamworks)│           │  (topdev)   │
  └─────────────┘            └─────────────┘            └─────────────┘
         │                           │                           │
         └───────────────────────────┼───────────────────────────┘
                                     │
                    ┌─────────────────────────────────────┐
                    │              REDIS                   │
                    │         (Cluster mode)               │
                    └─────────────────────────────────────┘
                                     │
         ┌───────────────────────────┼───────────────────────────┐
         │                           │                           │
         ▼                           ▼                           ▼
  ┌─────────────┐            ┌─────────────┐            ┌─────────────┐
  │  Worker 1   │            │  Worker 2   │            │  Worker 3   │
  └─────────────┘            └─────────────┘            └─────────────┘
         │                           │                           │
         └───────────────────────────┼───────────────────────────┘
                                     │
                    ┌─────────────────────────────────────┐
                    │          ELASTICSEARCH               │
                    │          (3-node cluster)            │
                    └─────────────────────────────────────┘
```

### Current Limitations

| Aspect | Current | Future |
|--------|---------|--------|
| Crawlers | 1 per source | Multiple per source with coordination |
| Workers | Single instance | Multiple with Redis-based locking |
| Redis | Single node | Cluster mode |
| ES | Single node | Multi-node cluster |

---

## Error Handling

### Retry Strategy

| Error Type | Action | Max Retries |
|------------|--------|-------------|
| Network timeout | Retry with backoff | 3 |
| HTTP 429 (Rate limit) | Increase delay, retry | ∞ |
| HTTP 4xx (Client error) | Log, skip | 0 |
| HTTP 5xx (Server error) | Retry with backoff | 3 |
| Parse error | Log, continue with partial data | 0 |
| ES index error | Log, retry batch | 3 |

### Graceful Shutdown

```go
sigChan := make(chan os.Signal, 1)
signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)

<-sigChan
log.Println("Shutdown signal received...")
cancel()  // Cancel context

// Wait for in-flight operations
wg.Wait()
```

---

## Monitoring & Observability

### Key Metrics

| Metric | Type | Mô tả |
|--------|------|-------|
| `crawler_jobs_total` | Counter | Tổng số jobs đã crawl |
| `crawler_jobs_new` | Counter | Số jobs mới |
| `crawler_jobs_updated` | Counter | Số jobs cập nhật |
| `crawler_jobs_unchanged` | Counter | Số jobs không đổi |
| `queue_length` | Gauge | Độ dài queue |
| `worker_processed_total` | Counter | Số jobs đã xử lý |
| `es_bulk_duration_ms` | Histogram | Thời gian bulk index |

### Health Checks

```bash
# Redis
redis-cli PING

# Elasticsearch
curl http://localhost:9200/_cluster/health

# Queue status
redis-cli LLEN jobs:pending:vieclam24h
redis-cli LLEN jobs:raw:vieclam24h

# ES document count
curl http://localhost:9200/jobs_vieclam24h/_count
```

---

## Security Considerations

| Aspect | Implementation |
|--------|----------------|
| **API Tokens** | Bearer tokens, rotated periodically |
| **Rate Limiting** | Polite crawling (3-6s delay) |
| **Input Validation** | HTML sanitization (bluemonday) |
| **Container Security** | Non-root user, read-only filesystem |
| **Network** | Internal Docker network, no external exposure |

---

## Directory Structure

```
job-crawler/
├── cmd/                          # Entry points
│   ├── vieclam24h/
│   │   ├── crawler/main.go       # Stage 1
│   │   └── enricher/main.go      # Stage 2
│   ├── vietnamworks/main.go      # VNW crawler
│   └── worker/main.go            # Stage 3
├── internal/
│   ├── common/                   # Shared utilities
│   │   ├── cleaner/              # HTML cleaning
│   │   ├── dedup/                # Deduplication
│   │   ├── extractor/            # Data extraction
│   │   ├── indexer/              # ES indexing
│   │   └── normalizer/           # Data normalization
│   ├── config/                   # Configuration
│   ├── domain/                   # Domain models
│   ├── module/                   # Source-specific crawlers
│   │   ├── vieclam24h/
│   │   ├── vietnamworks/
│   │   ├── topdev/
│   │   ├── careerviet/
│   │   └── worker/
│   └── queue/                    # Redis queue
├── docs/                         # Documentation
├── docker-compose.yml
├── Dockerfile
├── Makefile
└── README.md
```

---

## Related Documentation

- [Crawler Documentation](./crawler.md) - Chi tiết Stage 1
- [Enricher Documentation](./enricher.md) - Chi tiết Stage 2
- [Worker Documentation](./worker.md) - Chi tiết Stage 3
- [Deployment Guide](./deployment.md) - Hướng dẫn triển khai
