# Quy trình xử lý dữ liệu tuyển dụng

## 1. Mô tả dữ liệu

### 1.1. Cấu trúc dữ liệu

Bộ dữ liệu bao gồm các tin tuyển dụng được thu thập từ các trang web việc làm, mỗi bản ghi chứa 10 trường thông tin:

| STT | Tên trường | Mô tả | Kiểu dữ liệu |
|-----|------------|-------|--------------|
| 1 | Id tin | Mã định danh duy nhất của tin tuyển dụng | Chuỗi số |
| 2 | Tiêu đề tin | Tên vị trí công việc cần tuyển | Văn bản |
| 3 | Địa điểm tuyển dụng | Địa chỉ chi tiết nơi làm việc | Văn bản |
| 4 | Tỉnh thành tuyển dụng | Tỉnh/thành phố nơi làm việc | Văn bản |
| 5 | Chức vụ | Cấp bậc vị trí (Nhân viên, Quản lý,...) | Văn bản |
| 6 | Mức lương | Khoảng lương hoặc thỏa thuận | Văn bản |
| 7 | Hình thức làm việc | Loại hình công việc (Toàn thời gian, Bán thời gian,...) | Văn bản |
| 8 | Ngành nghề | Lĩnh vực ngành nghề chính | Văn bản |
| 9 | Lĩnh vực | Chuyên môn cụ thể của công việc | Văn bản |
| 10 | Kinh nghiệm | Yêu cầu số năm kinh nghiệm | Văn bản |

### 1.2. Mẫu dữ liệu

```json
[
    {
        "Id tin": "784544",
        "Tiêu đề tin": "Nhân viên SEO",
        "Địa điểm tuyển dụng": "47 Đường 12 Hiệp Bình Phước Thủ Đức Thành Phố Hồ Chí Minh",
        "Tỉnh thành tuyển dụng": "Hồ Chí Minh",
        "Chức vụ": "Nhân viên",
        "Mức lương": "10 - 15 triệu",
        "Hình thức làm việc": "Toàn thời gian cố định",
        "Ngành nghề": "Marketing - PR",
        "Lĩnh vực": "seo leader",
        "Kinh nghiệm": "0 - 1 năm kinh nghiệm"
    },
    {
        "Id tin": "784537",
        "Tiêu đề tin": "Frontend Developer - Upto 20mil",
        "Địa điểm tuyển dụng": "Lầu 4, tòa nhà SCSC, 30 Phan Thúc Duyện, phường 4, quận Tân Bình, TP. HCM.",
        "Tỉnh thành tuyển dụng": "Hồ Chí Minh",
        "Chức vụ": "Nhân viên",
        "Mức lương": "15 - 20 triệu",
        "Hình thức làm việc": "Toàn thời gian cố định",
        "Ngành nghề": "IT Phần cứng - mạng, IT phần mềm",
        "Lĩnh vực": "lập trình Web",
        "Kinh nghiệm": "1 - 2 năm kinh nghiệm"
    }
]
```

---

## 2. Phân tích và phân loại trường dữ liệu

### 2.1. Thống kê dữ liệu thực tế

Dựa trên kết quả aggregation từ Elasticsearch với tổng số **9,358 tin tuyển dụng**:

#### 2.1.1. Phân bố theo Tỉnh thành (Top 10)

| Tỉnh thành | Số tin | Tỷ lệ |
|------------|--------|-------|
| Hồ Chí Minh | 4,259 | 45.5% |
| Hà Nội | 2,840 | 30.3% |
| Bình Dương | 620 | 6.6% |
| Đà Nẵng | 209 | 2.2% |
| Đồng Nai | 185 | 2.0% |
| Long An | 128 | 1.4% |
| Hải Phòng | 85 | 0.9% |
| Cần Thơ | 66 | 0.7% |
| Hưng Yên | 66 | 0.7% |
| Hải Dương | 58 | 0.6% |

#### 2.1.2. Phân bố theo Chức vụ

| Chức vụ | Số tin | Tỷ lệ |
|---------|--------|-------|
| Nhân viên | 7,956 | 85.0% |
| Mới Tốt Nghiệp | 397 | 4.2% |
| Trưởng Phòng | 341 | 3.6% |
| Thực tập sinh | 249 | 2.7% |
| Trưởng nhóm | 225 | 2.4% |
| Quản lý cấp trung | 68 | 0.7% |
| Giám Đốc | 56 | 0.6% |
| Quản lý cấp cao | 35 | 0.4% |
| Phó phòng | 31 | 0.3% |

