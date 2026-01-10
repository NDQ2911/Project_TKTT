# Job Crawler - Hướng dẫn Triển khai

## Yêu cầu Hệ thống

### Hardware

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| CPU | 2 cores | 4+ cores |
| RAM | 4 GB | 8+ GB |
| Disk | 20 GB SSD | 50+ GB SSD |

### Software

| Software | Version | Mô tả |
|----------|---------|-------|
| Docker | 24.0+ | Container runtime |
| Docker Compose | 2.20+ | Multi-container orchestration |
| Go | 1.24+ | (Optional) Local development |

---

## Quick Start

### 1. Clone Repository

```bash
git clone https://github.com/project-tktt/job-crawler.git
cd job-crawler
```

### 2. Cấu hình Environment

Tạo file `.env` (optional, có defaults):

```env
# Redis
REDIS_ADDR=redis:6379
REDIS_PASSWORD=
REDIS_DB=0

# Elasticsearch
ELASTICSEARCH_URL=http://elasticsearch:9200
ELASTICSEARCH_INDEX=jobs_vieclam24h

# Crawler
CRAWLER_DELAY_MS=3000

# Worker
WORKER_CONCURRENCY=5
WORKER_BATCH_SIZE=100
```

### 3. Build & Run

```bash
# Build tất cả images
make build

# Start tất cả services
make up

# Xem logs
make logs
```

### 4. Verify

```bash
# Check container status
make ps

# Check stats
make stats
```

---

## Triển khai theo Stages

### Development Mode

```bash
# Chỉ chạy infrastructure
docker compose up -d redis elasticsearch

# Chạy crawler locally
go run cmd/vieclam24h/crawler/main.go

# Chạy enricher locally
go run cmd/vieclam24h/enricher/main.go

# Chạy worker locally
go run cmd/worker/main.go
```

### Production Mode

```bash
# Build với multi-stage Dockerfile
docker compose -f docker-compose.yml build

# Start với replicas
docker compose up -d --scale worker=3
```

---

## Docker Compose Services

### Service Overview

| Service | Port | Mô tả |
|---------|------|-------|
| `redis` | 6379 | Message broker + Dedup storage |
| `elasticsearch` | 9200, 9300 | Search engine |
| `vl24h-crawler` | - | Stage 1: API fetching |
| `vl24h-enricher` | - | Stage 2: HTML scraping |
| `worker` | - | Stage 3: Normalization + Indexing |

### docker-compose.yml

```yaml
version: "3.9"

services:
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    command: redis-server --appendonly yes
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  elasticsearch:
    image: docker.elastic.co/elasticsearch/elasticsearch:8.11.0
    environment:
      - discovery.type=single-node
      - xpack.security.enabled=false
      - "ES_JAVA_OPTS=-Xms512m -Xmx512m"
    ports:
      - "9200:9200"
    volumes:
      - es_data:/usr/share/elasticsearch/data
    healthcheck:
      test: ["CMD-SHELL", "curl -s http://localhost:9200/_cluster/health | grep -q 'green\\|yellow'"]
      interval: 30s
      timeout: 10s
      retries: 5

  vl24h-crawler:
    build:
      context: .
      dockerfile: Dockerfile
      target: crawler
    environment:
      - REDIS_ADDR=redis:6379
      - CRAWLER_DELAY_MS=3000
    depends_on:
      redis:
        condition: service_healthy
    restart: unless-stopped

  vl24h-enricher:
    build:
      context: .
      dockerfile: Dockerfile
      target: enricher
    environment:
      - REDIS_ADDR=redis:6379
      - REDIS_JOB_QUEUE=jobs:raw:vieclam24h
      - CRAWLER_DELAY_MS=5000
    depends_on:
      redis:
        condition: service_healthy
    restart: unless-stopped

  worker:
    build:
      context: .
      dockerfile: Dockerfile
      target: worker
    environment:
      - REDIS_ADDR=redis:6379
      - REDIS_JOB_QUEUE=jobs:raw:vieclam24h
      - ELASTICSEARCH_URL=http://elasticsearch:9200
      - ELASTICSEARCH_INDEX=jobs_vieclam24h
      - WORKER_CONCURRENCY=5
      - WORKER_BATCH_SIZE=100
    depends_on:
      redis:
        condition: service_healthy
      elasticsearch:
        condition: service_healthy
    restart: unless-stopped

volumes:
  redis_data:
  es_data:
```

