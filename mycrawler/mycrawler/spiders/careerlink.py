import scrapy

class CareerlinkSpider(scrapy.Spider):
    name = "careerlink"
    allowed_domains = ["careerlink.vn"]
    start_urls = ["https://www.careerlink.vn/vieclam/list"]
    custom_settings = {
        "CONCURRENT_REQUESTS_PER_DOMAIN": 1,
        "DOWNLOAD_DELAY": 1,
        "RANDOMIZE_DOWNLOAD_DELAY": True,
        "DEFAULT_REQUEST_HEADERS": {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 \
(KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36"
        },
        "ROBOTSTXT_OBEY": False,
        "FEED_FORMAT": "json",
        "FEED_EXPORT_ENCODING": "utf-8"
    }

    max_page = 1

    def parse(self, response):
        # Crawl trang 1
        yield from self.parse_page(response)

        # Crawl từ trang 2 → max_page
        for page in range(2, self.max_page + 1):
            next_url = f"/vieclam/list?page={page}"
            yield response.follow(next_url, callback=self.parse_page)

    def parse_page(self, response):
        jobslinks = response.css("a.job-link.clickable-outside::attr(href)").getall()
        print(f"Trang {response.url} - SỐ JOB LẤY ĐƯỢC:", len(jobslinks))

        for link in jobslinks:
            yield response.follow(link, callback=self.parse_job)

    def parse_job(self, response):
        # Tên công việc
        title = response.css("h1.job-title#job-title::text").get(default="").strip()

        # Tên công ty
        company = response.css("p.org-name a span::text").get(default="").strip()

        # Địa điểm
        location = response.css("div#job-location span a::text").get(default="").strip()

        # Lương
        salary = response.css("div#job-salary span.text-primary::text").get(default="").strip()

        # Kinh nghiệm
        experience = response.css("div.d-flex.align-items-center.mb-2 i.cli-suitcase-simple + span::text").get(default="").strip()

        yield {
            "title": title,
            "company": company,
            "location": location,
            "salary": salary,
            "experience": experience
        }

