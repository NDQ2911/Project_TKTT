const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { Client } = require('@elastic/elasticsearch');
const { seedIfEmpty } = require('./seeder');

const app = express();
const PORT = 3000;

// Elasticsearch configuration
const ES_HOST = process.env.ES_HOST || 'http://localhost:9200';
const ES_INDEX_LEGACY = process.env.ES_INDEX_LEGACY || 'jobs';
const ES_INDEX_CRAWLER = process.env.ES_INDEX_CRAWLER || 'jobs_vieclam24h';
const DATA_PATH = process.env.DATA_PATH || path.join(__dirname, '../data/jobs.json');

// Create Elasticsearch client
const esClient = new Client({ node: ES_HOST });

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(require('cors')());

// Serve frontend static files
app.use(express.static(path.join(__dirname, '..', 'frontend')));

// Upload config
const upload = multer({ dest: path.join(__dirname, '../data/') });

// Import route modules
const legacyRoutes = require('./routes/legacy')(esClient, ES_HOST, ES_INDEX_LEGACY);
const crawlerRoutes = require('./routes/jobsCrawler')(esClient, ES_INDEX_CRAWLER);
const combinedRoutes = require('./routes/combined')(esClient, { legacy: ES_INDEX_LEGACY, crawler: ES_INDEX_CRAWLER });

// Mount routes
app.use('/api/legacy', legacyRoutes);
app.use('/api/crawler', crawlerRoutes);
app.use('/api', combinedRoutes);

// Health check
app.get('/api/health', async (req, res) => {
    try {
        const health = await esClient.cluster.health();
        res.json({ status: 'ok', elasticsearch: health.status });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

// Legacy backwards compatibility routes
app.get("/api/search", async (req, res) => {
    try {
        const q = req.query.q;
        if (!q) return res.status(400).json({ error: "Missing query" });

        const page = Math.max(1, parseInt(req.query.page) || 1);
        const size = Math.min(50, parseInt(req.query.size) || 10);
        const from = (page - 1) * size;

        const response = await esClient.search({
            index: ES_INDEX_LEGACY,
            query: {
                multi_match: {
                    query: q,
                    fields: ["Tiêu đề tin^3", "Địa điểm tuyển dụng", "Tỉnh thành tuyển dụng", "Chức vụ", "Ngành nghề", "Lĩnh vực"]
                }
            },
            from, size,
            highlight: { fields: { "Tiêu đề tin": {}, "Mô tả": {} } }
        });

        res.json({
            total: response.hits.total?.value || 0,
            hits: response.hits.hits.map(h => ({ id: h._id, score: h._score, source: h._source, highlight: h.highlight }))
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: err.message });
    }
});

// Root redirect
app.get('/', (req, res) => {
    return res.redirect('/search-multi.html');
});

// Start server
app.listen(PORT, '0.0.0.0', async () => {
    console.log(`✅ Backend running at http://0.0.0.0:${PORT}`);
    console.log(`📁 Legacy index: ${ES_INDEX_LEGACY}`);
    console.log(`🤖 Crawler index: ${ES_INDEX_CRAWLER}`);
    console.log(`🔗 Elasticsearch: ${ES_HOST}`);

    // Auto-seed legacy index if empty
    try {
        await seedIfEmpty(esClient, ES_INDEX_LEGACY, DATA_PATH);
    } catch (err) {
        console.error('[Seeder] Auto-seed failed:', err.message);
    }
});
