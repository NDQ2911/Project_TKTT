package indexer

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log"

	"github.com/elastic/go-elasticsearch/v8"
	"github.com/elastic/go-elasticsearch/v8/esapi"
	"github.com/project-tktt/go-crawler/internal/domain"
)

// ElasticsearchIndexer indexes jobs to Elasticsearch
type ElasticsearchIndexer struct {
	client    *elasticsearch.Client
	indexName string
}

// NewElasticsearchIndexer creates a new Elasticsearch indexer
func NewElasticsearchIndexer(addresses []string, indexName string) (*ElasticsearchIndexer, error) {
	cfg := elasticsearch.Config{
		Addresses: addresses,
	}

	client, err := elasticsearch.NewClient(cfg)
	if err != nil {
		return nil, fmt.Errorf("create es client: %w", err)
	}

	// Check connection
	res, err := client.Info()
	if err != nil {
		return nil, fmt.Errorf("es info: %w", err)
	}
	defer res.Body.Close()

	if res.IsError() {
		return nil, fmt.Errorf("es error: %s", res.Status())
	}

	return &ElasticsearchIndexer{
		client:    client,
		indexName: indexName,
	}, nil
}

// Index indexes a single job
func (i *ElasticsearchIndexer) Index(ctx context.Context, job *domain.Job) error {
	data, err := json.Marshal(job)
	if err != nil {
		return fmt.Errorf("marshal job: %w", err)
	}

	req := esapi.IndexRequest{
		Index:      i.indexName,
		DocumentID: job.ID,
		Body:       bytes.NewReader(data),
		Refresh:    "false",
	}

	res, err := req.Do(ctx, i.client)
	if err != nil {
		return fmt.Errorf("index request: %w", err)
	}
	defer res.Body.Close()

	if res.IsError() {
		return fmt.Errorf("index error: %s", res.Status())
	}

	return nil
}

// BulkIndex indexes multiple jobs at once
func (i *ElasticsearchIndexer) BulkIndex(ctx context.Context, jobs []*domain.Job) error {
	if len(jobs) == 0 {
		return nil
	}

	var buf bytes.Buffer

	for _, job := range jobs {
		// Meta line
		meta := map[string]any{
			"index": map[string]any{
				"_index": i.indexName,
				"_id":    job.ID,
			},
		}
		metaBytes, _ := json.Marshal(meta)
		buf.Write(metaBytes)
		buf.WriteByte('\n')

		// Document line
		docBytes, err := json.Marshal(job)
		if err != nil {
			log.Printf("marshal job %s: %v", job.ID, err)
			continue
		}
		buf.Write(docBytes)
		buf.WriteByte('\n')
	}

	res, err := i.client.Bulk(bytes.NewReader(buf.Bytes()), i.client.Bulk.WithContext(ctx))
	if err != nil {
		return fmt.Errorf("bulk request: %w", err)
	}
	defer res.Body.Close()

	if res.IsError() {
		return fmt.Errorf("bulk error: %s", res.Status())
	}

	// Parse response to check for individual errors
	var bulkRes struct {
		Errors bool `json:"errors"`
		Items  []struct {
			Index struct {
				ID     string `json:"_id"`
				Status int    `json:"status"`
				Error  struct {
					Type   string `json:"type"`
					Reason string `json:"reason"`
				} `json:"error"`
			} `json:"index"`
		} `json:"items"`
	}

	if err := json.NewDecoder(res.Body).Decode(&bulkRes); err != nil {
		return fmt.Errorf("parse bulk response: %w", err)
	}

	if bulkRes.Errors {
		for _, item := range bulkRes.Items {
			if item.Index.Status >= 400 {
				log.Printf("bulk index error for %s: %s - %s",
					item.Index.ID, item.Index.Error.Type, item.Index.Error.Reason)
			}
		}
	}

	return nil
}

