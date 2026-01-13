/**
 * Backward compatibility routes for legacy endpoints
 * These routes maintain the old API structure that frontend is using
 */
const express = require('express');
const router = express.Router();
const axios = require('axios');

const SEARCH_FIELDS = ["Tiêu đề tin^3", "Địa điểm tuyển dụng", "Tỉnh thành tuyển dụng", "Chức vụ", "Ngành nghề", "Lĩnh vực"];

const KEYWORD_FIELDS = {
    "tinh-thanh": "Tỉnh thành tuyển dụng.keyword",
    "chuc-vu": "Chức vụ.keyword",
    "hinh-thuc": "Hình thức làm việc.keyword",
    "kinh-nghiem": "Kinh nghiệm.keyword",
    "nganh-nghe": "Ngành nghề.keyword"
};

const formatTime = (startTime) => `${Date.now() - startTime}ms`;

module.exports = function (esClient, esHost, indexName) {
    // Unified search endpoint (supports pagination, empty query, hybrid search)
    router.post("/search", async (req, res) => {
        const startTime = Date.now();
        try {
            const q = req.body.q || "";
            const page = parseInt(req.body.page) || 1;
            const size = parseInt(req.body.size) || 10;
            const from = (page - 1) * size;

            // Build query: match_all if empty, otherwise hybrid (BM25 + fuzzy)
            const baseQuery = q.trim()
                ? {
                    bool: {
                        should: [
                            { multi_match: { query: q, fields: SEARCH_FIELDS, boost: 0.8 } },
                            { multi_match: { query: q, fields: SEARCH_FIELDS, fuzziness: "AUTO", boost: 0.2 } }
                        ]
                    }
                }
                : { match_all: {} };

            const response = await esClient.search({
                index: indexName,
                query: baseQuery,
                from, size, explain: true
            });

            res.json({
                time: formatTime(startTime), page, size,
                total: response.hits.total.value, hits: response.hits.hits
            });
        } catch (err) {
            console.error(err.message);
            res.status(500).json({ error: err.message });
        }
    });

    // Advanced search with filters
    router.post("/search/advanced", async (req, res) => {
        const startTime = Date.now();
        try {
            const { q, tinh_thanh, hinh_thuc, kinh_nghiem, salary_min, salary_max, page = 1, size = 10 } = req.body;
            const from = (page - 1) * size;

            // Build filter clauses
            const must = [];
            const filter = [];

            if (q && q.trim()) {
                must.push({
                    bool: {
                        should: [
                            { multi_match: { query: q, fields: SEARCH_FIELDS, boost: 0.8 } },
                            { multi_match: { query: q, fields: SEARCH_FIELDS, fuzziness: "AUTO", boost: 0.2 } }
                        ]
                    }
                });
            }

            if (tinh_thanh) {
                filter.push({ term: { "Tỉnh thành tuyển dụng.keyword": tinh_thanh } });
            }
            if (hinh_thuc) {
                filter.push({ term: { "Hình thức làm việc.keyword": hinh_thuc } });
            }
            if (kinh_nghiem) {
                filter.push({ term: { "Kinh nghiệm.keyword": kinh_nghiem } });
            }
            if (salary_min !== undefined) {
                filter.push({ range: { salary_min: { gte: salary_min } } });
            }
            if (salary_max !== undefined) {
                filter.push({ range: { salary_max: { lte: salary_max } } });
            }

            const response = await esClient.search({
                index: indexName,
                query: {
                    bool: {
                        must: must.length > 0 ? must : [{ match_all: {} }],
                        filter: filter
                    }
                },
                from, size
            });

            res.json({
                time: formatTime(startTime), page, size,
                total: response.hits.total.value, hits: response.hits.hits
            });
        } catch (err) {
            console.error(err.message);
            res.status(500).json({ error: err.message });
        }
    });

    // Get Job by ID
    router.get("/job/:id", async (req, res) => {
        const startTime = Date.now();
        try {
            const id = req.params.id;
            if (!id) return res.status(400).json({ error: "Missing id" });

            const response = await axios.get(`${esHost}/${indexName}/_doc/${id}`);
            if (!response.data || response.data.found === false) {
                return res.status(404).json({ error: "Not found" });
            }

            res.json({ method: "http", time: formatTime(startTime), data: response.data._source });
        } catch (err) {
            if (err.response && err.response.status === 404) {
                return res.status(404).json({ error: "Not found" });
            }
            res.status(500).json({ error: err.message });
        }
    });

    // Autocomplete
    router.get("/autocomplete", async (req, res) => {
        const startTime = Date.now();
        try {
            const q = req.query.q;
            if (!q || q.length < 2) return res.json({ suggestions: [] });

            const response = await esClient.search({
                index: indexName,
                query: { match_phrase_prefix: { "Tiêu đề tin": { query: q, max_expansions: 10 } } },
                size: 5,
                _source: ["Tiêu đề tin"]
            });

            const suggestions = response.hits.hits.map(hit => ({
                id: hit._id,
                title: hit._source["Tiêu đề tin"]
            }));

            res.json({ time: formatTime(startTime), suggestions: [...new Map(suggestions.map(s => [s.title, s])).values()] });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // Did You Mean
    router.post("/suggest", async (req, res) => {
        const startTime = Date.now();
        try {
            const q = req.body.q;
            if (!q) return res.json({ suggestion: null });

            const response = await esClient.search({
                index: indexName,
                suggest: {
                    text: q,
                    "did-you-mean": {
                        phrase: {
                            field: "Tiêu đề tin", size: 1, gram_size: 2,
                            direct_generator: [{ field: "Tiêu đề tin", suggest_mode: "popular" }]
                        }
                    }
                }
            });

            const suggestions = response.suggest?.["did-you-mean"]?.[0]?.options || [];
            res.json({
                time: formatTime(startTime),
                originalQuery: q,
                suggestion: suggestions.length > 0 ? suggestions[0].text : null
            });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // Aggregations
    router.get("/aggs/all", async (req, res) => {
        const startTime = Date.now();
        try {
            const size = parseInt(req.query.size) || 20;
            const response = await esClient.search({
                index: indexName, size: 0,
                aggs: {
                    tinh_thanh: { terms: { field: "Tỉnh thành tuyển dụng.keyword", size } },
                    chuc_vu: { terms: { field: "Chức vụ.keyword", size } },
                    hinh_thuc: { terms: { field: "Hình thức làm việc.keyword", size } },
                    kinh_nghiem: { terms: { field: "Kinh nghiệm.keyword", size } },
                    nganh_nghe: { terms: { field: "Ngành nghề.keyword", size } }
                }
            });

            const aggs = response.aggregations;
            res.json({
                time: formatTime(startTime), total_docs: response.hits.total.value,
                aggregations: {
                    tinh_thanh: aggs.tinh_thanh.buckets, chuc_vu: aggs.chuc_vu.buckets,
                    hinh_thuc: aggs.hinh_thuc.buckets, kinh_nghiem: aggs.kinh_nghiem.buckets,
                    nganh_nghe: aggs.nganh_nghe.buckets
                }
            });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    router.get("/aggs/salary-ranges", async (req, res) => {
        const startTime = Date.now();
        try {
            const response = await esClient.search({
                index: indexName, size: 0,
                aggs: {
                    salary_text: { terms: { field: "Mức lương.keyword", size: 20 } },
                    salary_ranges: {
                        range: {
                            field: "salary_min", ranges: [
                                { key: "Thỏa thuận", from: 0, to: 1 },
                                { key: "Dưới 7 triệu", from: 1, to: 7 },
                                { key: "7-10 triệu", from: 7, to: 10 },
                                { key: "10-15 triệu", from: 10, to: 15 },
                                { key: "15-20 triệu", from: 15, to: 20 },
                                { key: "20-30 triệu", from: 20, to: 30 },
                                { key: "Trên 30 triệu", from: 30 }
                            ]
                        }
                    },
                    salary_stats: { stats: { field: "salary_min" } }
                }
            });

            const aggs = response.aggregations;
            res.json({
                time: formatTime(startTime), total_docs: response.hits.total.value,
                salary_by_text: aggs.salary_text?.buckets || [],
                salary_by_range: aggs.salary_ranges?.buckets || [],
                salary_stats: aggs.salary_stats || null
            });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    router.get("/aggs/experience-stats", async (req, res) => {
        const startTime = Date.now();
        try {
            const response = await esClient.search({
                index: indexName, size: 0,
                aggs: {
                    by_experience: { terms: { field: "Kinh nghiệm.keyword", size: 20 } },
                    experience_ranges: {
                        range: {
                            field: "experience_min", ranges: [
                                { key: "Không yêu cầu (0)", from: 0, to: 1 },
                                { key: "Fresher (0-1)", from: 0, to: 2 },
                                { key: "Junior (1-2)", from: 1, to: 3 },
                                { key: "Middle (2-5)", from: 2, to: 6 },
                                { key: "Senior (5-10)", from: 5, to: 11 },
                                { key: "Expert (10+)", from: 10 }
                            ]
                        }
                    }
                }
            });

            const aggs = response.aggregations;
            res.json({
                time: formatTime(startTime), total_docs: response.hits.total.value,
                by_experience_text: aggs.by_experience?.buckets || [],
                by_experience_range: aggs.experience_ranges?.buckets || []
            });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    router.get("/aggs/:field", async (req, res) => {
        const startTime = Date.now();
        try {
            const fieldKey = req.params.field;
            const fieldName = KEYWORD_FIELDS[fieldKey];
            if (!fieldName) {
                return res.status(400).json({ error: "Invalid field", available: Object.keys(KEYWORD_FIELDS) });
            }

            const size = parseInt(req.query.size) || 50;
            const response = await esClient.search({
                index: indexName, size: 0,
                aggs: { field_agg: { terms: { field: fieldName, size } } }
            });

            res.json({
                time: formatTime(startTime), field: fieldKey,
                total_docs: response.hits.total.value,
                buckets: response.aggregations.field_agg.buckets
            });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    return router;
};
