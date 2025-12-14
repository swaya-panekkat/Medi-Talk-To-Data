# Step 1: Use a base Python image
FROM python:3.11-slim

# Step 2: Set the working directory inside the container
WORKDIR /app

# Step 3: Copy requirements first (for caching layers)
COPY requirements.txt .

# Step 4: Install dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Step 5: Copy the rest of the project files
COPY . .

# Step 6: Expose port (Flask usually runs on 5000)
EXPOSE 8000

# Step 7: Run the app (assuming main.py is the entry point)
CMD ["uvicorn", "api:app", "--host", "0.0.0.0", "--port", "8000"]

