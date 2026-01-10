/**
 * Data Seeder Module
 * - Processes raw job data before indexing
 * - Seeds data into Elasticsearch when index is empty
 */

const fs = require('fs');
const path = require('path');

// ==================== Data Processing Functions ====================

/**
 * Experience mapping to tags (Inverted Index approach)
 * A=0, B=0-1, C=1-2, D=2-3, E=3-5, F=5+
 * Higher experience profiles can apply to lower requirement jobs
 */
const EXPERIENCE_MAP = {
    "Không yêu cầu": ["A", "B", "C", "D", "E", "F"],
    "Chưa có kinh nghiệm": ["A", "B", "C", "D", "E", "F"],
    "0 - 1 năm kinh nghiệm": ["B", "C", "D", "E", "F"],
    "Dưới 1 năm": ["B", "C", "D", "E", "F"],
    "1 năm": ["C", "D", "E", "F"],
    "1 - 2 năm kinh nghiệm": ["C", "D", "E", "F"],
    "2 năm": ["D", "E", "F"],
    "2 - 3 năm kinh nghiệm": ["D", "E", "F"],
    "3 năm": ["E", "F"],
    "3 - 5 năm kinh nghiệm": ["E", "F"],
    "2 - 5 năm kinh nghiệm": ["E", "F"],
    "5 năm": ["E", "F"],
    "5 - 10 năm kinh nghiệm": ["F"],
    "Hơn 5 năm": ["F"],
    "Trên 5 năm": ["F"],
    "Hơn 10 năm kinh nghiệm": ["F"],
    "Trên 10 năm kinh nghiệm": ["F"]
};

/**
 * Parse experience string to tags and numeric values
 * @param {string} expString - Experience string like "2 - 5 năm kinh nghiệm"
 * @returns {Object} { tags: string[], min: number, max: number }
 */
function parseExperience(expString) {
    if (!expString) {
        return { tags: ["A", "B", "C", "D", "E", "F"], min: 0, max: 99 };
    }

    // Map to tags using predefined mapping
    const tags = EXPERIENCE_MAP[expString] || ["A", "B", "C", "D", "E", "F"];

    // Parse numeric values
    if (expString === "Không yêu cầu") {
        return { tags, min: 0, max: 99 };
    }

    const match = expString.match(/(\d+)\s*-\s*(\d+)/);
    if (match) {
        return { tags, min: parseInt(match[1]), max: parseInt(match[2]) };
    }

    const singleMatch = expString.match(/(\d+)/);
    if (singleMatch) {
        return { tags, min: parseInt(singleMatch[1]), max: 99 };
    }

    return { tags, min: 0, max: 99 };
}

/**
 * Parse salary string to numeric min/max values
 * @param {string} salaryString - Salary string like "10 - 15 triệu"
 * @returns {Object} { min: number, max: number }
 */
function parseSalary(salaryString) {
    if (!salaryString || salaryString === "Thỏa thuận") {
        return { min: 0, max: 999 };
    }

    // Handle range: "10 - 15 triệu"
    const rangeMatch = salaryString.match(/(\d+)\s*-\s*(\d+)/);
    if (rangeMatch) {
        return {
            min: parseInt(rangeMatch[1]),
            max: parseInt(rangeMatch[2])
        };
    }

    // Handle "Trên X triệu"
    const aboveMatch = salaryString.match(/[Tt]rên\s*(\d+)/);
    if (aboveMatch) {
        return { min: parseInt(aboveMatch[1]), max: 999 };
    }

    // Handle "Dưới X triệu"
    const belowMatch = salaryString.match(/[Dd]ưới\s*(\d+)/);
    if (belowMatch) {
        return { min: 0, max: parseInt(belowMatch[1]) };
    }

    return { min: 0, max: 999 };
}

/**
 * Process a single job document - add computed fields
 * @param {Object} doc - Raw job document
 * @returns {Object} Processed document with additional fields
 */
function processDocument(doc) {
    const salary = parseSalary(doc["Mức lương"]);
    const experience = parseExperience(doc["Kinh nghiệm"]);

    return {
        ...doc,
        salary_min: salary.min,
        salary_max: salary.max,
        experience_min: experience.min,
        experience_max: experience.max,
        experience_tags: experience.tags
    };
}

/**
 * Process all documents in an array
 * @param {Array} docs - Array of raw job documents
 * @returns {Array} Array of processed documents
 */
function processDocuments(docs) {
    return docs.map(processDocument);
}

// ==================== Seeding Functions ====================

