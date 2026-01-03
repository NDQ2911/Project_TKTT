// Hàm search, dùng cho search.html
async function search() {
    const query = document.getElementById("query").value.trim();
    if (!query) {
        alert("Vui lòng nhập từ khóa!");
        return;
    }

    try {
        const response = await fetch("http://localhost:3000/search", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ q: query })
        });

        const data = await response.json();
        const resultDiv = document.getElementById("result");
        resultDiv.innerHTML = "";

        if (!data || data.length === 0) {
            resultDiv.innerHTML = "<p>Không tìm thấy kết quả nào.</p>";
            return;
        }

        console.log("Kết quả trả về từ server:", data);

        data.forEach(doc => {
            const div = document.createElement("div");
            div.style.border = "1px solid #ccc";
            div.style.margin = "5px";
            div.style.padding = "5px";

            const title = doc._source["Tiêu đề tin"] || doc._source.title || doc._source["Tiêu đề"] || "Không có tiêu đề";
            const a = document.createElement("a");
            a.href = `job.html?id=${encodeURIComponent(doc._id)}`;
            a.innerText = title;
            a.style.fontWeight = "bold";
            a.style.textDecoration = "none";
            a.style.color = "#333";

            div.appendChild(a);
            resultDiv.appendChild(div);
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
            const response = await fetch("http://localhost:3000/upload", {
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
