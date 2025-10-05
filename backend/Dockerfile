FROM rust:1.83 as backend-builder

WORKDIR /app
COPY Cargo.toml Cargo.lock ./
COPY src ./src
COPY search_index ./search_index

RUN cargo build --release

FROM node:22-slim as frontend-builder

WORKDIR /frontend
COPY ../frontend/package*.json ../frontend/bun.lock* ./
RUN npm install

COPY ../frontend ./
RUN npm run build

FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=backend-builder /app/target/release/spaceapp /app/spaceapp
COPY --from=backend-builder /app/search_index/text.db /app/search_index/text.db
COPY --from=frontend-builder /frontend/dist /app/static

EXPOSE 8080

CMD ["/app/spaceapp"]
