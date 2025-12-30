import csv
import json
import os

# File nguồn & đích
input_file = "data/jobs_clean.csv"
output_file = "data/jobs.json"

# Đảm bảo folder tồn tại
os.makedirs("data", exist_ok=True)

data_list = []

with open(input_file, mode="r", encoding="utf-8-sig") as infile:
    reader = csv.DictReader(infile)

    for row in reader:
        # Strip tất cả giá trị
        clean_row = {k.strip(): (v.strip() if v else "") for k, v in row.items()}

        # Nếu dòng rỗng thì bỏ qua
        if not any(clean_row.values()):
            continue

        data_list.append(clean_row)

# Ghi JSON ra file — mỗi object trên 1 dòng (ES bulk friendly)
with open(output_file, mode="w", encoding="utf-8") as outfile:
    for obj in data_list:
        json_line = json.dumps(obj, ensure_ascii=False)
        outfile.write(json_line + "\n")

print(f"✅ Đã chuyển {len(data_list)} dòng thành JSON và ghi vào {output_file}")
