import type { BlockObjectRequest } from '@notionhq/client/build/src/api-endpoints';

// Rich text item type for Notion API
interface RichTextItem {
  type: 'text';
  text: {
    content: string;
    link?: { url: string };
  };
  annotations?: {
    bold: boolean;
    italic: boolean;
    code: boolean;
    strikethrough: boolean;
    underline: boolean;
    color: 'default';
  };
}

// Notion supported languages
type NotionLanguage =
  | 'abap' | 'arduino' | 'bash' | 'basic' | 'c' | 'clojure' | 'coffeescript'
  | 'cpp' | 'csharp' | 'css' | 'dart' | 'diff' | 'docker' | 'elixir' | 'elm'
  | 'erlang' | 'flow' | 'fortran' | 'fsharp' | 'gherkin' | 'glsl' | 'go'
  | 'graphql' | 'groovy' | 'haskell' | 'html' | 'java' | 'javascript' | 'json'
  | 'julia' | 'kotlin' | 'latex' | 'less' | 'lisp' | 'livescript' | 'lua'
  | 'makefile' | 'markdown' | 'markup' | 'matlab' | 'mermaid' | 'nix' | 'objective-c'
  | 'ocaml' | 'pascal' | 'perl' | 'php' | 'plain text' | 'powershell' | 'prolog'
  | 'protobuf' | 'python' | 'r' | 'reason' | 'ruby' | 'rust' | 'sass' | 'scala'
  | 'scheme' | 'scss' | 'shell' | 'sql' | 'swift' | 'typescript' | 'vb.net'
  | 'verilog' | 'vhdl' | 'visual basic' | 'webassembly' | 'xml' | 'yaml';

/**
 * Convert Markdown text to Notion blocks.
 */
export function markdownToBlocks(markdown: string): BlockObjectRequest[] {
  const lines = markdown.split('\n');
  const blocks: BlockObjectRequest[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Skip empty lines
    if (line.trim() === '') {
      i++;
      continue;
    }

    // Code block (```language ... ```)
    if (line.startsWith('```')) {
      const language = line.slice(3).trim() || 'plain text';
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // Skip closing ```
      blocks.push({
        type: 'code',
        code: {
          rich_text: [{ type: 'text', text: { content: codeLines.join('\n') } }],
          language: mapLanguage(language) as 'javascript', // Type assertion for SDK compatibility
        },
      } as BlockObjectRequest);
      continue;
    }

    // Heading 1 (# )
    if (line.startsWith('# ')) {
      blocks.push({
        type: 'heading_1',
        heading_1: { rich_text: parseInlineFormatting(line.slice(2)) },
      });
      i++;
      continue;
    }

    // Heading 2 (## )
    if (line.startsWith('## ')) {
      blocks.push({
        type: 'heading_2',
        heading_2: { rich_text: parseInlineFormatting(line.slice(3)) },
      });
      i++;
      continue;
    }

    // Heading 3 (### )
    if (line.startsWith('### ')) {
      blocks.push({
        type: 'heading_3',
        heading_3: { rich_text: parseInlineFormatting(line.slice(4)) },
      });
      i++;
      continue;
    }

    // Bullet list (- or * )
    if (/^[-*]\s/.test(line)) {
      // Parse bullet items one at a time, checking for nested content
      while (i < lines.length && /^[-*]\s/.test(lines[i])) {
        const itemText = lines[i].slice(2);
        i++;

        // Check for nested content (indented bullets or blockquotes)
        const children: BlockObjectRequest[] = [];

        // Check for indented bullets (  - item or  * item)
        while (i < lines.length && /^\s{2,}[-*]\s/.test(lines[i])) {
          const subItemText = lines[i].replace(/^\s{2,}[-*]\s/, '');
          children.push({
            type: 'bulleted_list_item',
            bulleted_list_item: { rich_text: parseInlineFormatting(subItemText) },
          });
          i++;
        }

        // Check for indented blockquotes following this item (  > content)
        const nestedQuoteLines: string[] = [];
        while (i < lines.length && /^\s+>\s?/.test(lines[i])) {
          // Extract the content after the indented > marker
          const quoteContent = lines[i].replace(/^\s+>\s?/, '');
          nestedQuoteLines.push(quoteContent);
          i++;
        }

        if (nestedQuoteLines.length > 0) {
          children.push({
            type: 'quote',
            quote: { rich_text: parseInlineFormatting(nestedQuoteLines.join('\n')) },
          });
        }

        if (children.length > 0) {
          // Create bullet item with nested children
          blocks.push({
            type: 'bulleted_list_item',
            bulleted_list_item: {
              rich_text: parseInlineFormatting(itemText),
              children,
            },
          } as BlockObjectRequest);
        } else {
          blocks.push({
            type: 'bulleted_list_item',
            bulleted_list_item: { rich_text: parseInlineFormatting(itemText) },
          });
        }
      }
      continue;
    }

    // Numbered list (1. , 2. , etc.)
    if (/^\d+\.\s/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\.\s/, ''));
        i++;
      }
      for (const item of items) {
        blocks.push({
          type: 'numbered_list_item',
          numbered_list_item: { rich_text: parseInlineFormatting(item) },
        });
      }
      continue;
    }

    // Blockquote (> )
    if (line.startsWith('> ')) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].startsWith('> ')) {
        quoteLines.push(lines[i].slice(2));
        i++;
      }
      blocks.push({
        type: 'quote',
        quote: { rich_text: parseInlineFormatting(quoteLines.join('\n')) },
      } as BlockObjectRequest);
      continue;
    }

    // Regular paragraph - collect consecutive non-special lines
    const paragraphLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !lines[i].startsWith('#') &&
      !lines[i].startsWith('```') &&
      !lines[i].startsWith('> ') &&
      !/^[-*]\s/.test(lines[i]) &&
      !/^\d+\.\s/.test(lines[i])
    ) {
      paragraphLines.push(lines[i]);
      i++;
    }

    if (paragraphLines.length > 0) {
      blocks.push({
        type: 'paragraph',
        paragraph: { rich_text: parseInlineFormatting(paragraphLines.join(' ')) },
      });
    }
  }

  return blocks;
}