// EnsureIndex creates the index with Vietnamese-friendly settings if it doesn't exist
func (i *ElasticsearchIndexer) EnsureIndex(ctx context.Context) error {
	return i.EnsureIndexWithSettings(ctx, nil)
}

// EnsureIndexWithSettings creates the index with custom settings JSON
// If settingsJSON is nil, uses default Vietnamese settings
func (i *ElasticsearchIndexer) EnsureIndexWithSettings(ctx context.Context, settingsJSON []byte) error {
	// Check if index exists
	res, err := i.client.Indices.Exists([]string{i.indexName})
	if err != nil {
		return fmt.Errorf("check index: %w", err)
	}
	res.Body.Close()

	if res.StatusCode == 200 {
		log.Printf("[Indexer] Index %s already exists", i.indexName)
		return nil // Index already exists
	}

	// Use provided settings or default
	var mapping []byte
	if settingsJSON != nil && len(settingsJSON) > 0 {
		mapping = settingsJSON
		log.Printf("[Indexer] Creating index %s with custom settings (%d bytes)", i.indexName, len(mapping))
	} else {
		// Default minimal Vietnamese settings
		mapping = []byte(`{
			"settings": {
				"analysis": {
					"filter": {
						"shingle_filter": {
							"type": "shingle",
							"min_shingle_size": 2,
							"max_shingle_size": 3,
							"output_unigrams": true
						}
					},
					"analyzer": {
						"vietnamese": {
							"type": "custom",
							"tokenizer": "standard",
							"filter": ["lowercase", "asciifolding"]
						},
						"vietnamese_suggest": {
							"type": "custom",
							"tokenizer": "standard",
							"filter": ["lowercase", "shingle_filter"]
						}
					}
				}
			},
			"mappings": {
				"properties": {
					"id": {"type": "keyword"},
					"title": {
						"type": "text",
						"analyzer": "vietnamese",
						"fields": {
							"keyword": {"type": "keyword"},
							"suggest": {"type": "text", "analyzer": "vietnamese_suggest"}
						}
					},
					"company": {"type": "text", "analyzer": "vietnamese"},
					"location": {"type": "text", "analyzer": "vietnamese"},
					"location_city": {"type": "keyword"},
					"location_district": {"type": "keyword"},
					"position": {"type": "keyword"},
					"salary": {"type": "text", "fields": {"keyword": {"type": "keyword"}}},
					"salary_min": {"type": "integer"},
					"salary_max": {"type": "integer"},
					"is_negotiable": {"type": "boolean"},
					"work_type": {"type": "keyword"},
					"industry": {"type": "keyword"},
					"experience": {"type": "keyword"},
					"experience_tags": {"type": "keyword"},
					"qualifications": {"type": "keyword"},
					"description": {"type": "text", "analyzer": "vietnamese"},
					"requirements": {"type": "text", "analyzer": "vietnamese"},
					"benefits": {"type": "text", "analyzer": "vietnamese"},
					"skills": {"type": "keyword"},
					"source": {"type": "keyword"},
					"source_url": {"type": "keyword"},
					"total_views": {"type": "integer"},
					"total_resume_applied": {"type": "integer"},
					"rate_response": {"type": "float"},
					"company_website": {"type": "keyword"},
					"occupational_category": {"type": "keyword"},
					"employment_type": {"type": "keyword"},
					"expired_at": {"type": "date"},
					"created_at": {"type": "date"},
					"updated_at": {"type": "date"},
					"crawled_at": {"type": "date"}
				}
			}
		}`)
		log.Printf("[Indexer] Creating index %s with default settings", i.indexName)
	}

	res, err = i.client.Indices.Create(
		i.indexName,
		i.client.Indices.Create.WithBody(bytes.NewReader(mapping)),
	)
	if err != nil {
		return fmt.Errorf("create index: %w", err)
	}
	defer res.Body.Close()

	if res.IsError() {
		return fmt.Errorf("create index error: %s", res.Status())
	}

	log.Printf("[Indexer] Index %s created successfully", i.indexName)
	return nil
}
