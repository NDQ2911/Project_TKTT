# Elasticsearch Index Settings

Cấu hình index cho Vietnamese job search với các analyzer tối ưu.

## Tổng quan

File `index_settings.json` định nghĩa:

- **Analyzers** - xử lý text tiếng Việt
- **Filters** - stopwords, synonyms, shingle
- **Mappings** - cấu trúc fields cho job documents

## Analyzers

| Analyzer | Mục đích | Filters |
|----------|----------|---------|
| `vietnamese` | Search chính | lowercase, asciifolding, stopwords, synonyms |
| `vietnamese_search` | Search query | lowercase, asciifolding, synonyms |
| `vietnamese_exact` | Exact match | lowercase, asciifolding |
| `vietnamese_suggest` | Did-you-mean | lowercase, shingle |
| `autocomplete` | Autocomplete | lowercase, asciifolding, edge_ngram |

## Filters

### Stopwords

Loại bỏ các từ phổ biến không mang nghĩa tìm kiếm:

- Đại từ: tôi, bạn, anh, chị...
- Liên từ: và, hoặc, hay, với...
- Từ chức năng: là, được, có, bị...

### Synonyms

Đồng nghĩa cho job search:

- **Địa danh**: hcm ↔ ho chi minh ↔ sai gon
- **Chức vụ**: nhan vien ↔ nv ↔ staff
- **Ngành nghề**: ke toan ↔ accountant
- **Hình thức**: fulltime ↔ toan thoi gian

### Shingle

Tạo n-grams cho phrase suggest (did-you-mean):

- min: 2, max: 3
- Ví dụ: "nhân viên" → ["nhân", "viên", "nhân viên"]

## Field Mappings

### Title

```json
"title": {
  "type": "text",
  "analyzer": "vietnamese",
  "fields": {
    "keyword": { "type": "keyword" },
    "suggest": { "type": "text", "analyzer": "vietnamese_suggest" },
    "autocomplete": { "type": "text", "analyzer": "autocomplete" }
  }
}
```

### Các field khác

- `company`, `location`, `description`, `requirements`, `benefits` - text với Vietnamese analyzer
- `location_city`, `work_type`, `experience`, `skills` - keyword (exact match)
- `salary_min`, `salary_max`, `total_views` - integer
- `created_at`, `expired_at`, `crawled_at` - date

## Sử dụng

Worker tự động load settings khi tạo index mới:

```go
// Load from config/index_settings.json
data, _ := os.ReadFile("config/index_settings.json")
indexer.EnsureIndexWithSettings(ctx, data)
```

## Cập nhật Settings

⚠️ **Lưu ý**: Thay đổi analyzer settings yêu cầu recreate index!

```bash
# 1. Xóa index cũ
curl -X DELETE "http://localhost:9200/jobs_vieclam24h"

# 2. Restart worker để tạo index mới
just up

# 3. Chờ crawler re-populate data
```

## Testing

```bash
# Test analyzer
curl -X POST "localhost:9200/jobs_vieclam24h/_analyze" \
  -H "Content-Type: application/json" \
  -d '{"analyzer": "vietnamese", "text": "Nhân viên kế toán HCM"}'

# Test suggest
curl -X POST "localhost:3000/api/crawler/search" \
  -H "Content-Type: application/json" \
  -d '{"q": "nhan vien"}' | jq '.didYouMean'
```