#### 2.1.3. Phân bố theo Hình thức làm việc

| Hình thức | Số tin | Tỷ lệ |
|-----------|--------|-------|
| Toàn thời gian cố định | 7,816 | 83.5% |
| Bán thời gian | 1,082 | 11.6% |
| Hợp đồng | 188 | 2.0% |
| Khác | 139 | 1.5% |
| Toàn thời gian tạm thời | 120 | 1.3% |
| Bán thời gian tạm thời | 13 | 0.1% |

#### 2.1.4. Phân bố theo Kinh nghiệm

| Kinh nghiệm | Số tin | Tỷ lệ |
|-------------|--------|-------|
| Không yêu cầu | 4,336 | 46.3% |
| 0 - 1 năm | 2,137 | 22.8% |
| 1 - 2 năm | 2,038 | 21.8% |
| 2 - 5 năm | 753 | 8.0% |
| 5 - 10 năm | 85 | 0.9% |
| Hơn 10 năm | 9 | 0.1% |

#### 2.1.5. Phân bố theo Mức lương

| Mức lương | Số tin | Tỷ lệ |
|-----------|--------|-------|
| 7 - 10 triệu | 3,333 | 35.6% |
| 10 - 15 triệu | 2,545 | 27.2% |
| Thỏa thuận | 1,223 | 13.1% |
| 5 - 7 triệu | 960 | 10.3% |
| 15 - 20 triệu | 659 | 7.0% |
| 20 - 30 triệu | 217 | 2.3% |
| Trên 30 triệu | 151 | 1.6% |
| 3 - 5 triệu | 107 | 1.1% |
| 1 - 3 triệu | 99 | 1.1% |
| Trên 50 triệu | 55 | 0.6% |

---

### 2.2. Đánh giá khả năng sử dụng Inverted Index

Dựa trên thống kê, đánh giá các trường phù hợp cho kỹ thuật **Inverted Index**:

| Trường | Số giá trị unique | Cấu trúc | Phù hợp Inverted Index | Ghi chú |
|--------|-------------------|----------|------------------------|---------|
| Tỉnh thành tuyển dụng | ~63 | Cố định | Rất cao | 63 tỉnh/thành Việt Nam |
| Chức vụ | 9 | Cố định | Rất cao | Tập giá trị nhỏ, ổn định |
| Hình thức làm việc | 6 | Cố định | Rất cao | Tập giá trị nhỏ nhất |
| Kinh nghiệm | 6 | Cố định | Rất cao | Áp dụng mảng ký hiệu |
| Mức lương | ~12 | Bán cố định | Trung bình | Sử dụng Range Query |
| Ngành nghề | ~50+ | Động | Trung bình | Có thể kết hợp nhiều ngành |

**Kết luận**: 4/6 trường lọc có cấu trúc hoàn toàn cố định và phù hợp tuyệt đối với Inverted Index.

---

### 2.3. Phân loại theo chức năng tìm kiếm

Các trường dữ liệu được phân loại thành 3 nhóm chức năng chính:

#### 2.3.1. Nhóm tìm kiếm toàn văn (Full-text Search)

Các trường này sử dụng kỹ thuật tìm kiếm toàn văn với phân tích ngôn ngữ tiếng Việt:

| Trường | Lý do |
|--------|-------|
| Tiêu đề tin | Chứa từ khóa mô tả vị trí công việc |
| Ngành nghề | Chứa nhiều ngành nghề phân cách bởi dấu phẩy |
| Lĩnh vực | Mô tả chi tiết chuyên môn |
| Địa điểm tuyển dụng | Chứa địa chỉ chi tiết cần tìm kiếm linh hoạt |

#### 2.3.2. Nhóm lọc bằng Inverted Index (Filter - Keyword)

Các trường sử dụng Inverted Index cho lọc chính xác với tốc độ O(1):

| Trường | Số giá trị | Kỹ thuật |
|--------|------------|----------|
| Tỉnh thành tuyển dụng | 63 | terms query |
| Chức vụ | 9 | terms query |
| Hình thức làm việc | 6 | terms query |
| Kinh nghiệm | 6 (+ mảng ký hiệu) | terms query với tags |

#### 2.3.3. Nhóm lọc bằng Range Query (Filter - Range)

Các trường sử dụng Range Query cho lọc theo khoảng giá trị số:

| Trường | Lý do |
|--------|-------|
| Mức lương | Cấu trúc không hoàn toàn cố định, cần linh hoạt khoảng tìm kiếm |

#### 2.3.4. Nhóm sắp xếp (Sort)

