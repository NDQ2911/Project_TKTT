# Project TKTT - Job Search with Elasticsearch

# Default recipe
default:
    @just --list

# Run both backend and frontend
dev:
    cd backend && npm start &
    cd frontend && npx serve -p 8080

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

# ============ Local Tunnel (cloudflared) ============
# Expose backend to internet (port 3000)
tunnel-be:
    "C:\Program Files (x86)\cloudflared\cloudflared.exe" tunnel --url http://localhost:3000

# Expose frontend to internet (port 8080)
tunnel-fe:
    "C:\Program Files (x86)\cloudflared\cloudflared.exe" tunnel --url http://localhost:8080

# Expose both backend and frontend (run in parallel)
tunnel-all:
    "C:\Program Files (x86)\cloudflared\cloudflared.exe" tunnel --url http://localhost:3000 &
    "C:\Program Files (x86)\cloudflared\cloudflared.exe" tunnel --url http://localhost:8080