/**
 * Parse inline formatting (bold, italic, code, links) into Notion rich text.
 */
function parseInlineFormatting(text: string): RichTextItem[] {
  const result: RichTextItem[] = [];

  // Pattern to match inline elements
  // Order matters: check combined bold+italic first, then individual
  const patterns = [
    { regex: /\*\*\*(.+?)\*\*\*/g, bold: true, italic: true },       // ***bold italic***
    { regex: /\*\*(.+?)\*\*/g, bold: true, italic: false },          // **bold**
    { regex: /\*(.+?)\*/g, bold: false, italic: true },              // *italic*
    { regex: /_(.+?)_/g, bold: false, italic: true },                // _italic_
    { regex: /`(.+?)`/g, code: true },                               // `code`
    { regex: /\[(.+?)\]\((.+?)\)/g, link: true },                    // [text](url)
  ];

  // Use a simpler approach: split by patterns and track positions
  interface Segment {
    text: string;
    bold?: boolean;
    italic?: boolean;
    code?: boolean;
    link?: string;
    start: number;
    end: number;
  }

  const segments: Segment[] = [];
  let remaining = text;
  let offset = 0;

  // Find all formatted segments
  const allMatches: Array<{
    start: number;
    end: number;
    content: string;
    bold?: boolean;
    italic?: boolean;
    code?: boolean;
    link?: string;
  }> = [];

  // Bold italic ***text***
  for (const match of text.matchAll(/\*\*\*(.+?)\*\*\*/g)) {
    allMatches.push({
      start: match.index!,
      end: match.index! + match[0].length,
      content: match[1],
      bold: true,
      italic: true,
    });
  }

  // Bold **text**
  for (const match of text.matchAll(/\*\*(.+?)\*\*/g)) {
    // Skip if already matched as bold italic
    if (!allMatches.some(m => m.start <= match.index! && m.end >= match.index! + match[0].length)) {
      allMatches.push({
        start: match.index!,
        end: match.index! + match[0].length,
        content: match[1],
        bold: true,
      });
    }
  }

  // Italic *text* or _text_
  for (const match of text.matchAll(/(?<!\*)\*([^*]+?)\*(?!\*)/g)) {
    if (!allMatches.some(m => m.start <= match.index! && m.end >= match.index! + match[0].length)) {
      allMatches.push({
        start: match.index!,
        end: match.index! + match[0].length,
        content: match[1],
        italic: true,
      });
    }
  }
  for (const match of text.matchAll(/_(.+?)_/g)) {
    if (!allMatches.some(m => m.start <= match.index! && m.end >= match.index! + match[0].length)) {
      allMatches.push({
        start: match.index!,
        end: match.index! + match[0].length,
        content: match[1],
        italic: true,
      });
    }
  }

  // Inline code `text`
  for (const match of text.matchAll(/`(.+?)`/g)) {
    if (!allMatches.some(m => m.start <= match.index! && m.end >= match.index! + match[0].length)) {
      allMatches.push({
        start: match.index!,
        end: match.index! + match[0].length,
        content: match[1],
        code: true,
      });
    }
  }

  // Links [text](url)
  for (const match of text.matchAll(/\[(.+?)\]\((.+?)\)/g)) {
    if (!allMatches.some(m => m.start <= match.index! && m.end >= match.index! + match[0].length)) {
      allMatches.push({
        start: match.index!,
        end: match.index! + match[0].length,
        content: match[1],
        link: match[2],
      });
    }
  }

  // Sort by start position
  allMatches.sort((a, b) => a.start - b.start);

  // Build result from matches
  let pos = 0;
  for (const match of allMatches) {
    // Skip overlapping matches
    if (match.start < pos) continue;

    // Add plain text before this match
    if (match.start > pos) {
      const plainText = text.slice(pos, match.start);
      if (plainText) {
        result.push({ type: 'text', text: { content: plainText } });
      }
    }

    // Add the formatted segment
    const richText: RichTextItem = {
      type: 'text',
      text: { content: match.content },
      annotations: {
        bold: match.bold ?? false,
        italic: match.italic ?? false,
        code: match.code ?? false,
        strikethrough: false,
        underline: false,
        color: 'default',
      },
    };

    if (match.link) {
      richText.text.link = { url: match.link };
    }

    result.push(richText);
    pos = match.end;
  }

  // Add remaining plain text
  if (pos < text.length) {
    result.push({ type: 'text', text: { content: text.slice(pos) } });
  }

  // If no segments were found, return the whole text as plain
  if (result.length === 0) {
    result.push({ type: 'text', text: { content: text } });
  }

  return result;
}

