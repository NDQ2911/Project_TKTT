/**
 * Combined API routes for searching across multiple indexes
 */
const express = require('express');
const router = express.Router();

const formatTime = (startTime) => `${Date.now() - startTime}ms`;

module.exports = function (esClient, indexes) {
    const { legacy: ES_INDEX_LEGACY, crawler: ES_INDEX_CRAWLER } = indexes;

    // Combined search (both indexes)
    router.post('/search/all', async (req, res) => {
        const startTime = Date.now();
        try {
            const q = req.body.q;
            const page = parseInt(req.body.page) || 1;
            const size = parseInt(req.body.size) || 10;
            const from = (page - 1) * size;
            if (!q) return res.status(400).json({ error: "Missing query" });

            const [legacyResult, crawlerResult] = await Promise.all([
                esClient.search({
                    index: ES_INDEX_LEGACY,
                    query: {
                        multi_match: {
                            query: q,
                            fields: ["Tiêu đề tin^3", "Địa điểm tuyển dụng", "Tỉnh thành tuyển dụng", "Chức vụ", "Ngành nghề", "Lĩnh vực"]
                        }
                    },
                    from, size
                }).catch(err => ({ hits: { total: { value: 0 }, hits: [] }, error: err.message })),

                esClient.search({
                    index: ES_INDEX_CRAWLER,
                    query: {
                        multi_match: {
                            query: q,
                            fields: ["title^3", "company^2", "location", "description", "requirements", "skills"]
                        }
                    },
                    from, size
                }).catch(err => ({ hits: { total: { value: 0 }, hits: [] }, error: err.message }))
            ]);

            res.json({
                time: formatTime(startTime),
                page, size,
                legacy: {
                    index: ES_INDEX_LEGACY,
                    total: legacyResult.hits?.total?.value || 0,
                    hits: legacyResult.hits?.hits || [],
                    error: legacyResult.error
                },
                crawler: {
                    index: ES_INDEX_CRAWLER,
                    total: crawlerResult.hits?.total?.value || 0,
                    hits: crawlerResult.hits?.hits || [],
                    error: crawlerResult.error
                }
            });
        } catch (err) {
            console.error(err.message);
            res.status(500).json({ error: err.message });
        }
    });

    // Stats endpoint
    router.get('/stats', async (req, res) => {
        const startTime = Date.now();
        try {
            const [legacyCount, crawlerCount] = await Promise.all([
                esClient.count({ index: ES_INDEX_LEGACY }).catch(() => ({ count: 0 })),
                esClient.count({ index: ES_INDEX_CRAWLER }).catch(() => ({ count: 0 }))
            ]);

            res.json({
                time: formatTime(startTime),
                indexes: {
                    legacy: { name: ES_INDEX_LEGACY, count: legacyCount.count, endpoint: '/api/legacy' },
                    crawler: { name: ES_INDEX_CRAWLER, count: crawlerCount.count, endpoint: '/api/crawler' }
                },
                total: legacyCount.count + crawlerCount.count
            });
        } catch (err) {
            console.error(err.message);
            res.status(500).json({ error: err.message });
        }
    });

    return router;
};