Các trường hỗ trợ sắp xếp kết quả tìm kiếm:

| Trường | Hướng sắp xếp | Ghi chú |
|--------|---------------|---------|
| Mức lương | Tăng/Giảm dần | Cần chuẩn hóa về số để sắp xếp |
| Kinh nghiệm | Tăng/Giảm dần | Cần chuẩn hóa về số để sắp xếp |
| Id tin | Tăng/Giảm dần | Sắp xếp theo thời gian đăng tin |

---

## 3. Thiết kế Index

### 3.1. Cấu trúc Elasticsearch Index

```json
{
  "settings": {
    "analysis": {
      "analyzer": {
        "vietnamese_analyzer": {
          "type": "custom",
          "tokenizer": "standard",
          "filter": ["lowercase", "asciifolding"]
        }
      }
    }
  },
  "mappings": {
    "properties": {
      "Id tin": { "type": "keyword" },
      "Tiêu đề tin": { 
        "type": "text", 
        "analyzer": "vietnamese_analyzer",
        "fields": {
          "keyword": { "type": "keyword" }
        }
      },
      "Địa điểm tuyển dụng": { 
        "type": "text", 
        "analyzer": "vietnamese_analyzer" 
      },
      "Tỉnh thành tuyển dụng": { 
        "type": "keyword"
      },
      "Chức vụ": { 
        "type": "keyword"
      },
      "Mức lương": { 
        "type": "text",
        "fields": {
          "keyword": { "type": "keyword" }
        }
      },
      "salary_min": { "type": "integer" },
      "salary_max": { "type": "integer" },
      "Hình thức làm việc": { 
        "type": "keyword"
      },
      "Ngành nghề": { 
        "type": "text", 
        "analyzer": "vietnamese_analyzer",
        "fields": {
          "keyword": { "type": "keyword" }
        }
      },
      "Lĩnh vực": { 
        "type": "text", 
        "analyzer": "vietnamese_analyzer" 
      },
      "Kinh nghiệm": { 
        "type": "keyword"
      },
      "experience_tags": { "type": "keyword" }
    }
  }
}
```

### 3.2. Giải thích thiết kế

**Kiểu `keyword`**: Dùng cho các trường cần lọc chính xác (exact match) và aggregation.

**Kiểu `text`**: Dùng cho các trường cần tìm kiếm toàn văn với phân tích từ.

**Multi-fields**: Một số trường sử dụng cả `text` và `keyword` để hỗ trợ cả tìm kiếm và lọc.

**Trường bổ sung**: `salary_min`, `salary_max` được thêm để hỗ trợ lọc theo khoảng giá trị số. `experience_tags` được thêm để hỗ trợ lọc kinh nghiệm theo mảng ký hiệu.

---

## 4. Xử lý trường Kinh nghiệm (Inverted Index với Mảng ký hiệu)

### 4.1. Phân tích đặc điểm

Trường "Kinh nghiệm" có đặc điểm quan trọng: tập giá trị hữu hạn và cố định. Điều này cho phép áp dụng kỹ thuật **Inverted Index với mảng ký hiệu** thay vì range query thông thường.

### 4.2. Bảng ánh xạ ký hiệu

Mỗi khoảng kinh nghiệm cơ bản được gán một ký hiệu duy nhất:

| Khoảng kinh nghiệm | Ký hiệu | Mô tả |
|--------------------|---------|-------|
| 0 năm | A | Không yêu cầu kinh nghiệm |
| 0 - 1 năm | B | Fresher |
| 1 - 2 năm | C | Junior |
| 2 - 5 năm | D | Middle |
| 5 - 10 năm | E | Senior |
| Trên 10 năm | F | Expert |

### 4.3. Nguyên lý ánh xạ mảng

Các khoảng kinh nghiệm tổng hợp được biểu diễn dưới dạng mảng các ký hiệu:

| Giá trị gốc | Mảng ký hiệu | Giải thích |
|-------------|--------------|------------|
| Không yêu cầu | ["A", "B", "C", "D", "E", "F"] | Chấp nhận mọi mức kinh nghiệm |
| 0 - 1 năm | ["A", "B"] | Chấp nhận 0 hoặc 0-1 năm |
| 1 - 2 năm | ["C"] | Yêu cầu đúng 1-2 năm |
| 2 - 5 năm | ["D"] | Yêu cầu đúng 2-5 năm |
| 0 - 2 năm | ["A", "B", "C"] | Chấp nhận từ 0 đến 2 năm |
| 0 - 5 năm | ["A", "B", "C", "D"] | Chấp nhận từ 0 đến 5 năm |
| 5 - 10 năm | ["E"] | Yêu cầu đúng 5-10 năm |
| Trên 10 năm | ["F"] | Yêu cầu trên 10 năm |

