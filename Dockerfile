FROM rust:1.89 AS backend-builder

WORKDIR /app

COPY backend/src ./backend/src
COPY backend/Cargo.toml ./backend/Cargo.toml
COPY backend/Cargo.lock ./backend/Cargo.lock
COPY backend/search_index/text.db ./backend/search_index/text.db
WORKDIR /app/backend

RUN cargo build --release

FROM node:22-slim AS frontend-builder

WORKDIR /app

COPY frontend ./frontend
WORKDIR /app/frontend
RUN rm -rf package-lock.json node_modules
RUN npm install
RUN npm run build

FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=backend-builder /app/backend/target/release/spaceapp /app/spaceapp
COPY --from=backend-builder /app/backend/search_index/text.db /app/search_index/text.db
COPY --from=frontend-builder /app/frontend/dist /app/static

EXPOSE 5050

CMD ["/app/spaceapp"]
