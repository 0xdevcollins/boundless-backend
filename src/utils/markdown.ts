import { marked } from "marked";
import DOMPurify from "dompurify";
import { JSDOM } from "jsdom";

const window = new JSDOM("").window;
const purify = DOMPurify(window);

marked.setOptions({
  breaks: true,
  gfm: true,
});

const renderer = new marked.Renderer();

renderer.link = ({ href, title, text }) => {
  const isExternal = href && (href.startsWith("http") || href.startsWith("//"));
  const titleAttr = title ? ` title="${title}"` : "";
  const relAttr = isExternal ? ' rel="noopener noreferrer"' : "";
  const targetAttr = isExternal ? ' target="_blank"' : "";

  return `<a href="${href}"${titleAttr}${relAttr}${targetAttr}>${text}</a>`;
};

renderer.image = ({ href, title, text }) => {
  const titleAttr = title ? ` title="${title}"` : "";
  const altAttr = text ? ` alt="${text}"` : "";

  return `<img src="${href}"${altAttr}${titleAttr} loading="lazy" />`;
};

renderer.code = ({ text, lang }) => {
  const validLanguage = lang && /^[a-zA-Z0-9-_]+$/.test(lang);
  const langClass = validLanguage ? ` class="language-${lang}"` : "";

  return `<pre><code${langClass}>${text}</code></pre>`;
};

marked.use({ renderer });

export interface MarkdownProcessResult {
  html: string;
  plainText: string;
  wordCount: number;
  readingTime: number;
  tableOfContents: Array<{
    level: number;
    text: string;
    slug: string;
  }>;
}

export class MarkdownProcessor {
  static async toHtml(markdown: string): Promise<string> {
    try {
      const html = await marked.parse(markdown);
      return purify.sanitize(html, {
        ALLOWED_TAGS: [
          "h1",
          "h2",
          "h3",
          "h4",
          "h5",
          "h6",
          "p",
          "br",
          "strong",
          "em",
          "u",
          "s",
          "del",
          "ins",
          "a",
          "img",
          "figure",
          "figcaption",
          "ul",
          "ol",
          "li",
          "dl",
          "dt",
          "dd",
          "blockquote",
          "cite",
          "q",
          "pre",
          "code",
          "kbd",
          "samp",
          "var",
          "table",
          "thead",
          "tbody",
          "tfoot",
          "tr",
          "th",
          "td",
          "div",
          "span",
          "hr",
          "details",
          "summary",
        ],
        ALLOWED_ATTR: [
          "href",
          "title",
          "alt",
          "src",
          "class",
          "id",
          "target",
          "rel",
          "loading",
          "width",
          "height",
          "colspan",
          "rowspan",
          "scope",
          "headers",
        ],
        ALLOWED_URI_REGEXP:
          /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|cid|xmpp|data):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
      });
    } catch (error) {
      console.error("Error processing markdown:", error);
      return "";
    }
  }

  static toPlainText(markdown: string): string {
    try {
      let plainText = markdown
        .replace(/#{1,6}\s+/g, "") // Headers
        .replace(/\*\*(.*?)\*\*/g, "$1") // Bold
        .replace(/\*(.*?)\*/g, "$1") // Italic
        .replace(/~~(.*?)~~/g, "$1") // Strikethrough
        .replace(/`(.*?)`/g, "$1") // Inline code
        .replace(/```[\s\S]*?```/g, "") // Code blocks
        .replace(/\[(.*?)\]\(.*?\)/g, "$1") // Links
        .replace(/!\[(.*?)\]\(.*?\)/g, "$1") // Images
        .replace(/^\s*[-*+]\s+/gm, "") // Unordered lists
        .replace(/^\s*\d+\.\s+/gm, "") // Ordered lists
        .replace(/^\s*>\s+/gm, "") // Blockquotes
        .replace(/\n{2,}/g, "\n") // Multiple newlines
        .trim();

      return plainText;
    } catch (error) {
      console.error("Error extracting plain text:", error);
      return "";
    }
  }

  static calculateReadingTime(
    text: string,
    wordsPerMinute: number = 200,
  ): number {
    const wordCount = this.getWordCount(text);
    return Math.ceil(wordCount / wordsPerMinute);
  }

  static getWordCount(text: string): number {
    const plainText = this.toPlainText(text);
    const words = plainText.split(/\s+/).filter((word) => word.length > 0);
    return words.length;
  }

  static extractTableOfContents(
    markdown: string,
  ): Array<{ level: number; text: string; slug: string }> {
    const toc: Array<{ level: number; text: string; slug: string }> = [];
    const headerRegex = /^(#{1,6})\s+(.+)$/gm;
    let match;

    while ((match = headerRegex.exec(markdown)) !== null) {
      const level = match[1].length;
      const text = match[2].trim();
      const slug = text
        .toLowerCase()
        .replace(/[^a-zA-Z0-9\s]/g, "")
        .replace(/\s+/g, "-")
        .substring(0, 50);

      toc.push({ level, text, slug });
    }

    return toc;
  }

  static async process(markdown: string): Promise<MarkdownProcessResult> {
    const html = await this.toHtml(markdown);
    const plainText = this.toPlainText(markdown);
    const wordCount = this.getWordCount(markdown);
    const readingTime = this.calculateReadingTime(markdown);
    const tableOfContents = this.extractTableOfContents(markdown);

    return {
      html,
      plainText,
      wordCount,
      readingTime,
      tableOfContents,
    };
  }

  static validate(markdown: string): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    try {
      // Basic validation
      if (!markdown || markdown.trim().length === 0) {
        errors.push("Markdown content is empty");
      }

      // Check for potentially dangerous content
      if (markdown.includes("<script>") || markdown.includes("javascript:")) {
        errors.push("Markdown contains potentially dangerous content");
      }

      // Check for excessive length (optional)
      if (markdown.length > 100000) {
        errors.push("Markdown content is too long (max 100,000 characters)");
      }

      // Try to parse the markdown
      marked.parse(markdown);

      return {
        isValid: errors.length === 0,
        errors,
      };
    } catch (error) {
      errors.push(
        `Markdown parsing error: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
      return {
        isValid: false,
        errors,
      };
    }
  }
}
