/**
 * Background service worker for Noteman Clipper extension.
 * Handles keyboard shortcut commands and message passing.
 */

// Listen for keyboard shortcut command
chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'capture-selection') {
    // Get the active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab?.id) {
      console.log('No active tab found');
      return;
    }

    // Check if we can inject into this tab
    if (tab.url?.startsWith('chrome://') || tab.url?.startsWith('chrome-extension://')) {
      console.log('Cannot inject into Chrome internal pages');
      return;
    }

    // Send message to content script to capture selection and show overlay
    try {
      await chrome.tabs.sendMessage(tab.id, { action: 'captureSelection' });
    } catch (err) {
      console.log('Failed to send message to content script:', err);
      // Content script might not be loaded yet, try injecting it
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['html-to-markdown.js', 'content.js']
        });
        // Try sending the message again
        await chrome.tabs.sendMessage(tab.id, { action: 'captureSelection' });
      } catch (injectErr) {
        console.log('Failed to inject content script:', injectErr);
      }
    }
  }
});

// Handle messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'getBackendUrl') {
    chrome.storage.sync.get(['backendUrl'], (result) => {
      sendResponse({ backendUrl: result.backendUrl || '' });
    });
    return true; // Indicates async response
  }

  if (message.action === 'openOptions') {
    chrome.runtime.openOptionsPage();
    sendResponse({ success: true });
    return false;
  }

  // Proxy API calls through background script to avoid CORS issues
  if (message.action === 'apiRequest') {
    handleApiRequest(message.url, message.options)
      .then(data => sendResponse({ success: true, data }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true; // Indicates async response
  }
});

/**
 * Handle API requests from content script.
 * @param {string} url
 * @param {RequestInit} options
 * @returns {Promise<any>}
 */
async function handleApiRequest(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const text = await response.text();
    let error;
    try {
      const json = JSON.parse(text);
      error = json.error || `HTTP ${response.status}`;
    } catch {
      error = `HTTP ${response.status}`;
    }
    throw new Error(error);
  }

  return response.json();
}

// Show welcome page on install
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    // Open options page to configure backend URL
    chrome.runtime.openOptionsPage();
  }
});
