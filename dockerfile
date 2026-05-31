# ── Stage 1: Build React frontend ──────────────────────────────────────────────
FROM node:20-slim AS frontend-builder
WORKDIR /app/frontend

# Install deps first (layer-cached until package.json changes)
COPY frontend/package.json ./
RUN npm install

# Copy rest of frontend source and build
COPY frontend/ .
# Copy logo so Vite bundles it into the build
COPY logo.png ./public/logo.png
RUN npm run build
# vite outDir is '../dist' → output lands at /app/dist

# ── Stage 2: Python FastAPI ─────────────────────────────────────────────────────
FROM python:3.11-slim
WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend source
COPY . .

# Copy React build output from Stage 1
COPY --from=frontend-builder /app/dist ./dist

# Tell FastAPI to serve static files from the React build
ENV STATIC_DIR=dist

EXPOSE 8000
CMD ["uvicorn", "api:app", "--host", "0.0.0.0", "--port", "8000"]
