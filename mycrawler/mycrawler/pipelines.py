import sqlite3
import hashlib
from datetime import datetime
from scrapy.exceptions import DropItem

# --- PIPELINE CHO HUSTEDU (Lưu vào data.db) ---
class MycrawlerPipeline:
    def __init__(self):
        self.con = sqlite3.connect('data.db') # HUSTEDU -> data.db
        self.cur = self.con.cursor()
        self.cur.execute("PRAGMA journal_mode=WAL;")
        self.create_table()

    def create_table(self):
        self.cur.execute("""
            CREATE TABLE IF NOT EXISTS news (
                url TEXT PRIMARY KEY,
                title TEXT,
                short TEXT,
                content_hash TEXT,
                last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                last_checked TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        self.con.commit()

    def process_item(self, item, spider):
        # Chỉ xử lý nếu spider là hustedu
        if spider.name != "hustedu":
            return item

        content_str = (item['title'] + item['short']).encode('utf-8')
        content_hash = hashlib.md5(content_str).hexdigest()
        current_time = datetime.now()

        self.cur.execute("SELECT content_hash FROM news WHERE url = ?", (item['url'],))
        row = self.cur.fetchone()

        if row is None:
            print(f"--> [NEW] 🔥 Thêm mới: {item['title'][:30]}...")
            self.cur.execute("""
                INSERT INTO news (url, title, short, content_hash, last_updated, last_checked) 
                VALUES (?, ?, ?, ?, ?, ?)
            """, (item['url'], item['title'], item['short'], content_hash, current_time, current_time))
            self.con.commit()
        else:
            db_hash = row[0]
            if db_hash != content_hash:
                print(f"--> [UPDATE] ♻️ Có sửa đổi: {item['title'][:30]}...")
                self.cur.execute("""
                    UPDATE news 
                    SET title = ?, short = ?, content_hash = ?, last_updated = ?, last_checked = ?
                    WHERE url = ?
                """, (item['title'], item['short'], content_hash, current_time, current_time, item['url']))
            else:
                self.cur.execute("UPDATE news SET last_checked = ? WHERE url = ?", (current_time, item['url']))
            self.con.commit()
        return item

    def close_spider(self, spider):
        if spider.name == "hustedu":
            self.con.close()


# --- PIPELINE CHO CAREERLINK (Lưu vào data1.db) ---
class CareerlinkPipeline:
    def open_spider(self, spider):
        if spider.name != "careerlink":
            return
            
        self.con = sqlite3.connect('data1.db') # CAREERLINK -> data1.db
        self.cur = self.con.cursor()
        
        self.cur.execute("""
            CREATE TABLE IF NOT EXISTS jobs (
                url TEXT PRIMARY KEY,
                title TEXT,
                company TEXT,
                location TEXT,
                salary TEXT,
                experience TEXT,
                content_hash TEXT,
                last_checked TIMESTAMP,
                last_updated TIMESTAMP
            )
        """)
        self.con.commit()

    def close_spider(self, spider):
        if spider.name == "careerlink":
            self.con.close()

    def process_item(self, item, spider):
        if spider.name != "careerlink":
            return item

        content_str = f"{item['title']}{item['company']}{item['salary']}{item['location']}"
        content_hash = hashlib.md5(content_str.encode('utf-8')).hexdigest()
        now = datetime.now()

        self.cur.execute("SELECT content_hash FROM jobs WHERE url = ?", (item['url'],))
        row = self.cur.fetchone()

        if row is None:
            print(f"--> [NEW JOB] 🆕 {item['title']} ({item['company']})")
            self.cur.execute("""
                INSERT INTO jobs (url, title, company, location, salary, experience, content_hash, last_checked, last_updated)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (item['url'], item['title'], item['company'], item['location'], item['salary'], item['experience'], content_hash, now, now))
        else:
            old_hash = row[0]
            if old_hash != content_hash:
                print(f"--> [UPDATE] ♻️ Job thay đổi thông tin: {item['title']}")
                self.cur.execute("""
                    UPDATE jobs 
                    SET title=?, company=?, location=?, salary=?, experience=?, content_hash=?, last_checked=?, last_updated=?
                    WHERE url=?
                """, (item['title'], item['company'], item['location'], item['salary'], item['experience'], content_hash, now, now, item['url']))
            else:
                self.cur.execute("UPDATE jobs SET last_checked = ? WHERE url = ?", (now, item['url']))

        self.con.commit()
        return item