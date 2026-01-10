/**
 * Upload routes for file import
 */
const express = require('express');
const router = express.Router();
const multer = require('multer');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const upload = multer({ dest: path.join(__dirname, '../../data/') });

module.exports = function (esHost, indexName, ensureIndex, indexExists) {
    const ES_URL = `${esHost}/${indexName}/_doc`;

    router.post('/', upload.single('file'), async (req, res) => {
        if (!req.file) return res.status(400).json({ error: "Chưa có file" });

        if (!(await indexExists(indexName))) await ensureIndex();

        const filePath = req.file.path;
        let docs = [];

        try {
            if (req.file.originalname.endsWith('.json')) {
                docs = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
            } else {
                return res.status(400).json({ error: "Chỉ nhận JSON" });
            }

            docs = docs.filter(d => d["Id tin"] && d["Tiêu đề tin"]);

            let indexed = 0;
            for (let doc of docs) {
                try {
                    await axios.put(`${ES_URL}/${doc["Id tin"]}`, doc);
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

    return router;
};