### 4.4. Thiết kế Index cho Kinh nghiệm

```json
{
  "Kinh nghiệm": {
    "type": "keyword"
  },
  "experience_tags": {
    "type": "keyword"
  }
}
```

Trường `experience_tags` lưu mảng ký hiệu, cho phép sử dụng `terms` query để tìm kiếm hiệu quả.

### 4.5. Thuật toán chuyển đổi

```javascript
const EXPERIENCE_MAP = {
    "Không yêu cầu": ["A", "B", "C", "D", "E", "F"],
    "0 - 1 năm kinh nghiệm": ["A", "B"],
    "1 - 2 năm kinh nghiệm": ["C"],
    "2 - 5 năm kinh nghiệm": ["D"],
    "5 - 10 năm kinh nghiệm": ["E"],
    "Trên 10 năm kinh nghiệm": ["F"]
};

function mapExperienceToTags(expString) {
    return EXPERIENCE_MAP[expString] || ["A", "B", "C", "D", "E", "F"];
}
```

### 4.6. Truy vấn tìm kiếm theo kinh nghiệm

Khi ứng viên có 3 năm kinh nghiệm (thuộc khoảng D), tìm các tin phù hợp:

```json
{
  "query": {
    "terms": {
      "experience_tags": ["D"]
    }
  }
}
```

Ưu điểm của phương pháp này:

- Tốc độ truy vấn nhanh hơn range query do sử dụng inverted index
- Dễ dàng mở rộng thêm các khoảng kinh nghiệm mới
- Hỗ trợ tìm kiếm đa khoảng (ví dụ: tìm tin cho cả junior và middle)

---

## 5. Xử lý trường Mức lương (Range Query)

### 5.1. Phân tích đặc điểm

Khác với trường Kinh nghiệm, trường "Mức lương" **không có cấu trúc cố định**:

- Giá trị có thể là khoảng ("10 - 15 triệu"), đơn lẻ ("Trên 30 triệu"), hoặc không xác định ("Thỏa thuận")
- Mức lương có thể thay đổi linh hoạt theo thời gian
- Cần hỗ trợ truy vấn theo khoảng giá trị bất kỳ

Do đó, phương pháp **Range Query** với trường số là phù hợp nhất.

### 5.2. Thiết kế Index cho Mức lương

```json
{
  "Mức lương": {
    "type": "text",
    "fields": {
      "keyword": { "type": "keyword" }
    }
  },
  "salary_min": { "type": "integer" },
  "salary_max": { "type": "integer" }
}
```

### 5.3. Bảng chuẩn hóa mức lương

| Giá trị gốc | salary_min (triệu) | salary_max (triệu) | Ghi chú |
|-------------|--------------------|--------------------|----------|
| Thỏa thuận | 0 | 999 | Không giới hạn |
| 7 - 10 triệu | 7 | 10 | Khoảng cố định |
| 10 - 15 triệu | 10 | 15 | Khoảng cố định |
| 15 - 20 triệu | 15 | 20 | Khoảng cố định |
| 20 - 30 triệu | 20 | 30 | Khoảng cố định |
| Trên 30 triệu | 30 | 999 | Không giới hạn trên |

### 5.4. Thuật toán chuẩn hóa

```javascript
function parseSalary(salaryString) {
    if (!salaryString || salaryString === "Thỏa thuận") {
        return { min: 0, max: 999 };
    }
    
    // Xử lý khoảng: "10 - 15 triệu"
    const rangeMatch = salaryString.match(/(\d+)\s*-\s*(\d+)/);
    if (rangeMatch) {
        return { 
            min: parseInt(rangeMatch[1]), 
            max: parseInt(rangeMatch[2]) 
        };
    }
    
    // Xử lý "Trên X triệu"
    const aboveMatch = salaryString.match(/[Tt]rên\s*(\d+)/);
    if (aboveMatch) {
        return { min: parseInt(aboveMatch[1]), max: 999 };
    }
    
    // Xử lý "Dưới X triệu"
    const belowMatch = salaryString.match(/[Dd]ưới\s*(\d+)/);
    if (belowMatch) {
        return { min: 0, max: parseInt(belowMatch[1]) };
    }
    
    return { min: 0, max: 999 };
}
```

### 5.5. Các loại truy vấn mức lương

