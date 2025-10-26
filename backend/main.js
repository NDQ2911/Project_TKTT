const express = require('express');
const multer = require('multer');
const axios = require('axios');
const fs = require('fs');
const csv = require('csv-parser');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = 3000;
const ES_INDEX = "docs";
const ES_URL = `http://localhost:9200/${ES_INDEX}/_doc`;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());

// Tạm lưu file upload
const upload = multer({ dest: path.join(__dirname, '../data/') });

// Tạo index nếu chưa tồn tại
async function ensureIndex() {
    try {
        await axios.put(`http://localhost:9200/${ES_INDEX}`, {
            settings: {
                analysis: {
                    analyzer: {
                        vietnamese_analyzer: {
                            type: "custom",
                            tokenizer: "standard",
                            filter: ["lowercase", "asciifolding"]
                        }
                    }
                }
            },
            mappings: {
                properties: {
                    id: { type: "integer" },
                    title: { type: "text", analyzer: "vietnamese_analyzer" },
                    authors: { type: "text", analyzer: "vietnamese_analyzer" },
                    category: { type: "text", analyzer: "vietnamese_analyzer" },
                    pages: { type: "integer" },
                    manufacturer: { type: "text", analyzer: "vietnamese_analyzer" }
                }
            }
        });
        console.log("Index created");
    } catch (e) {
        // Nếu index đã tồn tại thì ignore
    }
}

// Kiểm tra index đã tồn tại chưa
async function indexExists() {
    try {
        await axios.get(`http://localhost:9200/${ES_INDEX}`);
        return true;
    } catch {
        return false;
    }
}

// Gọi khi khởi động server
ensureIndex();

// ================= Upload =================
app.post('/upload', upload.single('file'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: "Chưa có file" });

    if (!(await indexExists())) await ensureIndex();

    const filePath = req.file.path;
    let docs = [];

    try {
        if (req.file.originalname.endsWith('.csv')) {
            docs = await new Promise((resolve, reject) => {
                const results = [];
                fs.createReadStream(filePath)
                    .pipe(csv())
                    .on('data', data => {
                        if (!data.product_id || !data.title) return; // Bỏ bản ghi thiếu product_id hoặc title
                        if (data.pages) data.pages = parseInt(data.pages);
                        results.push(data);
                    })
                    .on('end', () => resolve(results))
                    .on('error', err => reject(err));
            });
        } else if (req.file.originalname.endsWith('.json')) {
            docs = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
            docs = docs.filter(d => d.product_id && d.title); // Bỏ bản ghi thiếu product_id hoặc title
            docs.forEach(d => {
                if (d.pages) d.pages = parseInt(d.pages);
            });
        } else {
            return res.status(400).json({ error: "Chỉ nhận CSV hoặc JSON" });
        }

        let indexed = 0;
        for (let doc of docs) {
            try {
                await axios.put(`${ES_URL}/${doc.product_id}`, doc); // _id = product_id
                indexed++;
            } catch (e) {
                console.error(`Index failed product_id=${doc.product_id}:`, e.message);
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
                multi_match: { query: q, fields: ["title^3", "authors", "category", "manufacturer"] }
            },
            size: 10
        });

        res.json(response.data.hits.hits);
    } catch (err) {
        console.error(err.response ? err.response.data : err.message);
        res.status(500).json({ error: err.message });
    }
});

app.listen(PORT, () => console.log(`Backend running at http://localhost:${PORT}`));