---

## Dockerfile

### Multi-stage Build

```dockerfile
# ============================================
# Stage: Builder
# ============================================
FROM golang:1.21-alpine AS builder

WORKDIR /app

# Install dependencies
RUN apk add --no-cache git ca-certificates

# Copy go modules
COPY go.mod go.sum ./
RUN go mod download

# Copy source
COPY . .

# Build all binaries
RUN CGO_ENABLED=0 GOOS=linux go build -o /bin/vl24h-crawler ./cmd/vieclam24h/crawler
RUN CGO_ENABLED=0 GOOS=linux go build -o /bin/vl24h-enricher ./cmd/vieclam24h/enricher
RUN CGO_ENABLED=0 GOOS=linux go build -o /bin/worker ./cmd/worker

# ============================================
# Stage: Crawler
# ============================================
FROM alpine:3.19 AS crawler

RUN apk add --no-cache ca-certificates tzdata
COPY --from=builder /bin/vl24h-crawler /bin/vl24h-crawler

USER nobody
ENTRYPOINT ["/bin/vl24h-crawler"]

# ============================================
# Stage: Enricher
# ============================================
FROM alpine:3.19 AS enricher

RUN apk add --no-cache ca-certificates tzdata
COPY --from=builder /bin/vl24h-enricher /bin/vl24h-enricher

USER nobody
ENTRYPOINT ["/bin/vl24h-enricher"]

# ============================================
# Stage: Worker
# ============================================
FROM alpine:3.19 AS worker

RUN apk add --no-cache ca-certificates tzdata
COPY --from=builder /bin/worker /bin/worker

USER nobody
ENTRYPOINT ["/bin/worker"]
```

---

## Makefile Commands

```makefile
.PHONY: build up down logs clean stats

# Build all Docker images
build:
 docker compose build

# Start all services
up:
 docker compose up -d

# Stop all services
down:
 docker compose down

# View logs (all services)
logs:
 docker compose logs -f

# View specific logs
logs-crawler:
 docker compose logs -f vl24h-crawler

logs-enricher:
 docker compose logs -f vl24h-enricher

logs-worker:
 docker compose logs -f worker

# Container status
ps:
 docker compose ps

# Statistics
stats:
 @echo "=== Queue Lengths ==="
 @docker compose exec redis redis-cli LLEN jobs:pending:vieclam24h
 @docker compose exec redis redis-cli LLEN jobs:raw:vieclam24h
 @echo "\n=== Elasticsearch Document Count ==="
 @curl -s localhost:9200/jobs_vieclam24h/_count | jq .count

# Clean (stop + remove volumes)
clean:
 docker compose down -v

# Redis CLI
redis:
 docker compose exec redis redis-cli

# Rebuild and restart
rebuild:
 docker compose down
 docker compose build --no-cache
 docker compose up -d
```

---

## Monitoring

### Health Check Endpoints

```bash
# Redis health
docker compose exec redis redis-cli PING
# Expected: PONG

# Elasticsearch health
curl -s localhost:9200/_cluster/health | jq
# Expected: status = "green" or "yellow"

# Queue status
docker compose exec redis redis-cli INFO keyspace
```

### Log Monitoring

```bash
# All services
docker compose logs -f

# Specific service with timestamps
docker compose logs -f --timestamps vl24h-crawler

# Last 100 lines
docker compose logs --tail=100 worker
```

### Metrics Collection

```bash
# Queue lengths over time
watch -n 5 'docker compose exec redis redis-cli LLEN jobs:pending:vieclam24h'

# ES document count
watch -n 10 'curl -s localhost:9200/jobs_vieclam24h/_count | jq .count'
```

---

## Backup & Recovery

### Redis Backup

```bash
# Create RDB snapshot
docker compose exec redis redis-cli BGSAVE

# Copy backup file
docker cp $(docker compose ps -q redis):/data/dump.rdb ./backup/redis-$(date +%Y%m%d).rdb
```

### Elasticsearch Backup