Tìm tin với mức lương tối thiểu 15 triệu:

```json
{
  "query": {
    "range": {
      "salary_min": { "gte": 15 }
    }
  }
}
```

Tìm tin với mức lương trong khoảng 10-20 triệu:

```json
{
  "query": {
    "bool": {
      "must": [
        { "range": { "salary_min": { "lte": 20 } } },
        { "range": { "salary_max": { "gte": 10 } } }
      ]
    }
  }
}
```

### 5.6. So sánh hai phương pháp

| Tiêu chí | Inverted Index (Kinh nghiệm) | Range Query (Mức lương) |
|----------|------------------------------|-------------------------|
| Cấu trúc dữ liệu | Tập hữu hạn, cố định | Liên tục, có thể thay đổi |
| Tốc độ truy vấn | Rất nhanh (O(1) lookup) | Nhanh (B-tree traversal) |
| Linh hoạt | Thấp (cần định nghĩa trước) | Cao (khoảng bất kỳ) |
| Phù hợp | Categorical data | Numerical data |

---

## 6. Quy trình đánh chỉ mục (Indexing Pipeline)

### 6.1. Sơ đồ quy trình

```
Dữ liệu thô (JSON)
       |
       v
+------------------+
| 1. Đọc dữ liệu   |
+------------------+
       |
       v
+------------------+
| 2. Chuẩn hóa     |
|  - Parse lương   |
|  - Parse KN      |
+------------------+
       |
       v
+------------------+
| 3. Làm sạch      |
|  - Trim spaces   |
|  - Lowercase     |
+------------------+
       |
       v
+------------------+
| 4. Đánh index    |
|  - Bulk API      |
+------------------+
       |
       v
  Elasticsearch
```

### 6.2. Mã nguồn xử lý

```javascript
async function processAndIndex(jobs) {
    const bulkBody = [];
    
    for (const job of jobs) {
        const salary = parseSalary(job["Mức lương"]);
        const experience = parseExperience(job["Kinh nghiệm"]);
        
        const document = {
            ...job,
            salary_min: salary.min,
            salary_max: salary.max,
            experience_tags: experience.tags
        };
        
        bulkBody.push({ index: { _index: "jobs", _id: job["Id tin"] } });
        bulkBody.push(document);
    }
    
    await esClient.bulk({ body: bulkBody });
}
```

---

## 7. Các loại truy vấn

### 7.1. Tìm kiếm toàn văn

```json
{
  "query": {
    "multi_match": {
      "query": "lập trình web",
      "fields": ["Tiêu đề tin^3", "Ngành nghề^2", "Lĩnh vực"],
      "type": "best_fields"
    }
  }
}
```

### 7.2. Kết hợp tìm kiếm và lọc

```json
{
  "query": {
    "bool": {
      "must": [
        {
          "multi_match": {
            "query": "developer",
            "fields": ["Tiêu đề tin", "Lĩnh vực"]
          }
        }
      ],
      "filter": [
        { "term": { "Tỉnh thành tuyển dụng": "Hồ Chí Minh" } },
        { "range": { "salary_min": { "gte": 15 } } },
        { "terms": { "experience_tags": ["C", "D"] } }
      ]
    }
  },
  "sort": [
    { "salary_max": { "order": "desc" } }
  ]
}
```

### 7.3. Aggregation cho thống kê

```json
{
  "size": 0,
  "aggs": {
    "theo_tinh_thanh": {
      "terms": { "field": "Tỉnh thành tuyển dụng", "size": 10 }
    },
    "theo_hinh_thuc": {
      "terms": { "field": "Hình thức làm việc", "size": 10 }
    },
    "thong_ke_luong": {
      "stats": { "field": "salary_max" }
    }
  }
}
```

---

## 8. Kết luận

Quy trình xử lý dữ liệu tuyển dụng bao gồm các bước chính:

1. **Phân tích cấu trúc dữ liệu**: Xác định 10 trường thông tin và đặc điểm của từng trường.

2. **Phân loại chức năng**: Chia thành 3 nhóm - tìm kiếm toàn văn, lọc, và sắp xếp.

3. **Thiết kế index**: Sử dụng Elasticsearch với analyzer tiếng Việt và multi-fields.

4. **Chuẩn hóa dữ liệu**: Chuyển đổi các trường văn bản (lương, kinh nghiệm) thành giá trị số để hỗ trợ lọc theo khoảng.

5. **Triển khai truy vấn**: Kết hợp full-text search, filter, và aggregation để đáp ứng các nhu cầu tìm kiếm đa dạng.
