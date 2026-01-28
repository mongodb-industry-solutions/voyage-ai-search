# Dockerfile for Voyage AI Search Flask Application
FROM python:3.12-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY app.py .
COPY templates/ ./templates/
COPY static/ ./static/

# Expose Kanopy standard port
EXPOSE 8080

# Run Flask application on 0.0.0.0:8080 (required for Kanopy)
CMD ["python", "-c", "from app import app; app.run(host='0.0.0.0', port=8080, debug=False, use_reloader=False)"]
