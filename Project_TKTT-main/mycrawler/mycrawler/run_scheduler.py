import time
import subprocess
import sys
import sqlite3
import json
from datetime import datetime
import os

# Hàm xuất tin tức (HustEdu) - Lấy từ data.db
def export_news_to_json():
    db_path = 'data.db' # <--- SỬA LẠI THÀNH data.db
    json_path = 'news.json'
    if not os.path.exists(db_path): 
        # print("⚠️ Chưa có data.db (Tin tức)") 
        return
    try:
        con = sqlite3.connect(db_path)
        con.row_factory = sqlite3.Row 
        cur = con.cursor()
        cur.execute("SELECT * FROM news ORDER BY last_updated DESC")
        data = [dict(row) for row in cur.fetchall()]
        with open(json_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=4)
        print(f"✅ [NEWS] Đã xuất {len(data)} tin tức ra 'news.json'")
        con.close()
    except Exception: pass

# Hàm xuất việc làm (CareerLink) - Lấy từ data1.db
def export_jobs_to_json():
    db_path = 'data1.db' # CareerLink dùng data1.db -> Đúng
    json_path = 'jobs.json'
    if not os.path.exists(db_path): 
        print("⚠️ Chưa có data1.db (Việc làm)")
        return
    try:
        con = sqlite3.connect(db_path)
        con.row_factory = sqlite3.Row 
        cur = con.cursor()
        
        cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='jobs';")
        if cur.fetchone():
            cur.execute("SELECT * FROM jobs ORDER BY last_updated DESC")
            data = [dict(row) for row in cur.fetchall()]
            with open(json_path, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=4)
            print(f"✅ [JOBS] Đã xuất {len(data)} việc làm ra 'jobs.json'")
        con.close()
    except Exception as e: 
        print(f"❌ Lỗi xuất Jobs: {e}")

def run_crawler():
    print(f"\n[{datetime.now()}] ➤ Chạy Crawler CareerLink ...")
    
    # Chạy careerlink (lưu vào data1.db)
    command = [sys.executable, "-m", "scrapy", "crawl", "careerlink"]
    subprocess.run(command)
    
    print("➤ Đang đồng bộ dữ liệu sang JSON...")
    # export_news_to_json() # Bỏ comment nếu muốn xuất cả tin tức (cần data.db có sẵn)
    export_jobs_to_json()   # Xuất việc làm từ data1.db

if __name__ == "__main__":
    SLEEP_TIME = 60 
    while True:
        run_crawler()
        print(f"Đang nghỉ {SLEEP_TIME} giây...")
        print("="*60)
        time.sleep(SLEEP_TIME)