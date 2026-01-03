/**
 * Content script for Noteman Clipper extension.
 * Handles selection capture and overlay UI.
 */

// Listen for messages from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'captureSelection') {
    captureAndShowOverlay();
    sendResponse({ success: true });
  }
  return false;
});

/**
 * Capture the current selection and show the overlay.
 */
function captureAndShowOverlay() {
  // Get selection
  const selection = window.getSelection();
  let markdown = '';

  if (selection && selection.rangeCount > 0) {
    const range = selection.getRangeAt(0);
    const container = document.createElement('div');
    container.appendChild(range.cloneContents());
    const selectedHtml = container.innerHTML;
    markdown = htmlToMarkdown(selectedHtml);
  }

  // Format content with source link and blockquote
  const pageTitle = document.title;
  const pageUrl = window.location.href;
  const formattedContent = formatCapturedContent(markdown, pageTitle, pageUrl);

  showOverlay(formattedContent);
}

/**
 * Format captured content with source link and blockquote.
 * @param {string} markdown - The captured markdown text
 * @param {string} pageTitle - The page title
 * @param {string} pageUrl - The page URL
 * @returns {string} - Formatted markdown
 */
function formatCapturedContent(markdown, pageTitle, pageUrl) {
  // Escape brackets in title for markdown link
  const escapedTitle = pageTitle.replace(/\[/g, '\\[').replace(/\]/g, '\\]');
  const sourceLink = `[${escapedTitle}](${pageUrl})`;

  if (!markdown.trim()) {
    return `- ${sourceLink}`;
  }

  // Wrap selection in blockquote, nested under the bullet
  const blockquoted = markdown
    .split('\n')
    .map(line => `  > ${line}`)
    .join('\n');

  return `- ${sourceLink}\n${blockquoted}`;
}

/**
 * Show the overlay with the captured content.
 * @param {string} content - The pre-filled content
 */
function showOverlay(content) {
  // Remove existing overlay if any
  const existing = document.getElementById('noteman-overlay-root');
  if (existing) {
    existing.remove();
  }

  // Create overlay container with shadow DOM for style isolation
  const overlayRoot = document.createElement('div');
  overlayRoot.id = 'noteman-overlay-root';
  const shadow = overlayRoot.attachShadow({ mode: 'closed' });

  // Add styles
  const style = document.createElement('style');
  style.textContent = getOverlayStyles();
  shadow.appendChild(style);

  // Create overlay HTML
  const overlay = document.createElement('div');
  overlay.id = 'noteman-overlay';
  overlay.innerHTML = `
    <div class="noteman-backdrop"></div>
    <div class="noteman-popup">
      <div class="noteman-header">
        <h3>Save to Notion</h3>
        <button class="noteman-close" aria-label="Close">&times;</button>
      </div>
      <div class="noteman-body">
        <div class="noteman-field">
          <label for="noteman-destination">Destination</label>
          <input type="text" id="noteman-destination" autocomplete="off" placeholder="Search pages...">
          <input type="hidden" id="noteman-page-id">
          <div id="noteman-suggestions" class="noteman-suggestions"></div>
        </div>
        <div class="noteman-field">
          <label for="noteman-content">Content</label>
          <textarea id="noteman-content" rows="8">${escapeHtml(content)}</textarea>
        </div>
        <div class="noteman-actions">
          <button id="noteman-cancel" class="noteman-btn-secondary">Cancel</button>
          <button id="noteman-submit" class="noteman-btn-primary">
            <span class="noteman-btn-text">Save Note</span>
            <span class="noteman-spinner"></span>
          </button>
        </div>
        <div id="noteman-feedback"></div>
      </div>
    </div>
  `;

  shadow.appendChild(overlay);
  document.body.appendChild(overlayRoot);

  // Initialize event handlers
  initializeOverlay(shadow);
}

/**
 * Escape HTML entities.
 * @param {string} text
 * @returns {string}
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Initialize overlay event handlers.
 * @param {ShadowRoot} shadow - The shadow root
 */
