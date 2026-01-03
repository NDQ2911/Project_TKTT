import scrapy
import sqlite3
import random

class CareerlinkSpider(scrapy.Spider):
    name = "careerlink"
    allowed_domains = ["careerlink.vn"]
    start_urls = ["https://www.careerlink.vn/vieclam/list"]
    max_page = 5 

    custom_settings = {
        # ... (Các cấu hình Anti-ban giữ nguyên) ...
        "CONCURRENT_REQUESTS": 2,
        "DOWNLOAD_DELAY": 3,
        "RANDOMIZE_DOWNLOAD_DELAY": True,
        "DEFAULT_REQUEST_HEADERS": {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
        "AUTOTHROTTLE_ENABLED": True,
        
        # 🔴 QUAN TRỌNG: TRỎ VÀO PIPELINE MỚI
        "ITEM_PIPELINES": {
           "mycrawler.pipelines.CareerlinkPipeline": 300, # Số 300 là độ ưu tiên
        }
    }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # Kết nối DB chung data.db
        self.con = sqlite3.connect('data1.db')
        self.cur = self.con.cursor()
        self.BATCH_SIZE = 15 

    def start_requests(self):
        print(f"--> [START] Bắt đầu quét {self.max_page} trang danh sách...")
        yield scrapy.Request(self.start_urls[0], callback=self.parse_list, priority=100)
        for page in range(2, self.max_page + 1):
            next_url = f"https://www.careerlink.vn/vieclam/list?page={page}"
            yield scrapy.Request(next_url, callback=self.parse_list, priority=90)

        # CHECK JOB CŨ (Lấy từ bảng 'jobs' thay vì 'news')
        if random.random() < 0.3:
            try:
                self.cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='jobs';")
                if self.cur.fetchone():
                    self.cur.execute(f"SELECT url FROM jobs ORDER BY last_checked ASC LIMIT {self.BATCH_SIZE}")
                    old_links = self.cur.fetchall()
                    if old_links:
                        print(f"--> [BATCH] Kiểm tra lại {len(old_links)} job cũ.")
                        for row in old_links:
                            yield scrapy.Request(row[0], callback=self.parse_job, priority=10, dont_filter=True)
            except Exception:
                pass

    def parse_list(self, response):
        jobslinks = response.css("a.job-link.clickable-outside::attr(href)").getall()
        print(f"--> [LIST] Trang {response.url} - {len(jobslinks)} job.")
        for link in jobslinks:
            url = response.urljoin(link)
            if self.is_new_link(url):
                yield scrapy.Request(url, callback=self.parse_job, priority=50)

    def parse_job(self, response):
        title = response.css("h1.job-title::text").get(default="").strip()
        if not title: return

        company = response.css("p.org-name a span::text").get(default="").strip()
        location = response.css("div#job-location span a::text").get(default="").strip()
        salary = response.css("div#job-salary span.text-primary::text").get(default="").strip()
        experience = response.css("div.d-flex.align-items-center.mb-2 i.cli-suitcase-simple + span::text").get(default="").strip()

        # Dữ liệu sạch sẽ, đúng chuẩn
        yield {
            "title": title,
            "company": company,
            "location": location,
            "salary": salary,
            "experience": experience,
            "url": response.url
        }

    def is_new_link(self, url):
        # Kiểm tra trong bảng jobs
        try:
            self.cur.execute("SELECT 1 FROM jobs WHERE url = ?", (url,))
            return self.cur.fetchone() is None
        except Exception:
            return True

    def closed(self, reason):
        self.con.close()