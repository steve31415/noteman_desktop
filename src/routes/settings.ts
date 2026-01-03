import { Hono } from 'hono';
import { html } from 'hono/html';
import type { Env } from '../types';

const settings = new Hono<{ Bindings: Env }>();

settings.get('/settings', (c) => {
  return c.html(html`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Noteman - Settings</title>
      <style>
        * { box-sizing: border-box; }

        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          max-width: 600px;
          margin: 2rem auto;
          padding: 0 1rem;
          background: #f5f5f5;
        }

        main {
          background: white;
          padding: 2rem;
          border-radius: 8px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }

        h1 {
          margin-top: 0;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        h1 a {
          font-size: 0.9rem;
          color: #666;
          text-decoration: none;
        }

        h1 a:hover { color: #333; }

        h2 {
          font-size: 1.2rem;
          margin-top: 2rem;
          margin-bottom: 1rem;
          padding-bottom: 0.5rem;
          border-bottom: 1px solid #eee;
        }

        h2:first-of-type { margin-top: 0; }

        .description {
          color: #666;
          font-size: 0.9rem;
          margin-bottom: 1rem;
        }

        .page-list {
          list-style: none;
          padding: 0;
          margin: 0 0 1rem 0;
        }

        .page-list li {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0.5rem 0;
          border-bottom: 1px solid #eee;
        }

        .page-list li:last-child { border-bottom: none; }

        .page-list a {
          color: #2563eb;
          text-decoration: none;
        }

        .page-list a:hover { text-decoration: underline; }

        .delete-btn {
          background: none;
          border: none;
          color: #dc2626;
          cursor: pointer;
          padding: 0.25rem 0.5rem;
          font-size: 1.2rem;
          opacity: 0.6;
        }

        .delete-btn:hover { opacity: 1; }

        .add-form {
          display: flex;
          gap: 0.5rem;
        }

        .add-form input {
          flex: 1;
          padding: 0.5rem;
          border: 1px solid #ddd;
          border-radius: 4px;
          font-size: 0.9rem;
        }

        .add-form button {
          background: #2563eb;
          color: white;
          border: none;
          padding: 0.5rem 1rem;
          border-radius: 4px;
          cursor: pointer;
          white-space: nowrap;
        }

        .add-form button:hover { background: #1d4ed8; }
        .add-form button:disabled { opacity: 0.6; cursor: not-allowed; }

        .error-msg {
          color: #dc2626;
          font-size: 0.85rem;
          margin-top: 0.5rem;
        }

        .empty {
          color: #666;
          font-style: italic;
          padding: 0.5rem 0;
        }
      </style>
    </head>
    <body>
      <main>
        <h1>
          Settings
          <a href="/">&larr; Back</a>
        </h1>

        <section>
          <h2>Pages Whitelist</h2>
          <p class="description">Pages in this list are directly searchable.</p>
          <ul id="pagesList" class="page-list">
            <li class="empty">Loading...</li>
          </ul>
          <form id="addPageForm" class="add-form">
            <input type="text" id="pageInput" placeholder="Page ID or Notion URL" required>
            <button type="submit">Add Page</button>
          </form>
          <div id="pageError" class="error-msg"></div>
        </section>

        <section style="margin-top: 2.5rem;">
          <h2>Parent Pages Whitelist</h2>
          <p class="description">Children of these pages are searchable.</p>
          <ul id="parentsList" class="page-list">
            <li class="empty">Loading...</li>
          </ul>
          <form id="addParentForm" class="add-form">
            <input type="text" id="parentInput" placeholder="Page ID or Notion URL" required>
            <button type="submit">Add Parent</button>
          </form>
          <div id="parentError" class="error-msg"></div>
        </section>

        <p style="margin-top: 2rem; color: #666; font-size: 0.9rem;">
          <strong>Remember:</strong> Each Notion page you want to access must be shared with your integration (page menu → Connections → Add your integration).
        </p>
      </main>

      <script>
        function escapeHtml(text) {
          const div = document.createElement('div');
          div.textContent = text;
          return div.innerHTML;
        }

        function notionUrl(pageId) {
          // Remove dashes from UUID format for Notion URLs
          return 'https://www.notion.so/' + pageId.replace(/-/g, '');
        }

        function renderList(listEl, pages, deleteHandler) {
          if (pages.length === 0) {
            listEl.innerHTML = '<li class="empty">No pages added yet</li>';
            return;
          }

          listEl.innerHTML = pages.map(page =>
            '<li>' +
            '<a href="' + notionUrl(page.id) + '" target="_blank" rel="noopener">' +
            escapeHtml(page.title) +
            '</a>' +
            '<button class="delete-btn" data-id="' + page.id + '" title="Remove">&times;</button>' +
            '</li>'
          ).join('');

          listEl.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', () => deleteHandler(btn.dataset.id));
          });
        }

        async function loadPages() {
          try {
            const res = await fetch('/api/whitelist/pages');
            if (!res.ok) throw new Error('Failed to load');
            const data = await res.json();
            renderList(
              document.getElementById('pagesList'),
              data.pages,
              deletePage
            );
          } catch (err) {
            document.getElementById('pagesList').innerHTML =
              '<li class="empty">Failed to load pages</li>';
          }
        }

        async function loadParents() {
          try {
            const res = await fetch('/api/whitelist/parents');
            if (!res.ok) throw new Error('Failed to load');
            const data = await res.json();
            renderList(
              document.getElementById('parentsList'),
              data.pages,
              deleteParent
            );
          } catch (err) {
            document.getElementById('parentsList').innerHTML =
              '<li class="empty">Failed to load parents</li>';
          }
        }

        async function deletePage(pageId) {
          try {
            const res = await fetch('/api/whitelist/pages/' + pageId, {
              method: 'DELETE'
            });
            if (!res.ok) throw new Error('Failed to delete');
            loadPages();
          } catch (err) {
            alert('Failed to delete page');
          }
        }

        async function deleteParent(pageId) {
          try {
            const res = await fetch('/api/whitelist/parents/' + pageId, {
              method: 'DELETE'
            });
            if (!res.ok) throw new Error('Failed to delete');
            loadParents();
          } catch (err) {
            alert('Failed to delete parent');
          }
        }

        document.getElementById('addPageForm').addEventListener('submit', async (e) => {
          e.preventDefault();
          const input = document.getElementById('pageInput');
          const errorDiv = document.getElementById('pageError');
          const btn = e.target.querySelector('button');

          errorDiv.textContent = '';
          btn.disabled = true;

          try {
            const res = await fetch('/api/whitelist/pages', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ pageUrl: input.value })
            });

            const data = await res.json();

            if (!res.ok || !data.success) {
              throw new Error(data.error || 'Failed to add page');
            }

            input.value = '';
            loadPages();
          } catch (err) {
            errorDiv.textContent = err.message;
          } finally {
            btn.disabled = false;
          }
        });

        document.getElementById('addParentForm').addEventListener('submit', async (e) => {
          e.preventDefault();
          const input = document.getElementById('parentInput');
          const errorDiv = document.getElementById('parentError');
          const btn = e.target.querySelector('button');

          errorDiv.textContent = '';
          btn.disabled = true;

          try {
            const res = await fetch('/api/whitelist/parents', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ pageUrl: input.value })
            });

            const data = await res.json();

            if (!res.ok || !data.success) {
              throw new Error(data.error || 'Failed to add parent page');
            }

            input.value = '';
            loadParents();
          } catch (err) {
            errorDiv.textContent = err.message;
          } finally {
            btn.disabled = false;
          }
        });

        // Load on startup
        loadPages();
        loadParents();
      </script>
    </body>
    </html>
  `);
});

export default settings;
