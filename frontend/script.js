// Hàm search, dùng cho search.html
async function search() {
    const query = document.getElementById("query").value.trim();
    if (!query) {
        alert("Vui lòng nhập từ khóa!");
        return;
    }

    try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        if (!response.ok) {
            const text = await response.text();
            throw new Error(text || 'Search failed');
        }

        const data = await response.json();
        const resultDiv = document.getElementById("result");
        resultDiv.innerHTML = "";

        const hits = data.hits || [];
        if (hits.length === 0) {
            resultDiv.innerHTML = "<p>Không tìm thấy kết quả nào.</p>";
            return;
        }

        console.log("Kết quả trả về từ server:", data);

        hits.forEach(h => {
            const src = h.source || {};
            const title = src["Tiêu đề tin"] || src.title || src["Tiêu đề"] || "Không có tiêu đề";
            const salary = src["Mức lương"] || src["Muc luong"] || src.salary || "Thỏa thuận";
            const location = src["Địa điểm tuyển dụng"] || src["Địa điểm"] || src["Tỉnh thành tuyển dụng"] || "Toàn quốc";

            // Tạo link chi tiết (sử dụng id trả về từ API)
            const detailUrl = `job.html?id=${encodeURIComponent(h.id)}`;

            const card = document.createElement("div");
            card.className = "job-card";

            // Thêm sự kiện click cho toàn bộ card
            card.onclick = () => {
                window.location.href = detailUrl;
            };

            card.innerHTML = `
                <div class="card-content">
                    <div class="job-title">${title}</div>
                    <div class="job-info">
                        <div class="job-salary">💰 Lương: ${salary}</div>
                        <div class="job-location">📍 Địa điểm: ${location}</div>
                    </div>
                </div>
            `;

            resultDiv.appendChild(card);
        });

    } catch (err) {
        console.error(err);
        alert("Có lỗi xảy ra khi tìm kiếm!");
    }
} 

// Hàm upload, dùng cho upload.html
document.addEventListener("DOMContentLoaded", () => {
    const uploadForm = document.getElementById("uploadForm");
    const statusDiv = document.getElementById("status");
    if (!uploadForm) return;

    uploadForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const fileInput = document.getElementById("fileInput");
        if (!fileInput.files[0]) {
            statusDiv.innerText = "Vui lòng chọn file trước khi upload!";
            statusDiv.style.color = "red";
            return;
        }

        const file = fileInput.files[0];
        const formData = new FormData();
        formData.append("file", file);

        // Hiển thị trạng thái đang upload
        statusDiv.innerText = `Đang upload file "${file.name}"...`;
        statusDiv.style.color = "black";

        try {
            const response = await fetch("/upload", {
                method: "POST",
                body: formData
            });

            const data = await response.json();

            if (data.status === "ok") {
                statusDiv.innerText = `Upload thành công! Đã thêm ${data.indexed} bản ghi.`;
                statusDiv.style.color = "green";
            } else if (data.error) {
                statusDiv.innerText = `Upload thất bại: ${data.error}`;
                statusDiv.style.color = "red";
            } else {
                statusDiv.innerText = "Upload thất bại: Lỗi không xác định.";
                statusDiv.style.color = "red";
            }
        } catch (err) {
            console.error(err);
            statusDiv.innerText = `Upload thất bại: ${err.message}`;
            statusDiv.style.color = "red";
        }
    });
});
