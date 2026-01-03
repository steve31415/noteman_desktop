/**
 * Tests for html-to-markdown.js
 * Uses jsdom for DOM simulation in Node.js
 */

const { JSDOM } = require('jsdom');

// Set up DOM environment before requiring the module
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
global.document = dom.window.document;
global.Node = dom.window.Node;

const { htmlToMarkdown, stripHtml } = require('../html-to-markdown.js');

// Test runner
let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (e) {
    console.log(`  ✗ ${name}`);
    console.log(`    ${e.message}`);
    failed++;
  }
}

function assertEqual(actual, expected) {
  if (actual !== expected) {
    throw new Error(`Expected:\n"${expected}"\n\nGot:\n"${actual}"`);
  }
}

function assertContains(actual, substring) {
  if (!actual.includes(substring)) {
    throw new Error(`Expected "${actual}" to contain "${substring}"`);
  }
}

// ============ Basic Formatting Tests ============
console.log('\nBasic Formatting:');

test('bold with <strong>', () => {
  assertEqual(htmlToMarkdown('<strong>bold text</strong>'), '**bold text**');
});

test('bold with <b>', () => {
  assertEqual(htmlToMarkdown('<b>bold text</b>'), '**bold text**');
});

test('italic with <em>', () => {
  assertEqual(htmlToMarkdown('<em>italic text</em>'), '*italic text*');
});

test('italic with <i>', () => {
  assertEqual(htmlToMarkdown('<i>italic text</i>'), '*italic text*');
});

test('inline code', () => {
  assertEqual(htmlToMarkdown('<code>const x = 1</code>'), '`const x = 1`');
});

test('link with href', () => {
  assertEqual(htmlToMarkdown('<a href="https://example.com">link</a>'), '[link](https://example.com)');
});

test('link without href', () => {
  assertEqual(htmlToMarkdown('<a>just text</a>'), 'just text');
});

test('line break', () => {
  assertEqual(htmlToMarkdown('line1<br>line2'), 'line1\nline2');
});

// ============ Block Elements Tests ============
console.log('\nBlock Elements:');

test('paragraph', () => {
  assertEqual(htmlToMarkdown('<p>A paragraph.</p>'), 'A paragraph.');
});

test('heading 1', () => {
  assertEqual(htmlToMarkdown('<h1>Title</h1>'), '# Title');
});

test('heading 2', () => {
  assertEqual(htmlToMarkdown('<h2>Subtitle</h2>'), '## Subtitle');
});

test('heading 3', () => {
  assertEqual(htmlToMarkdown('<h3>Section</h3>'), '### Section');
});

test('unordered list', () => {
  const html = '<ul><li>Item 1</li><li>Item 2</li></ul>';
  assertEqual(htmlToMarkdown(html), '- Item 1\n- Item 2');
});

test('ordered list', () => {
  const html = '<ol><li>First</li><li>Second</li></ol>';
  assertEqual(htmlToMarkdown(html), '1. First\n2. Second');
});

test('code block with pre and code', () => {
  const html = '<pre><code class="language-javascript">function test() {}</code></pre>';
  assertContains(htmlToMarkdown(html), '```javascript\nfunction test() {}\n```');
});

test('code block without language', () => {
  const html = '<pre><code>plain code</code></pre>';
  assertContains(htmlToMarkdown(html), '```\nplain code\n```');
});

test('blockquote', () => {
  const html = '<blockquote>A quote</blockquote>';
  assertContains(htmlToMarkdown(html), '> A quote');
});

test('horizontal rule', () => {
  assertEqual(htmlToMarkdown('<hr>'), '---');
});

// ============ Nested Formatting Tests ============
console.log('\nNested Formatting:');

test('bold inside italic', () => {
  assertEqual(htmlToMarkdown('<em><strong>bold italic</strong></em>'), '***bold italic***');
});

test('link with bold text', () => {
  assertEqual(
    htmlToMarkdown('<a href="https://example.com"><strong>bold link</strong></a>'),
    '[**bold link**](https://example.com)'
  );
});

test('paragraph with mixed formatting', () => {
  const html = '<p>Normal <strong>bold</strong> and <em>italic</em> text</p>';
  assertEqual(htmlToMarkdown(html), 'Normal **bold** and *italic* text');
});