async function initializeOverlay(shadow) {
  // Get backend URL from storage
  const result = await chrome.storage.sync.get(['backendUrl']);
  const backendUrl = result.backendUrl;

  if (!backendUrl) {
    showFeedback(shadow, 'Please configure the Noteman backend URL in extension options.', 'error');
    // Add link to open options
    const feedback = shadow.getElementById('noteman-feedback');
    const link = document.createElement('a');
    link.textContent = ' Open Settings';
    link.href = '#';
    link.style.color = '#2563eb';
    link.addEventListener('click', (e) => {
      e.preventDefault();
      chrome.runtime.sendMessage({ action: 'openOptions' });
    });
    feedback.appendChild(link);
    return;
  }

  // Load pages via background script (to avoid CORS issues)
  let allPages = [];
  try {
    const [recentResult, searchableResult] = await Promise.all([
      chrome.runtime.sendMessage({
        action: 'apiRequest',
        url: `${backendUrl}/api/recent-pages`
      }),
      chrome.runtime.sendMessage({
        action: 'apiRequest',
        url: `${backendUrl}/api/searchable-pages`
      })
    ]);

    if (!recentResult.success || !searchableResult.success) {
      throw new Error(recentResult.error || searchableResult.error || 'Failed to load pages');
    }

    const recentData = recentResult.data;
    const searchableData = searchableResult.data;

    // Merge: recent first, then searchable (deduplicated)
    const seen = new Set();
    for (const p of recentData.pages) {
      seen.add(p.id);
      allPages.push({ ...p, source: 'recent' });
    }
    for (const p of searchableData.pages) {
      if (!seen.has(p.id)) {
        seen.add(p.id);
        allPages.push({ ...p, source: 'whitelist' });
      }
    }
  } catch (err) {
    console.error('Failed to load pages:', err);
    showFeedback(shadow, 'Failed to connect to Noteman backend. Check your settings.', 'error');
    return;
  }

  // Get UI elements
  const destinationInput = shadow.getElementById('noteman-destination');
  const pageIdInput = shadow.getElementById('noteman-page-id');
  const suggestionsDiv = shadow.getElementById('noteman-suggestions');
  const contentTextarea = shadow.getElementById('noteman-content');
  const submitBtn = shadow.getElementById('noteman-submit');
  const cancelBtn = shadow.getElementById('noteman-cancel');
  const closeBtn = shadow.querySelector('.noteman-close');
  const backdrop = shadow.querySelector('.noteman-backdrop');
  const overlayRoot = document.getElementById('noteman-overlay-root');

  let selectedIndex = -1;

  function closeOverlay() {
    overlayRoot.remove();
  }

  // Track filtered pages for digit selection
  let currentFilteredPages = [];

  function updateSuggestions() {
    const query = destinationInput.value.toLowerCase().trim();
    let filtered = allPages;

    if (query) {
      filtered = allPages.filter(p => p.title.toLowerCase().includes(query));
    }

    currentFilteredPages = filtered.slice(0, 20);

    if (filtered.length === 0) {
      suggestionsDiv.style.display = 'none';
      selectedIndex = -1;
      return;
    }

    selectedIndex = -1;
    suggestionsDiv.innerHTML = currentFilteredPages.map((page, i) => {
      const number = i < 9 ? `<span class="number">${i + 1}</span>` : '';
      return `
        <div class="noteman-suggestion${i === selectedIndex ? ' selected' : ''}"
             data-id="${escapeAttr(page.id)}"
             data-title="${escapeAttr(page.title)}"
             data-index="${i}">
          ${number}
          <span class="badge ${page.source}">${page.source}</span>
          ${escapeHtml(page.title)}
        </div>
      `;
    }).join('');
    suggestionsDiv.style.display = 'block';
  }

  function selectPage(id, title) {
    pageIdInput.value = id;
    destinationInput.value = title;
    suggestionsDiv.style.display = 'none';
    selectedIndex = -1;
    // Move focus to beginning of content textarea
    contentTextarea.focus();
    contentTextarea.setSelectionRange(0, 0);
  }

  function updateSelectedClass() {
    const suggestions = suggestionsDiv.querySelectorAll('.noteman-suggestion');
    suggestions.forEach((s, i) => {
      s.classList.toggle('selected', i === selectedIndex);
    });
    // Scroll selected into view
    if (selectedIndex >= 0 && suggestions[selectedIndex]) {
      suggestions[selectedIndex].scrollIntoView({ block: 'nearest' });
    }
  }

  // Event listeners
  destinationInput.addEventListener('focus', updateSuggestions);
  destinationInput.addEventListener('input', () => {
    pageIdInput.value = '';
    updateSuggestions();
  });

  destinationInput.addEventListener('keydown', (e) => {
    const suggestions = suggestionsDiv.querySelectorAll('.noteman-suggestion');

    // Handle digit keys 1-9 to select entries
    if (e.key >= '1' && e.key <= '9' && suggestionsDiv.style.display !== 'none') {
      const index = parseInt(e.key) - 1;
      if (index < currentFilteredPages.length) {
        e.preventDefault();
        const page = currentFilteredPages[index];
        selectPage(page.id, page.title);
        return;
      }
    }

    if (suggestions.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      selectedIndex = Math.min(selectedIndex + 1, suggestions.length - 1);
      updateSelectedClass();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      selectedIndex = Math.max(selectedIndex - 1, 0);
      updateSelectedClass();
    } else if (e.key === 'Enter' && selectedIndex >= 0) {
      e.preventDefault();
      const sel = suggestions[selectedIndex];
      selectPage(sel.dataset.id, sel.dataset.title);
    } else if (e.key === 'Escape') {
      if (suggestionsDiv.style.display !== 'none') {
        suggestionsDiv.style.display = 'none';
        e.stopPropagation();
      }
    }
  });

  suggestionsDiv.addEventListener('click', (e) => {
    const suggestion = e.target.closest('.noteman-suggestion');
    if (suggestion) {
      selectPage(suggestion.dataset.id, suggestion.dataset.title);
    }
  });

  // Hide suggestions when clicking outside
  shadow.addEventListener('click', (e) => {
    if (!e.target.closest('.noteman-field')) {
      suggestionsDiv.style.display = 'none';
    }
  });

  // Close handlers
  cancelBtn.addEventListener('click', closeOverlay);
  closeBtn.addEventListener('click', closeOverlay);
  backdrop.addEventListener('click', closeOverlay);

  // Escape key to close
  function escHandler(e) {
    if (e.key === 'Escape') {
      closeOverlay();
      document.removeEventListener('keydown', escHandler);
    }
  }
  document.addEventListener('keydown', escHandler);

  // Cmd+Enter / Ctrl+Enter to submit from content textarea
  contentTextarea.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      submitBtn.click();
    }
  });

  // Submit handler
  submitBtn.addEventListener('click', async () => {
    const pageId = pageIdInput.value;
    const pageTitle = destinationInput.value;
    const content = contentTextarea.value;

    if (!pageId) {
      showFeedback(shadow, 'Please select a destination page from the dropdown.', 'error');
      return;
    }

    if (!content.trim()) {
      showFeedback(shadow, 'Content is empty.', 'error');
      return;
    }

    // Show loading state
    submitBtn.disabled = true;
    submitBtn.classList.add('loading');
    clearFeedback(shadow);

    try {
      const result = await chrome.runtime.sendMessage({
        action: 'apiRequest',
        url: `${backendUrl}/api/insert`,
        options: {
          method: 'POST',
          body: JSON.stringify({ pageId, pageTitle, content }),
        }
      });

      if (!result.success) {
        throw new Error(result.error || 'Insert failed');
      }

      const data = result.data;
      if (!data.success) {
        throw new Error(data.error || 'Insert failed');
      }

      showFeedback(shadow, 'Note saved successfully!', 'success');

      // Close after brief delay
      setTimeout(closeOverlay, 1200);

    } catch (err) {
      showFeedback(shadow, err.message, 'error');
      submitBtn.disabled = false;
      submitBtn.classList.remove('loading');
    }
  });

  // Focus destination input
  destinationInput.focus();
}

