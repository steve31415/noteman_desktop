# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Noteman is a Cloudflare Worker app (using Hono framework) that inserts markdown content into Notion pages. It provides a web UI for selecting destination pages and entering markdown that gets converted to Notion blocks.

## Commands

- `npm run dev` - Start local dev server with wrangler
- `npm run deploy` - Deploy to Cloudflare Workers
- `npm test -- --run` - Run tests once (do NOT use `npm test` alone as it enters watch mode)
- `npx wrangler d1 migrations apply noteman-db` - Apply database migrations

## Architecture

### Entry Point & Routing
- `src/index.ts` - Hono app entry, mounts route modules at `/api` and `/`
- `src/routes/api.ts` - REST API endpoints for page operations and whitelist management
- `src/routes/home.ts` - Main UI page with page search and markdown input form
- `src/routes/settings.ts` - Settings UI for managing whitelist pages

### Data Layer
- `src/db/recent-pages.ts` - Track recently-used pages (auto-caps at 50 entries)
- `src/db/whitelist.ts` - Manage two whitelists: direct pages and parent pages (whose children are also searchable)
- `migrations/001_initial.sql` - D1 database schema

### Notion Integration
- `src/notion/client.ts` - Notion API wrapper: page retrieval, child page listing, block insertion
- `src/markdown/parser.ts` - Converts markdown to Notion block format (headings, lists, code blocks, inline formatting)

### Testing
- `test/test-db.ts` - D1-compatible SQLite wrapper using better-sqlite3 for testing
- Tests run with vitest; use `createTestDb()` to get an in-memory database with migrations applied

## Environment

- `NOTION_TOKEN` - Notion integration token (set in wrangler.toml secrets or env)
- `DB` - D1 database binding configured in wrangler.toml
