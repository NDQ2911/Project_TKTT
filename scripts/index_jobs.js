const fs = require('fs');
const axios = require('axios');
const path = require('path');

(async () => {
  try {
    // Always use jobs.json as the source (NDJSON or JSON array supported)
    const filePath = path.join(__dirname, '..', 'data', 'jobs.json');
    if (!fs.existsSync(filePath) || fs.statSync(filePath).size === 0) {
      console.error('No data file found: data/jobs.json is missing or empty');
      process.exit(1);
    }

    const raw = fs.readFileSync(filePath, 'utf-8').trim();
    let docs = [];

    if (raw.startsWith('[')) {
      // JSON array
      docs = JSON.parse(raw);
    } else {
      // NDJSON - one JSON object per line
      docs = raw.split(/\r?\n/).filter(Boolean).map((ln, i) => {
        try {
          return JSON.parse(ln);
        } catch (e) {
          console.error(`Failed to parse JSON on line ${i + 1}:`, e.message);
          return null;
        }
      }).filter(Boolean);
    }

    if (!Array.isArray(docs) || docs.length === 0) {
      console.error('No documents found in data/jobs.json');
      process.exit(1);
    }

    const index = process.env.ES_INDEX || 'docs';
    const esURL = process.env.ES_NODE || 'http://localhost:9200';

    // Send in chunks to avoid very large requests
    const batchSize = parseInt(process.env.BULK_BATCH_SIZE || '1000');
    let totalIndexed = 0;

    for (let i = 0; i < docs.length; i += batchSize) {
      const batch = docs.slice(i, i + batchSize);
      let nd = '';
      batch.forEach(doc => {
        const id = doc['Id tin'] || doc.id || doc._id;
        const meta = { index: { _index: index } };
        if (id) meta.index._id = id;
        nd += JSON.stringify(meta) + '\n';
        nd += JSON.stringify(doc) + '\n';
      });

      console.log(`Sending batch ${Math.floor(i / batchSize) + 1} (${batch.length} docs) to ${esURL}/_bulk (index=${index})`);
      const res = await axios.post(`${esURL}/_bulk?refresh=true`, nd, {
        headers: { 'Content-Type': 'application/x-ndjson' }
      });

      if (res.data.errors) {
        console.error('Bulk indexing completed with errors. See response:');
        console.error(JSON.stringify(res.data, null, 2));
        process.exit(1);
      }

      totalIndexed += batch.length;
    }

    console.log('Bulk index success. Items indexed:', totalIndexed);
  } catch (err) {
    console.error('Index failed:', err.response ? err.response.data : err.message);
    process.exit(1);
  }
})();