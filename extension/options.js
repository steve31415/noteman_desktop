/**
 * Options page script for Noteman Clipper extension.
 */

document.addEventListener('DOMContentLoaded', () => {
  const urlInput = document.getElementById('backendUrl');
  const passwordInput = document.getElementById('password');
  const saveBtn = document.getElementById('save');
  const testBtn = document.getElementById('test');
  const status = document.getElementById('status');
  const shortcutsLink = document.getElementById('shortcuts-link');

  // Handle shortcuts link - can't navigate to chrome:// URLs directly
  shortcutsLink.addEventListener('click', (e) => {
    e.preventDefault();
    // Open Chrome's extensions shortcuts page
    chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
  });

  // Load saved settings
  chrome.storage.sync.get(['backendUrl', 'password'], (result) => {
    if (result.backendUrl) {
      urlInput.value = result.backendUrl;
    }
    if (result.password) {
      passwordInput.value = result.password;
    }
  });

  // Save settings
  saveBtn.addEventListener('click', async () => {
    const url = normalizeUrl(urlInput.value);
    const password = passwordInput.value;

    if (!url) {
      showStatus('Please enter a URL', 'error');
      return;
    }

    if (!isValidUrl(url)) {
      showStatus('Please enter a valid URL (must start with https://)', 'error');
      return;
    }

    showStatus('Testing connection...', 'loading');
    saveBtn.disabled = true;

    try {
      const isValid = await testBackendConnection(url, password);
      if (!isValid) {
        showStatus('Could not connect to backend. Check the URL and password.', 'error');
        saveBtn.disabled = false;
        return;
      }

      // Save URL and password
      chrome.storage.sync.set({ backendUrl: url, password: password }, () => {
        showStatus('Settings saved successfully!', 'success');
        saveBtn.disabled = false;
      });
    } catch (err) {
      showStatus(`Connection failed: ${err.message}`, 'error');
      saveBtn.disabled = false;
    }
  });

  // Test connection without saving
  testBtn.addEventListener('click', async () => {
    const url = normalizeUrl(urlInput.value);
    const password = passwordInput.value;

    if (!url) {
      showStatus('Please enter a URL first', 'error');
      return;
    }

    if (!isValidUrl(url)) {
      showStatus('Please enter a valid URL (must start with https://)', 'error');
      return;
    }

    showStatus('Testing connection...', 'loading');
    testBtn.disabled = true;

    try {
      const isValid = await testBackendConnection(url, password);
      if (isValid) {
        showStatus('Connection successful! Backend is reachable.', 'success');
      } else {
        showStatus('Backend responded but may not be configured correctly.', 'error');
      }
    } catch (err) {
      showStatus(`Connection failed: ${err.message}`, 'error');
    } finally {
      testBtn.disabled = false;
    }
  });

  /**
   * Normalize URL: trim whitespace and remove trailing slash.
   * @param {string} url
   * @returns {string}
   */
  function normalizeUrl(url) {
    return url.trim().replace(/\/+$/, '');
  }

  /**
   * Check if URL is valid and uses HTTPS.
   * @param {string} url
   * @returns {boolean}
   */
  function isValidUrl(url) {
    try {
      const parsed = new URL(url);
      return parsed.protocol === 'https:';
    } catch {
      return false;
    }
  }

  /**
   * Test connection to the backend by calling the recent-pages API.
   * @param {string} url
   * @param {string} password
   * @returns {Promise<boolean>}
   */
  async function testBackendConnection(url, password) {
    const headers = {
      'Accept': 'application/json',
    };

    if (password) {
      headers['Authorization'] = 'Basic ' + btoa(':' + password);
    }

    const response = await fetch(`${url}/api/recent-pages`, {
      method: 'GET',
      headers: headers,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    // Check that response has expected structure
    return Array.isArray(data.pages);
  }

  /**
   * Show status message.
   * @param {string} message
   * @param {'success' | 'error' | 'loading'} type
   */
  function showStatus(message, type) {
    status.textContent = message;
    status.className = `status ${type}`;
  }
});
