import scrapy
import sqlite3
from urllib.parse import urlparse

class HusteduSpider(scrapy.Spider):
    name = "hustedu"
    allowed_domains = ["hust.edu.vn"]
    
    # Bắt đầu từ RSS để lấy tin mới nhất
    start_urls = ["https://hust.edu.vn/vi/news/rss/"]

    custom_settings = {
        "DOWNLOAD_DELAY": 3,
        "RANDOMIZE_DOWNLOAD_DELAY": True,
        "CONCURRENT_REQUESTS": 8,
        "ITEM_PIPELINES": {
           "mycrawler.pipelines.MycrawlerPipeline": 300,
        },
        "DEPTH_LIMIT": 7 
    }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.con = sqlite3.connect('data.db')
        self.cur = self.con.cursor()
        self.BATCH_SIZE = 50 

    def start_requests(self):
       
        for url in self.start_urls:
            yield scrapy.Request(url, callback=self.parse_rss, priority=100)

        try:
            self.cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='news';")
            if self.cur.fetchone():
                self.cur.execute(f"SELECT url FROM news ORDER BY last_checked ASC LIMIT {self.BATCH_SIZE}")
                old_links = self.cur.fetchall()
                if old_links:
                    print(f"--> [BATCH] Re-crawl {len(old_links)} bài cũ.")
                    for row in old_links:
                        
                        yield scrapy.Request(row[0], callback=self.parse_universal, priority=10, dont_filter=True)
        except Exception:
            pass

    def parse_rss(self, response):
        links = response.xpath("//item/link/text()").getall()
        print(f"--> [RSS] Tìm thấy {len(links)} link mới từ RSS.")
        
        for link in links:
            url = link.strip()
            # Từ RSS nhảy vào trang bài viết (HTML) -> gọi parse_universal
            yield scrapy.Request(url, callback=self.parse_universal, priority=50)

    def parse_universal(self, response):
    
        title = response.css('h1.title-page::text').get(default="").strip()
        if not title: title = response.css('div.news-detail h1::text').get(default="").strip()
        if not title: title = response.css('div.main-content h1::text').get(default="").strip()
        if not title: title = response.xpath('//title/text()').get(default="").strip()


        short = ""
        
        short = response.xpath('//meta[@name="description"]/@content').get(default="").strip()
        
        if not short:
            summary_parts = response.css('div.news-summary *::text').getall()
            short = " ".join(summary_parts).strip()
            
        if not short:
            sapo_parts = response.css('div.news-body strong:first-child *::text').getall()
            short = " ".join(sapo_parts).strip()

        if not short:
            first_p = response.css('div.news-body p::text').get(default="").strip()
            if len(first_p) > 20:
                short = first_p

        short = " ".join(short.split())

        if title:
            yield {
                "title": title,
                "short": short,
                "url": response.url
            }
        else:
            if "/news/" in response.url: 
                print(f"⚠️ BỎ QUA (Không title): {response.url}")


        list_links = response.css("div.cat-item h3.cat-title a::attr(href)").getall()
        if not list_links: list_links = response.css("h3.title-news a::attr(href)").getall()

        if list_links:
            for link in list_links:
                url = response.urljoin(link)
                if self.is_new_link(url):
                    yield scrapy.Request(url, callback=self.parse_universal, priority=50)
            
            next_page = response.css("ul.pagination li a[rel='next']::attr(href)").get()
            if not next_page: next_page = response.css("a.next::attr(href)").get()
            if next_page:
                yield response.follow(next_page, callback=self.parse_universal, priority=60)

        body_links = response.css('div.news-body a::attr(href), div#news-bodyhtml a::attr(href), div.main-content a::attr(href)').getall()
        
        for link in body_links:
            full_url = response.urljoin(link)
            parsed = urlparse(full_url)
            
            if ("hust.edu.vn" in parsed.netloc and "/news/" in parsed.path and ".html" in full_url and 
                not any(ext in full_url.lower() for ext in ['.pdf', '.jpg', '.png', 'mailto'])):
                
                if self.is_new_link(full_url):
                    yield scrapy.Request(url=full_url, callback=self.parse_universal, priority=40)

    def is_new_link(self, url):
        self.cur.execute("SELECT 1 FROM news WHERE url = ?", (url,))
        return self.cur.fetchone() is None

    def closed(self, reason):
        self.con.close()