/**
 * Escape attribute value.
 * @param {string} text
 * @returns {string}
 */
function escapeAttr(text) {
  return text.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/**
 * Show feedback message.
 * @param {ShadowRoot} shadow
 * @param {string} message
 * @param {'success' | 'error'} type
 */
function showFeedback(shadow, message, type) {
  const feedback = shadow.getElementById('noteman-feedback');
  feedback.textContent = message;
  feedback.className = type;
}

/**
 * Clear feedback message.
 * @param {ShadowRoot} shadow
 */
function clearFeedback(shadow) {
  const feedback = shadow.getElementById('noteman-feedback');
  feedback.textContent = '';
  feedback.className = '';
}

/**
 * Get overlay CSS styles.
 * @returns {string}
 */
function getOverlayStyles() {
  return `
    #noteman-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      z-index: 2147483647;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      line-height: 1.5;
    }
    * {
      box-sizing: border-box;
    }
    .noteman-backdrop {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
    }
    .noteman-popup {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: white;
      border-radius: 8px;
      box-shadow: 0 4px 24px rgba(0, 0, 0, 0.3);
      width: 420px;
      max-width: 90vw;
      max-height: 85vh;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }
    .noteman-header {
      padding: 14px 16px;
      border-bottom: 1px solid #e5e5e5;
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-shrink: 0;
    }
    .noteman-header h3 {
      margin: 0;
      font-size: 16px;
      font-weight: 600;
      color: #1f2937;
    }
    .noteman-close {
      background: none;
      border: none;
      font-size: 24px;
      cursor: pointer;
      color: #9ca3af;
      padding: 0;
      line-height: 1;
      width: 28px;
      height: 28px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 4px;
    }
    .noteman-close:hover {
      color: #1f2937;
      background: #f3f4f6;
    }
    .noteman-body {
      padding: 16px;
      overflow-y: auto;
      flex: 1;
    }
    .noteman-field {
      margin-bottom: 16px;
      position: relative;
    }
    .noteman-field label {
      display: block;
      margin-bottom: 6px;
      font-size: 13px;
      font-weight: 500;
      color: #374151;
    }
    .noteman-field input[type="text"],
    .noteman-field textarea {
      width: 100%;
      padding: 10px 12px;
      border: 1px solid #d1d5db;
      border-radius: 6px;
      font-size: 14px;
      font-family: inherit;
      background: white;
      color: #1f2937;
    }
    .noteman-field input[type="text"]:focus,
    .noteman-field textarea:focus {
      outline: none;
      border-color: #2563eb;
      box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
    }
    .noteman-field textarea {
      resize: vertical;
      min-height: 140px;
      font-family: 'SF Mono', Monaco, 'Consolas', monospace;
      font-size: 13px;
      line-height: 1.5;
    }
    .noteman-suggestions {
      position: absolute;
      top: 100%;
      left: 0;
      right: 0;
      background: white;
      border: 1px solid #d1d5db;
      border-top: none;
      border-radius: 0 0 6px 6px;
      max-height: 200px;
      overflow-y: auto;
      display: none;
      z-index: 10;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    }
    .noteman-suggestion {
      padding: 10px 12px;
      cursor: pointer;
      font-size: 13px;
      border-bottom: 1px solid #f3f4f6;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .noteman-suggestion:last-child {
      border-bottom: none;
    }
    .noteman-suggestion:hover {
      background: #f3f4f6;
    }
    .noteman-suggestion.selected {
      background: #e0e7ff;
    }
    .noteman-suggestion .badge {
      font-size: 10px;
      padding: 2px 6px;
      border-radius: 4px;
      text-transform: uppercase;
      font-weight: 500;
      flex-shrink: 0;
    }
    .noteman-suggestion .badge.recent {
      background: #e0e7ff;
      color: #3730a3;
    }
    .noteman-suggestion .badge.whitelist {
      background: #dcfce7;
      color: #166534;
    }
    .noteman-suggestion .number {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 18px;
      height: 18px;
      background: #e5e7eb;
      color: #374151;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 600;
      flex-shrink: 0;
    }
    .noteman-actions {
      display: flex;
      gap: 10px;
      justify-content: flex-end;
    }
    .noteman-btn-primary,
    .noteman-btn-secondary {
      padding: 10px 18px;
      border-radius: 6px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      border: none;
      transition: background 0.15s;
    }
    .noteman-btn-primary {
      background: #2563eb;
      color: white;
      position: relative;
    }
    .noteman-btn-primary:hover:not(:disabled) {
      background: #1d4ed8;
    }
    .noteman-btn-secondary {
      background: #f3f4f6;
      color: #374151;
    }
    .noteman-btn-secondary:hover {
      background: #e5e7eb;
    }
    .noteman-btn-primary:disabled {
      background: #93c5fd;
      cursor: not-allowed;
    }
    .noteman-btn-primary .noteman-spinner {
      display: none;
    }
    .noteman-btn-primary.loading .noteman-btn-text {
      visibility: hidden;
    }
    .noteman-btn-primary.loading .noteman-spinner {
      display: block;
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 16px;
      height: 16px;
      border: 2px solid transparent;
      border-top-color: white;
      border-radius: 50%;
      animation: noteman-spin 0.8s linear infinite;
    }
    @keyframes noteman-spin {
      to { transform: translate(-50%, -50%) rotate(360deg); }
    }
    #noteman-feedback {
      margin-top: 14px;
      padding: 10px 12px;
      border-radius: 6px;
      font-size: 13px;
    }
    #noteman-feedback:empty {
      display: none;
    }
    #noteman-feedback.success {
      background: #d1fae5;
      color: #065f46;
    }
    #noteman-feedback.error {
      background: #fee2e2;
      color: #991b1b;
    }
  `;
}
