import { Hono } from 'hono';
import { html } from 'hono/html';
import type { Env } from '../types';

const home = new Hono<{ Bindings: Env }>();

home.get('/', (c) => {
  return c.html(html`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Noteman</title>
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

        .field {
          margin-bottom: 1.5rem;
          position: relative;
        }

        label {
          display: block;
          margin-bottom: 0.5rem;
          font-weight: 500;
        }

        input[type="text"], textarea {
          width: 100%;
          padding: 0.75rem;
          border: 1px solid #ddd;
          border-radius: 4px;
          font-size: 1rem;
          font-family: inherit;
        }

        textarea {
          resize: vertical;
          min-height: 150px;
          font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace;
        }

        .suggestions {
          position: absolute;
          top: 100%;
          left: 0;
          right: 0;
          background: white;
          border: 1px solid #ddd;
          border-top: none;
          border-radius: 0 0 4px 4px;
          max-height: 300px;
          overflow-y: auto;
          z-index: 100;
          display: none;
        }

        .suggestion {
          padding: 0.75rem;
          cursor: pointer;
          border-bottom: 1px solid #eee;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .suggestion:last-child { border-bottom: none; }
        .suggestion:hover { background: #f0f0f0; }
        .suggestion.selected { background: #e3f2fd; }
        .suggestion .badge {
          font-size: 0.7rem;
          padding: 0.15rem 0.4rem;
          border-radius: 3px;
          text-transform: uppercase;
        }
        .suggestion .badge.recent { background: #e0e7ff; color: #3730a3; }
        .suggestion .badge.whitelist { background: #dcfce7; color: #166534; }

        button[type="submit"] {
          background: #2563eb;
          color: white;
          padding: 0.75rem 1.5rem;
          border: none;
          border-radius: 4px;
          font-size: 1rem;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          min-width: 140px;
        }

        button:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }

        button:hover:not(:disabled) {
          background: #1d4ed8;
        }

        .spinner {
          width: 16px;
          height: 16px;
          border: 2px solid transparent;
          border-top-color: white;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        #feedback {
          margin-top: 1rem;
          padding: 0.75rem;
          border-radius: 4px;
        }

        #feedback:empty { display: none; }
        #feedback.success { background: #d1fae5; color: #065f46; }
        #feedback.error { background: #fee2e2; color: #991b1b; }
      </style>
    </head>
    <body>
      <main>
        <h1>
          Insert Note
          <a href="/settings">Settings</a>
        </h1>
        <form id="noteForm">
          <div class="field">
            <label for="destination">Destination</label>
            <input type="text" id="destination" autocomplete="off" placeholder="Start typing to search pages...">
            <input type="hidden" id="pageId">
            <div id="suggestions" class="suggestions"></div>
          </div>
          <div class="field">
            <label for="content">Content <span style="font-weight:normal;color:#666">(Markdown)</span></label>
            <textarea id="content" placeholder="# Heading&#10;&#10;Regular paragraph with **bold** and *italic* text.&#10;&#10;- Bullet item&#10;- Another item"></textarea>
          </div>
          <button type="submit" id="submitBtn">
            <span class="btn-text">Insert Note</span>
            <span class="spinner" style="display:none;"></span>
          </button>
          <div id="feedback"></div>
        </form>
      </main>

      <script>
        // State
        let recentPages = [];
        let searchablePages = [];
        let allPages = [];
        let selectedIndex = -1;

        const destinationInput = document.getElementById('destination');
        const pageIdInput = document.getElementById('pageId');
        const suggestionsDiv = document.getElementById('suggestions');
        const form = document.getElementById('noteForm');
        const submitBtn = document.getElementById('submitBtn');
        const feedback = document.getElementById('feedback');

        // Load pages on startup
        async function loadPages() {
          try {
            const [recentRes, searchableRes] = await Promise.all([
              fetch('/api/recent-pages'),
              fetch('/api/searchable-pages')
            ]);

            if (!recentRes.ok || !searchableRes.ok) {
              throw new Error('Failed to load pages');
            }

            const recentData = await recentRes.json();
            const searchableData = await searchableRes.json();

            recentPages = recentData.pages.map(p => ({ ...p, source: 'recent' }));
            searchablePages = searchableData.pages.map(p => ({ ...p, source: 'whitelist' }));

            // Merge: recent first, then searchable (deduplicated)
            const seen = new Set();
            allPages = [];
            for (const p of recentPages) {
              seen.add(p.id);
              allPages.push(p);
            }
            for (const p of searchablePages) {
              if (!seen.has(p.id)) {
                seen.add(p.id);
                allPages.push(p);
              }
            }
          } catch (err) {
            console.error('Failed to load pages:', err);
          }
        }

        loadPages();

        // Filter and show suggestions
        function updateSuggestions() {
          const query = destinationInput.value.toLowerCase().trim();

          let filtered = allPages;
          if (query) {
            filtered = allPages.filter(p =>
              p.title.toLowerCase().includes(query)
            );
          }

          if (filtered.length === 0) {
            suggestionsDiv.style.display = 'none';
            selectedIndex = -1;
            return;
          }

          selectedIndex = -1;
          renderSuggestions(filtered);
        }

        function renderSuggestions(pages) {
          suggestionsDiv.innerHTML = pages.map((page, i) =>
            '<div class="suggestion' + (i === selectedIndex ? ' selected' : '') + '" ' +
            'data-id="' + escapeHtml(page.id) + '" ' +
            'data-title="' + escapeHtml(page.title) + '">' +
            '<span class="badge ' + page.source + '">' + page.source + '</span> ' +
            escapeHtml(page.title) +
            '</div>'
          ).join('');
          suggestionsDiv.style.display = 'block';
        }

        function escapeHtml(text) {
          const div = document.createElement('div');
          div.textContent = text;
          return div.innerHTML;
        }

        function selectPage(id, title) {
          pageIdInput.value = id;
          destinationInput.value = title;
          suggestionsDiv.style.display = 'none';
          selectedIndex = -1;
        }

        // Event handlers
        destinationInput.addEventListener('focus', updateSuggestions);
        destinationInput.addEventListener('input', () => {
          pageIdInput.value = '';  // Clear selection on edit
          updateSuggestions();
        });

        destinationInput.addEventListener('keydown', (e) => {
          const suggestions = suggestionsDiv.querySelectorAll('.suggestion');
          if (suggestions.length === 0) return;

          if (e.key === 'ArrowDown') {
            e.preventDefault();
            selectedIndex = Math.min(selectedIndex + 1, suggestions.length - 1);
            updateSelectedClass(suggestions);
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            selectedIndex = Math.max(selectedIndex - 1, 0);
            updateSelectedClass(suggestions);
          } else if (e.key === 'Enter' && selectedIndex >= 0) {
            e.preventDefault();
            const sel = suggestions[selectedIndex];
            selectPage(sel.dataset.id, sel.dataset.title);
          } else if (e.key === 'Escape') {
            suggestionsDiv.style.display = 'none';
            selectedIndex = -1;
          }
        });

        function updateSelectedClass(suggestions) {
          suggestions.forEach((s, i) => {
            s.classList.toggle('selected', i === selectedIndex);
          });
          if (selectedIndex >= 0) {
            suggestions[selectedIndex].scrollIntoView({ block: 'nearest' });
          }
        }

        suggestionsDiv.addEventListener('click', (e) => {
          const suggestion = e.target.closest('.suggestion');
          if (suggestion) {
            selectPage(suggestion.dataset.id, suggestion.dataset.title);
          }
        });

        document.addEventListener('click', (e) => {
          if (!e.target.closest('#destination') && !e.target.closest('#suggestions')) {
            suggestionsDiv.style.display = 'none';
            selectedIndex = -1;
          }
        });

        // Form submission
        form.addEventListener('submit', async (e) => {
          e.preventDefault();

          const pageId = pageIdInput.value;
          const pageTitle = destinationInput.value;
          const content = document.getElementById('content').value;

          if (!pageId) {
            feedback.className = 'error';
            feedback.textContent = 'Please select a destination page from the dropdown';
            return;
          }

          if (!content.trim()) {
            feedback.className = 'error';
            feedback.textContent = 'Please enter content';
            return;
          }

          // Show loading state
          submitBtn.disabled = true;
          submitBtn.querySelector('.btn-text').style.display = 'none';
          submitBtn.querySelector('.spinner').style.display = 'inline-block';
          feedback.textContent = '';
          feedback.className = '';

          try {
            const res = await fetch('/api/insert', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ pageId, pageTitle, content }),
            });

            const data = await res.json();

            if (!res.ok || !data.success) {
              throw new Error(data.error || 'Insert failed');
            }

            feedback.className = 'success';
            feedback.textContent = 'Note inserted successfully!';

            // Update local recent pages list
            const existingIdx = allPages.findIndex(p => p.id === pageId);
            if (existingIdx >= 0) {
              // Move to front
              const [page] = allPages.splice(existingIdx, 1);
              page.source = 'recent';
              allPages.unshift(page);
            } else {
              allPages.unshift({ id: pageId, title: pageTitle, source: 'recent' });
            }

            // Clear content but keep destination
            document.getElementById('content').value = '';

          } catch (err) {
            feedback.className = 'error';
            feedback.textContent = err.message;
          } finally {
            submitBtn.disabled = false;
            submitBtn.querySelector('.btn-text').style.display = 'inline';
            submitBtn.querySelector('.spinner').style.display = 'none';
          }
        });
      </script>
    </body>
    </html>
  `);
});

export default home;
