FROM python:3.11-slim

WORKDIR /app

COPY solver-service/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY solver-service/ .

EXPOSE 8080

ENTRYPOINT ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8080}"]
