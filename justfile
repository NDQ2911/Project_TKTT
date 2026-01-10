# Project TKTT - Job Search with Elasticsearch

# Default recipe
default:
    @just --list

# Run both backend and frontend
dev:
    @just backend & just frontend & wait

# Run backend only
backend:
    cd backend && npm start

# Run frontend only  
frontend:
    cd frontend && npx serve -p 8080

# Install all dependencies
install:
    cd backend && npm install
    cd frontend && npm install

# ============ Crawler Aliases ============
# Build crawler images
crawler-build:
    cd job-crawler && just build

# Start crawler services
crawler-up:
    cd job-crawler && just up

# Stop crawler services
crawler-down:
    cd job-crawler && just down

# Clean crawler (stop + remove volumes)
crawler-clean:
    cd job-crawler && just clean

# View crawler stats
crawler-stats:
    cd job-crawler && just stats

# View crawler logs
crawler-logs:
    cd job-crawler && just logs


# Test search endpoints
test-http:
    curl -X POST http://localhost:3000/search/http -H "Content-Type: application/json" -d '{"q":"IT"}'

test-sdk:
    curl -X POST http://localhost:3000/search/sdk -H "Content-Type: application/json" -d '{"q":"IT"}'
    
    