```bash
# Create snapshot repository
curl -X PUT "localhost:9200/_snapshot/backup" -H 'Content-Type: application/json' -d'
{
  "type": "fs",
  "settings": {
    "location": "/usr/share/elasticsearch/backup"
  }
}'

# Create snapshot
curl -X PUT "localhost:9200/_snapshot/backup/snapshot_$(date +%Y%m%d)"
```

### Recovery

```bash
# Restore Redis
docker cp ./backup/redis-20250109.rdb $(docker compose ps -q redis):/data/dump.rdb
docker compose restart redis

# Restore ES
curl -X POST "localhost:9200/_snapshot/backup/snapshot_20250109/_restore"
```

---

## Troubleshooting

### Common Issues

#### 1. Redis Connection Failed

```bash
# Check if Redis is running
docker compose ps redis

# Check Redis logs
docker compose logs redis

# Test connection
docker compose exec redis redis-cli PING
```

#### 2. Elasticsearch Not Starting

```bash
# Check ES logs
docker compose logs elasticsearch

# Common fix: increase vm.max_map_count
sudo sysctl -w vm.max_map_count=262144

# Persist the setting
echo "vm.max_map_count=262144" | sudo tee -a /etc/sysctl.conf
```

#### 3. Queue Not Draining

```bash
# Check worker is running
docker compose ps worker

# Check worker logs
docker compose logs worker

# Verify queue has items
docker compose exec redis redis-cli LLEN jobs:raw:vieclam24h
```

#### 4. No Jobs Being Crawled

```bash
# Check crawler logs
docker compose logs vl24h-crawler

# Verify API is accessible
curl -I https://apiv2.vieclam24h.vn/employer/fe/job/get-job-list

# Check dedup keys (too many = all jobs seen)
docker compose exec redis redis-cli KEYS "job:seen:*" | wc -l
```

#### 5. Elasticsearch Index Errors

```bash
# Check index exists
curl localhost:9200/jobs_vieclam24h

# Check mapping
curl localhost:9200/jobs_vieclam24h/_mapping | jq

# Delete and recreate index
curl -X DELETE localhost:9200/jobs_vieclam24h
docker compose restart worker
```

### Reset Everything

```bash
# Nuclear option: remove all data and restart
make clean
make build
make up
```

---

## Production Checklist

### Pre-deployment

- [ ] Configure proper Redis password
- [ ] Enable Elasticsearch security
- [ ] Set up proper logging (ELK/Loki)
- [ ] Configure backup schedule
- [ ] Set resource limits in Docker Compose
- [ ] Configure health check alerts

### Security

- [ ] Use secrets management (Docker secrets, Vault)
- [ ] Run containers as non-root
- [ ] Enable TLS for Redis/Elasticsearch
- [ ] Restrict network access

### Monitoring

- [ ] Set up Prometheus + Grafana
- [ ] Configure alerting (PagerDuty, Slack)
- [ ] Set up log aggregation
- [ ] Monitor disk usage

### Scaling

- [ ] Configure Redis cluster for HA
- [ ] Set up Elasticsearch cluster (3+ nodes)
- [ ] Use Kubernetes for orchestration
- [ ] Implement circuit breakers

---

## Cloud Deployment

### AWS

```yaml
# ECS Task Definition (simplified)
{
  "family": "job-crawler",
  "containerDefinitions": [
    {
      "name": "worker",
      "image": "your-ecr-repo/worker:latest",
      "memory": 512,
      "cpu": 256,
      "environment": [
        {"name": "REDIS_ADDR", "value": "your-elasticache-endpoint:6379"},
        {"name": "ELASTICSEARCH_URL", "value": "your-opensearch-endpoint"}
      ]
    }
  ]
}
```

### GCP

```yaml
# Cloud Run service.yaml
apiVersion: serving.knative.dev/v1
kind: Service
metadata:
  name: job-crawler-worker
spec:
  template:
    spec:
      containers:
        - image: gcr.io/your-project/worker:latest
          env:
            - name: REDIS_ADDR
              value: "your-memorystore:6379"
```

---

## Related Documentation

- [Architecture](./architecture.md) - Kiến trúc hệ thống
- [Crawler](./crawler.md) - Chi tiết Stage 1
- [Enricher](./enricher.md) - Chi tiết Stage 2
- [Worker](./worker.md) - Chi tiết Stage 3
