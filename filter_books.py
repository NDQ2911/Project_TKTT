import csv
import json
import os

# Đường dẫn file nguồn và đích
source_file = "book_data.csv"
output_folder = "data"
output_file = os.path.join(output_folder, "dataset.json")

# Tạo folder data nếu chưa có
os.makedirs(output_folder, exist_ok=True)

# Các cột cần lấy
fields_to_keep = ["product_id", "title", "authors", "category", "pages", "manufacturer"]

data = []
count_in = 0
count_out = 0

# Đọc file CSV và lọc dữ liệu
with open(source_file, mode="r", encoding="utf-8-sig", newline="") as infile:
    reader = csv.DictReader(infile)

    for row in reader:
        count_in += 1
        filtered_row = {k: (row.get(k, "").strip() if row.get(k) else "") for k in fields_to_keep}

        # Bỏ qua dòng thiếu product_id hoặc title
        if filtered_row["product_id"] and filtered_row["title"]:
            # Chuyển pages sang số (nếu có)
            if filtered_row["pages"].isdigit():
                filtered_row["pages"] = int(filtered_row["pages"])
            else:
                filtered_row["pages"] = None

            data.append(filtered_row)
            count_out += 1

# Ghi ra file JSON, mỗi object 1 dòng
with open(output_file, mode="w", encoding="utf-8") as outfile:
    json.dump(data, outfile, ensure_ascii=False, indent=2)

print(f"✅ Đã đọc {count_in} dòng, ghi {count_out} dòng hợp lệ vào {output_file}")
