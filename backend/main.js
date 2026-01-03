const express = require('express');
const multer = require('multer');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;
const ES_INDEX = "docs";
const ES_URL = `http://localhost:9200/${ES_INDEX}/_doc`;
const INDEX_FILE = path.join(__dirname, "index.json"); // file index.json chứa body của lệnh tạo index

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(require('cors')());

// Tạm lưu file upload
const upload = multer({ dest: path.join(__dirname, '../data/') });

// ================= Index =================
async function ensureIndex() {
    try {
        let indexBody = {};
        if (fs.existsSync(INDEX_FILE)) {
            indexBody = JSON.parse(fs.readFileSync(INDEX_FILE, 'utf-8'));
        }

        await axios.put(`http://localhost:9200/${ES_INDEX}`, indexBody);
        console.log(`Index '${ES_INDEX}' đã được tạo hoặc cập nhật từ ${INDEX_FILE}`);
    } catch (err) {
        console.error("Không thể tạo index:", err.message);
    }
}

async function indexExists() {
    try {
        await axios.get(`http://localhost:9200/${ES_INDEX}`);
        return true;
    } catch {
        return false;
    }
}

// Khởi động server
(async () => {
    if (!(await indexExists())) await ensureIndex();
})();

// ================= Upload =================
app.post('/upload', upload.single('file'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: "Chưa có file" });

    if (!(await indexExists())) await ensureIndex();

    const filePath = req.file.path;
    let docs = [];

    try {
        if (req.file.originalname.endsWith('.json')) {
            docs = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        } else {
            return res.status(400).json({ error: "Chỉ nhận JSON" });
        }

        // Lọc và chuẩn hóa dữ liệu
        docs = docs.filter(d => d["Id tin"] && d["Tiêu đề tin"]);

        let indexed = 0;
        for (let doc of docs) {
            try {
                await axios.put(`${ES_URL}/${doc["Id tin"]}`, doc); // _id = Id tin
                indexed++;
            } catch (e) {
                console.error(`Index failed Id tin=${doc["Id tin"]}:`, e.message);
            }
        }

        fs.unlinkSync(filePath);
        res.json({ status: "ok", indexed });
    } catch (err) {
        fs.unlinkSync(filePath);
        res.status(500).json({ error: err.message });
    }
});

// ================= Search =================
app.post("/search", async (req, res) => {
    try {
        const q = req.body.q;
        if (!q) return res.status(400).json({ error: "Missing query" });

        const response = await axios.post(`http://localhost:9200/${ES_INDEX}/_search`, {
            query: {
                multi_match: {
                    query: q,
                    fields: ["Tiêu đề tin^3", "Địa điểm tuyển dụng", "Tỉnh thành tuyển dụng", "Chức vụ", "Ngành nghề", "Lĩnh vực"]
                }
            },
            size: 10
        });

        res.json(response.data.hits.hits);
    } catch (err) {
        console.error(err.response ? err.response.data : err.message);
        res.status(500).json({ error: err.message });
    }
});

// ================= Get Job by ID =================
app.get("/job/:id", async (req, res) => {
    try {
        const id = req.params.id;
        if (!id) return res.status(400).json({ error: "Missing id" });

        const response = await axios.get(`http://localhost:9200/${ES_INDEX}/_doc/${id}`);
        if (!response.data || response.data.found === false) {
            return res.status(404).json({ error: "Not found" });
        }

        // Return the document _source
        res.json(response.data._source);
    } catch (err) {
        console.error(err.response ? err.response.data : err.message);
        // if ES returns 404 it comes here; convert to friendly 404
        if (err.response && err.response.status === 404) {
            return res.status(404).json({ error: "Not found" });
        }
        res.status(500).json({ error: err.message });
    }
});

app.listen(PORT, () => console.log(`Backend running at http://localhost:${PORT}`));