/**
 * Load job data from file
 * Supports both JSON array and JSON Lines (NDJSON) format
 * @param {string} dataPath - Path to JSON data file
 * @returns {Array} Array of job documents
 */
function loadData(dataPath) {
    const fullPath = path.resolve(dataPath);
    if (!fs.existsSync(fullPath)) {
        console.error(`Data file not found: ${fullPath}`);
        return [];
    }

    const raw = fs.readFileSync(fullPath, 'utf-8');

    // Try parsing as regular JSON first
    try {
        const data = JSON.parse(raw);
        // Handle both array and object with docs array
        return Array.isArray(data) ? data : (data.docs || []);
    } catch (e) {
        // Try parsing as JSON Lines (one JSON per line)
        console.log('[Seeder] Parsing as JSON Lines format...');
        const lines = raw.split('\n').filter(line => line.trim());
        const docs = [];
        for (const line of lines) {
            try {
                docs.push(JSON.parse(line));
            } catch (lineErr) {
                // Skip invalid lines
            }
        }
        console.log(`[Seeder] Parsed ${docs.length} documents from JSON Lines`);
        return docs;
    }
}

/**
 * Seed data into Elasticsearch
 * @param {Object} esClient - Elasticsearch client
 * @param {string} indexName - Index name
 * @param {string} dataPath - Path to data file
 * @returns {Object} { indexed: number, errors: number }
 */
async function seedData(esClient, indexName, dataPath) {
    console.log(`[Seeder] Loading data from: ${dataPath}`);
    const rawDocs = loadData(dataPath);

    if (rawDocs.length === 0) {
        console.log('[Seeder] No data to seed');
        return { indexed: 0, errors: 0 };
    }

    console.log(`[Seeder] Processing ${rawDocs.length} documents...`);
    const docs = processDocuments(rawDocs);

    // Filter valid documents
    const validDocs = docs.filter(d => d["Id tin"] && d["Tiêu đề tin"]);
    console.log(`[Seeder] Valid documents: ${validDocs.length}`);

    // Bulk index
    console.log('[Seeder] Bulk indexing...');
    const bulkBody = [];

    for (const doc of validDocs) {
        bulkBody.push({ index: { _index: indexName, _id: doc["Id tin"] } });
        bulkBody.push(doc);
    }

    try {
        const result = await esClient.bulk({ body: bulkBody, refresh: true });

        let errors = 0;
        if (result.errors) {
            result.items.forEach(item => {
                if (item.index && item.index.error) {
                    errors++;
                    console.error(`[Seeder] Error indexing ${item.index._id}:`, item.index.error.reason);
                }
            });
        }

        const indexed = validDocs.length - errors;
        console.log(`[Seeder] Indexed: ${indexed}, Errors: ${errors}`);

        return { indexed, errors };
    } catch (err) {
        console.error('[Seeder] Bulk index failed:', err.message);
        return { indexed: 0, errors: validDocs.length };
    }
}

/**
 * Check if index is empty and seed if needed
 * @param {Object} esClient - Elasticsearch client
 * @param {string} indexName - Index name
 * @param {string} dataPath - Path to data file
 */
async function seedIfEmpty(esClient, indexName, dataPath) {
    try {
        // Check if index exists
        const exists = await esClient.indices.exists({ index: indexName });

        if (!exists) {
            console.log(`[Seeder] Index '${indexName}' does not exist. Creating and seeding...`);
            // Create index with basic mapping
            await esClient.indices.create({
                index: indexName,
                body: {
                    settings: {
                        number_of_shards: 1,
                        number_of_replicas: 0
                    }
                }
            });
            console.log(`[Seeder] Index '${indexName}' created.`);
            const result = await seedData(esClient, indexName, dataPath);
            console.log(`[Seeder] Seed complete. Indexed ${result.indexed} documents.`);
            return;
        }

        // Check document count
        const countResult = await esClient.count({ index: indexName });
        const count = countResult.count;

        if (count === 0) {
            console.log(`[Seeder] Index '${indexName}' is empty. Starting seed...`);
            const result = await seedData(esClient, indexName, dataPath);
            console.log(`[Seeder] Seed complete. Indexed ${result.indexed} documents.`);
        } else {
            console.log(`[Seeder] Index '${indexName}' has ${count} documents. Skipping seed.`);
        }
    } catch (err) {
        console.error('[Seeder] Error:', err.message);
    }
}

// ==================== Exports ====================

module.exports = {
    parseExperience,
    parseSalary,
    processDocument,
    processDocuments,
    loadData,
    seedData,
    seedIfEmpty
};