test('list with formatted items', () => {
  const html = '<ul><li><strong>Bold item</strong></li><li><em>Italic item</em></li></ul>';
  assertEqual(htmlToMarkdown(html), '- **Bold item**\n- *Italic item*');
});

// ============ Edge Cases Tests ============
console.log('\nEdge Cases:');

test('empty input', () => {
  assertEqual(htmlToMarkdown(''), '');
});

test('null input', () => {
  assertEqual(htmlToMarkdown(null), '');
});

test('undefined input', () => {
  assertEqual(htmlToMarkdown(undefined), '');
});

test('plain text (no HTML)', () => {
  assertEqual(htmlToMarkdown('Just plain text'), 'Just plain text');
});

test('unknown tag - extracts text content', () => {
  assertEqual(htmlToMarkdown('<custom-element>text inside</custom-element>'), 'text inside');
});

test('nested unknown tags', () => {
  assertEqual(htmlToMarkdown('<foo><bar>deep text</bar></foo>'), 'deep text');
});

test('script tags are ignored', () => {
  assertEqual(htmlToMarkdown('<script>alert("xss")</script>visible'), 'visible');
});

test('style tags are ignored', () => {
  assertEqual(htmlToMarkdown('<style>.class{}</style>visible'), 'visible');
});

test('image with alt text', () => {
  assertEqual(htmlToMarkdown('<img alt="An image" src="test.jpg">'), '[An image]');
});

test('whitespace handling', () => {
  const html = '<p>  spaced   text  </p>';
  assertContains(htmlToMarkdown(html), 'spaced   text');
});

// ============ Table Tests ============
console.log('\nTables:');

test('simple table', () => {
  const html = '<table><tr><th>Header</th></tr><tr><td>Cell</td></tr></table>';
  const md = htmlToMarkdown(html);
  assertContains(md, '| Header |');
  assertContains(md, '| --- |');
  assertContains(md, '| Cell |');
});

test('table with multiple columns', () => {
  const html = '<table><tr><th>A</th><th>B</th></tr><tr><td>1</td><td>2</td></tr></table>';
  const md = htmlToMarkdown(html);
  assertContains(md, '| A | B |');
  assertContains(md, '| 1 | 2 |');
});

// ============ Real-World Samples ============
console.log('\nReal-World Samples:');

test('Wikipedia-style content', () => {
  const html = `
    <p><b>JavaScript</b> is a <a href="https://en.wikipedia.org/wiki/Programming_language">programming language</a>
    that is one of the core technologies of the <a href="https://en.wikipedia.org/wiki/World_Wide_Web">World Wide Web</a>.</p>
  `;
  const md = htmlToMarkdown(html);
  assertContains(md, '**JavaScript**');
  assertContains(md, '[programming language](https://en.wikipedia.org/wiki/Programming_language)');
});

test('GitHub-style code block', () => {
  const html = `
    <div class="highlight">
      <pre><code class="language-python">def hello():
    print("Hello, World!")</code></pre>
    </div>
  `;
  const md = htmlToMarkdown(html);
  assertContains(md, '```python');
  assertContains(md, 'def hello()');
});

test('news article excerpt', () => {
  const html = `
    <article>
      <h2>Breaking News</h2>
      <p>Something <strong>important</strong> happened today.</p>
      <blockquote>This is a quote from someone.</blockquote>
    </article>
  `;
  const md = htmlToMarkdown(html);
  assertContains(md, '## Breaking News');
  assertContains(md, '**important**');
  assertContains(md, '> This is a quote');
});

// ============ stripHtml Tests ============
console.log('\nstripHtml:');

test('stripHtml removes all tags', () => {
  assertEqual(stripHtml('<p>Hello <strong>world</strong>!</p>'), 'Hello world!');
});

test('stripHtml handles empty input', () => {
  assertEqual(stripHtml(''), '');
});

// ============ Summary ============
console.log('\n' + '='.repeat(40));
console.log(`Tests: ${passed} passed, ${failed} failed`);
console.log('='.repeat(40));

if (failed > 0) {
  process.exit(1);
}
