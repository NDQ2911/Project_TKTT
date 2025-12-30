import csv
import os

source_file = "jobdata.csv"
output_folder = "data"
output_file = os.path.join(output_folder, "jobs_clean.csv")

os.makedirs(output_folder, exist_ok=True)

# Danh sách các cột bạn muốn giữ (sau khi strip khoảng trắng)
fields_needed = [
    "Id tin",
    "Tiêu đề tin",
    "Địa điểm tuyển dụng",
    "Tỉnh thành tuyển dụng",
    "Chức vụ",
    "Mức lương",
    "Hình thức làm việc",
    "Ngành nghề",
    "Lĩnh vực",
    "Kinh nghiệm"
]

with open(source_file, mode="r", encoding="utf-8-sig", newline="") as infile, \
     open(output_file, mode="w", encoding="utf-8-sig", newline="") as outfile:

    reader = csv.DictReader(infile)

    # Chuẩn hóa tên header: strip() bỏ khoảng trắng
    normalized_fieldnames = [col.strip() for col in reader.fieldnames]

    writer = csv.DictWriter(outfile, fieldnames=fields_needed)
    writer.writeheader()

    count_in = 0
    count_out = 0

    for row in reader:
        count_in += 1

        # Tạo row đã strip key
        clean_row = {k.strip(): v.strip() if v else "" for k, v in row.items()}

        # Lấy dữ liệu theo các cột cần thiết
        filtered = {field: clean_row.get(field, "") for field in fields_needed}

        # Điều kiện: TẤT CẢ các cột phải có dữ liệu (không trống)
        if all(filtered.values()):
            writer.writerow(filtered)
            count_out += 1

    print(f"Đã đọc {count_in} dòng, ghi {count_out} dòng hợp lệ vào {output_file}")
