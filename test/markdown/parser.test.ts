import { describe, it, expect } from 'vitest';
import { markdownToBlocks } from '../../src/markdown/parser';

describe('markdownToBlocks', () => {
  it('converts a simple paragraph', () => {
    const blocks = markdownToBlocks('Hello world');
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe('paragraph');
    expect((blocks[0] as any).paragraph.rich_text[0].text.content).toBe('Hello world');
  });

  it('converts multiple paragraphs', () => {
    const blocks = markdownToBlocks('First paragraph\n\nSecond paragraph');
    expect(blocks).toHaveLength(2);
    expect(blocks[0].type).toBe('paragraph');
    expect(blocks[1].type).toBe('paragraph');
  });

  it('converts heading 1', () => {
    const blocks = markdownToBlocks('# Heading One');
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe('heading_1');
    expect((blocks[0] as any).heading_1.rich_text[0].text.content).toBe('Heading One');
  });

  it('converts heading 2', () => {
    const blocks = markdownToBlocks('## Heading Two');
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe('heading_2');
  });

  it('converts heading 3', () => {
    const blocks = markdownToBlocks('### Heading Three');
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe('heading_3');
  });

  it('converts bullet list', () => {
    const blocks = markdownToBlocks('- Item one\n- Item two\n- Item three');
    expect(blocks).toHaveLength(3);
    expect(blocks[0].type).toBe('bulleted_list_item');
    expect(blocks[1].type).toBe('bulleted_list_item');
    expect(blocks[2].type).toBe('bulleted_list_item');
  });

  it('converts numbered list', () => {
    const blocks = markdownToBlocks('1. First\n2. Second\n3. Third');
    expect(blocks).toHaveLength(3);
    expect(blocks[0].type).toBe('numbered_list_item');
    expect(blocks[1].type).toBe('numbered_list_item');
    expect(blocks[2].type).toBe('numbered_list_item');
  });

  it('converts code block', () => {
    const blocks = markdownToBlocks('```javascript\nconsole.log("hello");\n```');
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe('code');
    expect((blocks[0] as any).code.rich_text[0].text.content).toBe('console.log("hello");');
  });

  it('converts bold text', () => {
    const blocks = markdownToBlocks('This is **bold** text');
    expect(blocks).toHaveLength(1);
    const richText = (blocks[0] as any).paragraph.rich_text;
    expect(richText).toHaveLength(3);
    expect(richText[0].text.content).toBe('This is ');
    expect(richText[1].text.content).toBe('bold');
    expect(richText[1].annotations.bold).toBe(true);
    expect(richText[2].text.content).toBe(' text');
  });

  it('converts italic text', () => {
    const blocks = markdownToBlocks('This is *italic* text');
    expect(blocks).toHaveLength(1);
    const richText = (blocks[0] as any).paragraph.rich_text;
    expect(richText).toHaveLength(3);
    expect(richText[1].text.content).toBe('italic');
    expect(richText[1].annotations.italic).toBe(true);
  });

  it('converts inline code', () => {
    const blocks = markdownToBlocks('Use the `console.log` function');
    expect(blocks).toHaveLength(1);
    const richText = (blocks[0] as any).paragraph.rich_text;
    expect(richText.some((rt: any) => rt.annotations?.code === true)).toBe(true);
  });

  it('converts links', () => {
    const blocks = markdownToBlocks('Check out [this link](https://example.com)');
    expect(blocks).toHaveLength(1);
    const richText = (blocks[0] as any).paragraph.rich_text;
    expect(richText.some((rt: any) => rt.text.link?.url === 'https://example.com')).toBe(true);
  });

  it('handles mixed content', () => {
    const markdown = `# Title

This is a paragraph with **bold** and *italic* text.

- List item one
- List item two

\`\`\`python
print("hello")
\`\`\`
`;
    const blocks = markdownToBlocks(markdown);
    expect(blocks.map((b) => b.type)).toEqual([
      'heading_1',
      'paragraph',
      'bulleted_list_item',
      'bulleted_list_item',
      'code',
    ]);
  });

  it('converts indented blockquote under bullet item', () => {
    const markdown = `- [Page Title](https://example.com)
  > This is quoted text`;
    const blocks = markdownToBlocks(markdown);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe('bulleted_list_item');

    const listItem = blocks[0] as any;
    expect(listItem.bulleted_list_item.children).toHaveLength(1);
    expect(listItem.bulleted_list_item.children[0].type).toBe('quote');
    expect(listItem.bulleted_list_item.children[0].quote.rich_text[0].text.content).toBe('This is quoted text');
  });

  it('converts multi-line indented blockquote under bullet item', () => {
    const markdown = `- [Page Title](https://example.com)
  > First quoted line
  > Second quoted line`;
    const blocks = markdownToBlocks(markdown);
    expect(blocks).toHaveLength(1);

    const listItem = blocks[0] as any;
    expect(listItem.bulleted_list_item.children[0].quote.rich_text[0].text.content).toBe(
      'First quoted line\nSecond quoted line'
    );
  });

  it('handles bullet items with and without nested quotes', () => {
    const markdown = `- First item with quote
  > Quoted under first
- Second item no quote
- Third item with quote
  > Quoted under third`;
    const blocks = markdownToBlocks(markdown);
    expect(blocks).toHaveLength(3);

    // First item has nested quote
    expect((blocks[0] as any).bulleted_list_item.children).toHaveLength(1);

    // Second item has no children
    expect((blocks[1] as any).bulleted_list_item.children).toBeUndefined();

    // Third item has nested quote
    expect((blocks[2] as any).bulleted_list_item.children).toHaveLength(1);
  });

  it('preserves link formatting in bullet item with nested quote', () => {
    const markdown = `- [Example Page](https://example.com)
  > Some quoted content`;
    const blocks = markdownToBlocks(markdown);

    const listItem = blocks[0] as any;
    const richText = listItem.bulleted_list_item.rich_text;

    // Should have the link
    expect(richText.some((rt: any) => rt.text.link?.url === 'https://example.com')).toBe(true);
    expect(richText.some((rt: any) => rt.text.content === 'Example Page')).toBe(true);
  });
});
