const express = require('express');
const multer = require('multer');
const axios = require('axios');
const fs = require('fs');
const csv = require('csv-parser');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = 3000;
const ES_URL = "http://localhost:9200/docs/_doc";

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors()); // cho phép frontend fetch

// Lưu tạm file upload
const upload = multer({ dest: path.join(__dirname, '../data/') });

async function ensureIndex() {
    try {
        await axios.put("http://localhost:9200/docs", {
            mappings: {
                properties: {
                    id: { type: "integer" },
                    title: { type: "text" },
                    content: { type: "text" }
                }
            }
        });
    } catch (e) {
        // Nếu index đã tồn tại thì ignore lỗi
    }
}

// Hàm kiểm tra index docs đã tồn tại chưa
async function indexExists() {
    try {
        await axios.get("http://localhost:9200/docs");
        return true;
    } catch (e) {
        return false;
    }
}

// Gọi hàm này khi khởi động server
ensureIndex();

// ================= Upload dữ liệu =================
app.post('/upload', upload.single('file'), async (req, res) => {
    // Kiểm tra index docs, nếu chưa có thì tạo
    if (!(await indexExists())) {
        await ensureIndex();
    }

    if (!req.file) return res.status(400).json({ error: "Chưa có file" });

    const filePath = req.file.path;
    let docs = [];

    try {
        if (req.file.originalname.endsWith('.csv')) {
            // Đọc file CSV thành mảng docs bằng Promise
            const readCSV = () => new Promise((resolve, reject) => {
                const docs = [];
                fs.createReadStream(filePath)
                    .pipe(csv())
                    .on('data', data => docs.push(data))
                    .on('end', () => resolve(docs))
                    .on('error', err => reject(err));
            });

            try {
                docs = await readCSV();
                let indexed = 0;
                for (let doc of docs) {
                    try {
                        const check = await axios.get(`${ES_URL}/${doc.id}`);
                        if (check.data.found) continue; // Nếu id đã tồn tại thì bỏ qua
                    } catch (e) {
                        // Nếu không tìm thấy thì sẽ index
                    }
                    await axios.put(`${ES_URL}/${doc.id}`, doc); // dùng PUT thay vì POST
                    indexed++;
                }
                fs.unlinkSync(filePath);
                res.json({ status: "ok", indexed });
            } catch (err) {
                fs.unlinkSync(filePath);
                res.status(500).json({ error: err.message });
            }
        } else if (req.file.originalname.endsWith('.json')) {
            const content = fs.readFileSync(filePath, 'utf-8');
            docs = JSON.parse(content);
            let indexed = 0;
            for (let doc of docs) {
                // Kiểm tra id đã tồn tại chưa
                try {
                    const check = await axios.get(`${ES_URL}/${doc.id}`);
                    // Nếu tìm thấy, bỏ qua
                    if (check.data.found) continue;
                } catch (e) {
                    // Nếu không tìm thấy, sẽ index
                }
                await axios.put(`${ES_URL}/${doc.id}`, doc); // dùng PUT thay vì POST
                indexed++;
            }
            fs.unlinkSync(filePath);
            res.json({ status: "ok", indexed });
        } else {
            fs.unlinkSync(filePath);
            res.status(400).json({ error: "Chỉ nhận CSV hoặc JSON" });
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// ================= Search =================
app.post("/search", async (req, res) => {
    try {
        const q = req.body.q;
        if (!q) return res.status(400).json({ error: "Missing query" });

        const response = await axios.post("http://localhost:9200/docs/_search", {
            query: {
                multi_match: {
                    query: q,
                    fields: ["title", "content"]
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

// ================= Run server =================
app.listen(PORT, () => console.log(`Backend running at http://localhost:${PORT}`));
