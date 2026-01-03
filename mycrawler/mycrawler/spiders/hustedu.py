import scrapy


class HusteduRssSpider(scrapy.Spider):
    name = "hustedu_rss"
    allowed_domains = ["hust.edu.vn"]
    start_urls = ["https://hust.edu.vn/vi/news/rss/"]

    custom_settings = {
        "DOWNLOAD_DELAY": 5,  # thời gian chờ 5 giây
        "RANDOMIZE_DOWNLOAD_DELAY": False,
        "CONCURRENT_REQUESTS": 1,  # request tuần tự
        "FEED_EXPORT_ENCODING": "utf-8",
    }

    def parse(self, response):
        links = response.xpath("//item/link/text()").getall()
        
        for link in links:
            yield scrapy.Request(
                url=link.strip(),
                callback=self.parse_article
            )

    def parse_article(self, response):
        title = response.css('h1[itemprop="headline"]::text').get(default="").strip()
        short = response.css('div#news-bodyhtml strong::text').get(default="").strip()

        yield {
            "title": title,
            "short": short,
            "url": response.url
        }