/**
 * Map common language names to Notion's supported languages.
 */
function mapLanguage(lang: string): NotionLanguage {
  const normalized = lang.toLowerCase();
  const mapping: Record<string, NotionLanguage> = {
    'js': 'javascript',
    'ts': 'typescript',
    'py': 'python',
    'rb': 'ruby',
    'sh': 'bash',
    'yml': 'yaml',
    'md': 'markdown',
  };

  const validLanguages: Set<string> = new Set([
    'abap', 'arduino', 'bash', 'basic', 'c', 'clojure', 'coffeescript',
    'cpp', 'csharp', 'css', 'dart', 'diff', 'docker', 'elixir', 'elm',
    'erlang', 'flow', 'fortran', 'fsharp', 'gherkin', 'glsl', 'go',
    'graphql', 'groovy', 'haskell', 'html', 'java', 'javascript', 'json',
    'julia', 'kotlin', 'latex', 'less', 'lisp', 'livescript', 'lua',
    'makefile', 'markdown', 'markup', 'matlab', 'mermaid', 'nix', 'objective-c',
    'ocaml', 'pascal', 'perl', 'php', 'plain text', 'powershell', 'prolog',
    'protobuf', 'python', 'r', 'reason', 'ruby', 'rust', 'sass', 'scala',
    'scheme', 'scss', 'shell', 'sql', 'swift', 'typescript', 'vb.net',
    'verilog', 'vhdl', 'visual basic', 'webassembly', 'xml', 'yaml'
  ]);

  const mapped = mapping[normalized] || normalized;
  return validLanguages.has(mapped) ? mapped as NotionLanguage : 'plain text';
}
