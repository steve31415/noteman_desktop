/**
 * HTML to Markdown converter for Chrome extension.
 * Design principle: always produce usable output - never throw, always return text.
 */

/**
 * Convert HTML string to Markdown.
 * @param {string} html - HTML string to convert
 * @returns {string} - Markdown string
 */
function htmlToMarkdown(html) {
  if (!html || typeof html !== 'string') {
    return '';
  }

  try {
    const temp = document.createElement('div');
    temp.innerHTML = html;
    return processNode(temp).trim();
  } catch (e) {
    // Fallback: strip all HTML and return plain text
    return stripHtml(html);
  }
}

/**
 * Strip HTML tags and return plain text.
 * @param {string} html
 * @returns {string}
 */
function stripHtml(html) {
  try {
    const temp = document.createElement('div');
    temp.innerHTML = html;
    return temp.textContent || temp.innerText || '';
  } catch (e) {
    // Last resort: regex strip
    return html.replace(/<[^>]*>/g, '');
  }
}

/**
 * Process a DOM node and its children recursively.
 * @param {Node} node
 * @returns {string}
 */
function processNode(node) {
  let result = '';

  for (const child of node.childNodes) {
    if (child.nodeType === Node.TEXT_NODE) {
      result += child.textContent;
    } else if (child.nodeType === Node.ELEMENT_NODE) {
      result += processElement(child);
    }
    // Ignore other node types (comments, etc.)
  }

  return result;
}

/**
 * Process a single element node.
 * @param {Element} el
 * @returns {string}
 */
function processElement(el) {
  const tag = el.tagName.toLowerCase();

  switch (tag) {
    // Inline formatting
    case 'strong':
    case 'b':
      return `**${processNode(el)}**`;

    case 'em':
    case 'i':
      return `*${processNode(el)}*`;

    case 'code':
      // Check if it's inside a pre (code block) - handled by pre case
      if (el.parentElement && el.parentElement.tagName.toLowerCase() === 'pre') {
        return processNode(el);
      }
      return `\`${processNode(el)}\``;

    case 'a': {
      const href = el.getAttribute('href');
      const text = processNode(el);
      if (href && !href.startsWith('javascript:')) {
        return `[${text}](${href})`;
      }
      return text;
    }

    case 'br':
      return '\n';

    // Block elements
    case 'p':
      return processNode(el) + '\n\n';

    case 'div':
      return processNode(el) + '\n';

    case 'h1':
      return `# ${processNode(el)}\n\n`;

    case 'h2':
      return `## ${processNode(el)}\n\n`;

    case 'h3':
      return `### ${processNode(el)}\n\n`;

    case 'h4':
      return `#### ${processNode(el)}\n\n`;

    case 'h5':
      return `##### ${processNode(el)}\n\n`;

    case 'h6':
      return `###### ${processNode(el)}\n\n`;

    case 'ul':
      return processList(el, 'ul') + '\n';

    case 'ol':
      return processList(el, 'ol') + '\n';

    case 'li':
      // Handled by processList
      return processNode(el);

    case 'pre': {
      const codeEl = el.querySelector('code');
      const lang = codeEl ? (codeEl.className.match(/language-(\w+)/)?.[1] || '') : '';
      const code = codeEl ? codeEl.textContent : el.textContent;
      return `\n\`\`\`${lang}\n${code}\n\`\`\`\n`;
    }

    case 'blockquote': {
      const inner = processNode(el).trim();
      const lines = inner.split('\n').map(line => `> ${line}`);
      return lines.join('\n') + '\n\n';
    }

    case 'hr':
      return '\n---\n\n';

    // Ignored elements (don't render anything)
    case 'script':
    case 'style':
    case 'noscript':
    case 'template':
      return '';

    // For images, show alt text or URL
    case 'img': {
      const alt = el.getAttribute('alt') || '';
      const src = el.getAttribute('src') || '';
      if (alt) return `[${alt}]`;
      if (src) return `[image: ${src}]`;
      return '';
    }

    // Tables - simplified conversion
    case 'table':
      return processTable(el) + '\n\n';

    case 'tr':
    case 'td':
    case 'th':
    case 'thead':
    case 'tbody':
    case 'tfoot':
      // Handled by processTable
      return processNode(el);

    // Default: just extract text content
    default:
      return processNode(el);
  }
}

/**
 * Process a list (ul or ol).
 * @param {Element} listEl
 * @param {'ul' | 'ol'} type
 * @returns {string}
 */
function processList(listEl, type) {
  let result = '';
  let index = 1;

  for (const child of listEl.children) {
    if (child.tagName.toLowerCase() === 'li') {
      const prefix = type === 'ol' ? `${index}. ` : '- ';
      const content = processNode(child).trim();
      result += prefix + content + '\n';
      index++;
    }
  }

  return result;
}

/**
 * Process a table into markdown format.
 * @param {Element} tableEl
 * @returns {string}
 */
function processTable(tableEl) {
  const rows = [];
  let maxCols = 0;

  // Collect all rows
  const trElements = tableEl.querySelectorAll('tr');
  for (const tr of trElements) {
    const cells = [];
    for (const cell of tr.children) {
      if (cell.tagName.toLowerCase() === 'td' || cell.tagName.toLowerCase() === 'th') {
        cells.push(processNode(cell).trim().replace(/\|/g, '\\|'));
      }
    }
    if (cells.length > 0) {
      rows.push(cells);
      maxCols = Math.max(maxCols, cells.length);
    }
  }

  if (rows.length === 0) {
    return '';
  }

  // Normalize row lengths
  for (const row of rows) {
    while (row.length < maxCols) {
      row.push('');
    }
  }

  // Build markdown table
  let result = '| ' + rows[0].join(' | ') + ' |\n';
  result += '| ' + rows[0].map(() => '---').join(' | ') + ' |\n';

  for (let i = 1; i < rows.length; i++) {
    result += '| ' + rows[i].join(' | ') + ' |\n';
  }

  return result;
}

// Export for testing (if running in Node.js)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { htmlToMarkdown, stripHtml };
}
