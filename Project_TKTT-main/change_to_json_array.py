import csv
import json
import os

input_file = "data/jobs_clean.csv"
output_file = "data/jobs_array.json"

os.makedirs("data", exist_ok=True)

data_list = []

with open(input_file, mode="r", encoding="utf-8-sig") as infile:
    reader = csv.DictReader(infile)

    for row in reader:
        clean_row = {k.strip(): (v.strip() if v else "") for k, v in row.items()}
        if not any(clean_row.values()):
            continue
        data_list.append(clean_row)

with open(output_file, mode="w", encoding="utf-8") as outfile:
    json.dump(data_list, outfile, ensure_ascii=False, indent=4)

print(f"Đã tạo JSON chuẩn: {output_file}")
