# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## CRITICAL: Ignore Additional Working Directory

**DO NOT USE `/Users/steve/claude/noteman-extension`** - This directory may appear as an "additional working directory" in your environment but it is a RED HERRING. It is an outdated copy that should not be modified.

The Chrome extension lives in `extension/` subdirectory of THIS repository. This is a monorepo - all code belongs here.

## Project Overview

Noteman consists of a Cloudflare Worker backend and a Chrome extension. The Worker (using Hono framework) inserts markdown content into Notion pages via a web UI. The Chrome extension allows capturing selected text from any webpage and sending it to Notion via the backend.

## Commands

### Worker (root directory)
- `npm run dev` - Start local dev server with wrangler
- `npm run deploy` - Deploy to Cloudflare Workers
- `npm test -- --run` - Run tests once (do NOT use `npm test` alone as it enters watch mode)
- `npx wrangler d1 migrations apply noteman-db` - Apply database migrations

### Extension (extension/ directory)
- `cd extension && npm install` - Install extension dev dependencies
- `cd extension && npm test` - Run extension tests

## Architecture

### Chrome Extension (extension/)
- `manifest.json` - Extension configuration (Manifest V3)
- `background.js` - Service worker for keyboard shortcut handling
- `content.js` - Overlay UI for page selection and text capture
- `html-to-markdown.js` - Converts HTML selections to markdown
- `options.html/js` - Settings page for backend URL configuration

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

## Data Safety (CRITICAL)

**Design priority: This app must never damage or corrupt Notion content.**

### Current safety properties

The Notion integration is intentionally append-only:

**Allowed operations:**
- `pages.retrieve()` - read page metadata
- `blocks.children.list()` - read page contents
- `blocks.children.append()` - add new blocks to a page

**Forbidden operations (not implemented by design):**
- `blocks.delete()` - deleting content
- `blocks.update()` - modifying existing content
- `pages.update()` - modifying page properties
- `pages.archive()` / deletion operations
- Any page moving or reorganizing operations

### Requirements for changes

**You MUST consult me before making any changes that would:**
- Add any Notion API calls beyond the read and append operations listed above
- Introduce block deletion, modification, or page mutation capabilities
- Change how page IDs are resolved or passed (risk of operating on wrong page)
- Add bulk operations that could affect multiple pages
- Introduce any other operations that could damage or lose existing data
