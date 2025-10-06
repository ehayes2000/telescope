# Telescope - A research assistant

[Demo](https://telescope.wiki)

A full-stack web application for searching and interacting with space-related research papers. Built for NASA Space Apps Challenge, this project provides full-text search capabilities over a corpus of scientific PDFs with an AI-powered chat interface.

## Features

- **Full-Text Search**: SQLite FTS5-based search across indexed research papers with metadata (titles, authors, publications)
- **AI Chat Interface**: Interactive AI assistant that can search through papers and answer questions using retrieved context
- **Modern Web UI**: Built with SolidJS and TailwindCSS for a responsive, fast user experience

## Tech Stack

**Backend (Rust)**

- Axum for HTTP API server
- SQLite with FTS5 for full-text search
- WebSocket server for AI streaming
  - This is not used
  - I wasted 2 hour writing this before I figured out I didn't need it
- PDF text extraction and indexing
- The `backend/scripts` directory builds the search index. Run `npm download` then `npm index` to build the search index
- Deployable with docker see `Justfile` for the docker commands

**Frontend (TypeScript/SolidJS)**

- SolidJS for reactive UI
- OpenAI integration for chat
- TailwindCSS for styling
- Markdown rendering for formatted responses

## Database

The project uses [SQLite FTS5](https://www.sqlite.org/fts5.html) a pre-indexed database of 680 space-related research papers with full metadata (accessible via `/backend/search_index/`).
