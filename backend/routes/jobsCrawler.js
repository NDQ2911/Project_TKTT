/**
 * Routes for crawler jobs data (index: jobs_crawler)
 * Schema: English field names matching domain.Job from Go crawler
 */
const express = require('express');
const router = express.Router();

// Search fields config for crawler data (matching Go domain.Job)
const SEARCH_FIELDS = ["title^3", "company^2", "location", "description", "requirements", "benefits", "skills"];

// Keyword fields available for aggregation
const KEYWORD_FIELDS = {
    "location-city": "location_city",
    "location-district": "location_district",
    "position": "position",
    "work-type": "work_type",
    "industry": "industry",
    "experience": "experience",
    "skills": "skills",
    "source": "source",
    "qualifications": "qualifications"
};

// Helper: format timing
const formatTime = (startTime) => `${Date.now() - startTime}ms`;

module.exports = function (esClient, indexName) {
    // Unified search endpoint (supports pagination, empty query, did-you-mean)
    router.post("/search", async (req, res) => {
        const startTime = Date.now();
        try {
            const q = req.body.q || "";
            const page = parseInt(req.body.page) || 1;
            const size = parseInt(req.body.size) || 10;
            const from = (page - 1) * size;

            // Build query: match_all if empty, otherwise multi_match
            const baseQuery = q.trim()
                ? {
                    multi_match: {
                        query: q,
                        fields: SEARCH_FIELDS
                    }
                }
                : { match_all: {} };

            // Build search request with suggest for did-you-mean
            const searchRequest = {
                index: indexName,
                query: {
                    function_score: {
                        query: baseQuery,
                        functions: [
                            {
                                gauss: {
                                    created_at: {
                                        origin: "now",
                                        scale: "30d",
                                        offset: "7d",
                                        decay: 0.5
                                    }
                                }
                            }
                        ],
                        boost_mode: "sum",
                        score_mode: "sum"
                    }
                },
                from: from,
                size: size,
                explain: true
            };

            // Add phrase suggest if query is not empty (treats query as phrase)
            // Uses title.suggest field with shingle analyzer for Vietnamese support
            if (q.trim()) {
                searchRequest.suggest = {
                    text: q,
                    "did-you-mean": {
                        phrase: {
                            field: "title.suggest",
                            size: 1,
                            gram_size: 2,
                            confidence: 0.5,
                            max_errors: 2,
                            direct_generator: [{
                                field: "title.suggest",
                                suggest_mode: "always",
                                min_word_length: 2
                            }]
                        }
                    }
                };
            }

            const response = await esClient.search(searchRequest);

            // Extract phrase suggestion
            const phraseSuggestions = response.suggest?.["did-you-mean"]?.[0]?.options || [];
            const didYouMean = phraseSuggestions.length > 0 && phraseSuggestions[0].text !== q
                ? phraseSuggestions[0].text
                : null;

            res.json({
                time: formatTime(startTime),
                page: page,
                size: size,
                total: response.hits.total.value,
                hits: response.hits.hits,
                didYouMean: didYouMean
            });
        } catch (err) {
            console.error(err.message);
            res.status(500).json({ error: err.message });
        }
    });

    // Autocomplete endpoint - returns short keyword suggestions (query + next few words)
    router.get("/autocomplete", async (req, res) => {
        try {
            const q = (req.query.q || "").trim().toLowerCase();
            const limit = parseInt(req.query.limit) || 8;

            if (!q || q.length < 2) {
                return res.json({ suggestions: [] });
            }

            // Search titles that start with query
            const response = await esClient.search({
                index: indexName,
                size: 50,
                query: {
                    match_phrase_prefix: {
                        title: {
                            query: q,
                            max_expansions: 20
                        }
                    }
                },
                _source: ["title"]
            });

            // Extract unique short suggestions (query + 1-3 more words)
            const titles = response.hits.hits.map(h => h._source.title);
            const suggestionsSet = new Set();

            for (const title of titles) {
                const lowerTitle = title.toLowerCase();
                const startIdx = lowerTitle.indexOf(q.toLowerCase());
                if (startIdx === -1) continue;

                // Get words after query
                const afterQuery = title.substring(startIdx + q.length).trim();
                const words = afterQuery.split(/\s+/).filter(w => w.length > 0);

                // Create suggestions with 1, 2, 3 more words
                for (let i = 1; i <= Math.min(3, words.length); i++) {
                    const suggestion = q + ' ' + words.slice(0, i).join(' ');
                    suggestionsSet.add(suggestion.trim());
                }

                // Also add full title if short enough
                if (title.length <= 50) {
                    suggestionsSet.add(title);
                }
            }

            const suggestions = [...suggestionsSet].slice(0, limit);

            res.json({
                query: q,
                suggestions: suggestions
            });
        } catch (err) {
            console.error("Autocomplete error:", err.message);
            res.status(500).json({ error: err.message, suggestions: [] });
        }
    });


    // Advanced search with filters
    router.post("/search/advanced", async (req, res) => {
        const startTime = Date.now();
        try {
            const { q, location_city, work_type, experience, source, salary_min, salary_max, page = 1, size = 10 } = req.body;
            const from = (page - 1) * size;

            // Build filter clauses
            const must = [];
            const filter = [];

            if (q) {
                must.push({
                    multi_match: {
                        query: q,
                        fields: SEARCH_FIELDS
                    }
                });
            }

            if (location_city) {
                filter.push({ term: { location_city: location_city } });
            }
            if (work_type) {
                filter.push({ term: { work_type: work_type } });
            }
            if (experience) {
                filter.push({ term: { experience: experience } });
            }
            if (source) {
                filter.push({ term: { source: source } });
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
                from: from,
                size: size,
                sort: [
                    { crawled_at: { order: "desc" } }
                ]
            });

            res.json({
                method: "advanced",
                time: formatTime(startTime),
                page: page,
                size: size,
                total: response.hits.total.value,
                hits: response.hits.hits
            });
        } catch (err) {
            console.error(err.message);
            res.status(500).json({ error: err.message });
        }
    });

    // ================= Get Job by ID =================
    router.get("/job/:id", async (req, res) => {
        const startTime = Date.now();
        try {
            const id = req.params.id;
            if (!id) return res.status(400).json({ error: "Missing id" });

            const response = await esClient.get({
                index: indexName,
                id: id
            });

            if (!response.found) {
                return res.status(404).json({ error: "Not found" });
            }

            res.json({
                time: formatTime(startTime),
                data: response._source
            });
        } catch (err) {
            console.error(err.message);
            if (err.meta && err.meta.statusCode === 404) {
                return res.status(404).json({ error: "Not found" });
            }
            res.status(500).json({ error: err.message });
        }
    });

    // ================= Did You Mean =================
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
                            field: "title",
                            size: 1,
                            gram_size: 2,
                            direct_generator: [{
                                field: "title",
                                suggest_mode: "popular"
                            }]
                        }
                    }
                }
            });

            const suggestions = response.suggest?.["did-you-mean"]?.[0]?.options || [];
            const topSuggestion = suggestions.length > 0 ? suggestions[0].text : null;

            res.json({
                time: formatTime(startTime),
                originalQuery: q,
                suggestion: topSuggestion
            });
        } catch (err) {
            console.error(err.message);
            res.status(500).json({ error: err.message });
        }
    });

    // ================= Aggregations =================

    // Get all aggregations
    router.get("/aggs/all", async (req, res) => {
        const startTime = Date.now();
        try {
            const size = parseInt(req.query.size) || 20;

            const response = await esClient.search({
                index: indexName,
                size: 0,
                aggs: {
                    location_city: {
                        terms: { field: "location_city", size: size }
                    },
                    work_type: {
                        terms: { field: "work_type", size: size }
                    },
                    experience: {
                        terms: { field: "experience", size: size }
                    },
                    industry: {
                        terms: { field: "industry", size: size }
                    },
                    source: {
                        terms: { field: "source", size: size }
                    },
                    skills: {
                        terms: { field: "skills", size: size }
                    },
                    company: {
                        terms: { field: "company.keyword", size: size }
                    },
                    qualifications: {
                        terms: { field: "qualifications", size: size }
                    }
                }
            });

            const aggs = response.aggregations;
            res.json({
                time: formatTime(startTime),
                total_docs: response.hits.total.value,
                aggregations: {
                    location_city: aggs.location_city.buckets,
                    work_type: aggs.work_type.buckets,
                    experience: aggs.experience.buckets,
                    industry: aggs.industry.buckets,
                    source: aggs.source.buckets,
                    skills: aggs.skills.buckets,
                    company: aggs.company.buckets,
                    qualifications: aggs.qualifications.buckets
                }
            });
        } catch (err) {
            console.error(err.message);
            res.status(500).json({ error: err.message });
        }
    });

    // Salary ranges
    router.get("/aggs/salary-ranges", async (req, res) => {
        const startTime = Date.now();
        try {
            const response = await esClient.search({
                index: indexName,
                size: 0,
                aggs: {
                    is_negotiable: {
                        terms: { field: "is_negotiable" }
                    },
                    salary_ranges: {
                        range: {
                            field: "salary_min",
                            ranges: [
                                { key: "Thỏa thuận", from: 0, to: 1 },
                                { key: "Dưới 10 triệu", from: 1, to: 10000000 },
                                { key: "10-20 triệu", from: 10000000, to: 20000000 },
                                { key: "20-30 triệu", from: 20000000, to: 30000000 },
                                { key: "30-50 triệu", from: 30000000, to: 50000000 },
                                { key: "Trên 50 triệu", from: 50000000 }
                            ]
                        }
                    },
                    salary_stats: {
                        stats: { field: "salary_min" }
                    }
                }
            });

            const aggs = response.aggregations;
            res.json({
                time: formatTime(startTime),
                total_docs: response.hits.total.value,
                is_negotiable: aggs.is_negotiable?.buckets || [],
                salary_by_range: aggs.salary_ranges?.buckets || [],
                salary_stats: aggs.salary_stats || null
            });
        } catch (err) {
            console.error(err.message);
            res.status(500).json({ error: err.message });
        }
    });

    // Experience stats
    router.get("/aggs/experience-stats", async (req, res) => {
        const startTime = Date.now();
        try {
            const response = await esClient.search({
                index: indexName,
                size: 0,
                aggs: {
                    by_experience: {
                        terms: { field: "experience", size: 20 }
                    },
                    by_experience_tags: {
                        terms: { field: "experience_tags", size: 20 }
                    }
                }
            });

            const aggs = response.aggregations;
            res.json({
                time: formatTime(startTime),
                total_docs: response.hits.total.value,
                by_experience: aggs.by_experience?.buckets || [],
                by_experience_tags: aggs.by_experience_tags?.buckets || []
            });
        } catch (err) {
            console.error(err.message);
            res.status(500).json({ error: err.message });
        }
    });

    // Source distribution
    router.get("/aggs/sources", async (req, res) => {
        const startTime = Date.now();
        try {
            const response = await esClient.search({
                index: indexName,
                size: 0,
                aggs: {
                    by_source: {
                        terms: { field: "source", size: 10 }
                    },
                    crawl_timeline: {
                        date_histogram: {
                            field: "crawled_at",
                            calendar_interval: "day"
                        }
                    }
                }
            });

            const aggs = response.aggregations;
            res.json({
                time: formatTime(startTime),
                total_docs: response.hits.total.value,
                by_source: aggs.by_source?.buckets || [],
                crawl_timeline: aggs.crawl_timeline?.buckets || []
            });
        } catch (err) {
            console.error(err.message);
            res.status(500).json({ error: err.message });
        }
    });

    // Aggregation for a specific field
    router.get("/aggs/:field", async (req, res) => {
        const startTime = Date.now();
        try {
            const fieldKey = req.params.field;
            const fieldName = KEYWORD_FIELDS[fieldKey];

            if (!fieldName) {
                return res.status(400).json({
                    error: "Invalid field",
                    available: Object.keys(KEYWORD_FIELDS)
                });
            }

            const size = parseInt(req.query.size) || 50;

            const response = await esClient.search({
                index: indexName,
                size: 0,
                aggs: {
                    field_agg: {
                        terms: { field: fieldName, size: size }
                    }
                }
            });

            res.json({
                time: formatTime(startTime),
                field: fieldKey,
                total_docs: response.hits.total.value,
                buckets: response.aggregations.field_agg.buckets
            });
        } catch (err) {
            console.error(err.message);
            res.status(500).json({ error: err.message });
        }
    });

    return router;
};
