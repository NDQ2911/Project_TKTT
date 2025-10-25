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

        data.forEach(doc => {
            const div = document.createElement("div");
            div.style.border = "1px solid #ccc";
            div.style.margin = "5px";
            div.style.padding = "5px";
            div.innerHTML = `<strong>${doc._source.title}</strong><br>${doc._source.content}`;
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
    if (!uploadForm) return;

    uploadForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const fileInput = document.getElementById("fileInput");
        if (!fileInput.files[0]) {
            alert("Chọn file trước khi upload!");
            return;
        }

        const formData = new FormData();
        formData.append("file", fileInput.files[0]);

        try {
            const response = await fetch("http://localhost:3000/upload", {
                method: "POST",
                body: formData
            });
            const data = await response.json();
            document.getElementById("status").innerText = data.status ? `Indexed ${data.indexed} docs` : data.error;
        } catch (err) {
            console.error(err);
            alert("Có lỗi xảy ra khi upload!");
        }
    });
});
