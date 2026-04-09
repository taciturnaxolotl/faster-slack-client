import { JSX } from "solid-js";
import styles from "../components/MessageItem.module.css";
import { UserProfile } from "../../bindings/fastslack/shared/models";

// Slack markdown uses a custom syntax known as mrkdwn.
// See: https://api.slack.com/reference/surfaces/formatting

export function parseSlackMarkdown(text: string, profiles?: Record<string, UserProfile>): JSX.Element[] {
  if (!text) return [];

  const elements: JSX.Element[] = [];
  let currentIndex = 0;

  // Regex for parsing Slack markdown
  // Matches:
  // 1. Code blocks: ```code```
  // 2. Inline code: `code`
  // 3. Links/Mentions: <url|text> or <url> or <@U123> etc.
  // 4. Bold: *bold*
  // 5. Italic: _italic_
  // 6. Strikethrough: ~strike~
  // 7. Blockquotes: > quote
  const regex = /(```[\s\S]*?```)|(`[^`]+`)|(<[^>]+>)|(\*[^\*]+\*)|(_[^_]+_)|(~[^~]+~)|(^>.*$)/gm;

  let match;
  while ((match = regex.exec(text)) !== null) {
    const matchStart = match.index;
    const matchText = match[0];

    // Push preceding unformatted text
    if (matchStart > currentIndex) {
      const precedingText = text.substring(currentIndex, matchStart);
      elements.push(<span innerHTML={decodeHtmlEntities(precedingText)} />);
    }

    if (match[1]) {
      // Code block
      const codeContent = matchText.slice(3, -3);
      elements.push(
        <pre class={styles.pre}>
          <code class={styles.codeBlock} innerHTML={decodeHtmlEntities(codeContent)} />
        </pre>
      );
    } else if (match[2]) {
      // Inline code
      const codeContent = matchText.slice(1, -1);
      elements.push(<code class={styles.inlineCode} innerHTML={decodeHtmlEntities(codeContent)} />);
    } else if (match[3]) {
      // Link or mention
      const linkContent = matchText.slice(1, -1);
      const parts = linkContent.split('|');
      const url = parts[0];
      const linkText = parts.length > 1 ? parts[1] : url;

      if (url.startsWith('@U') || url.startsWith('@W')) {
        // User mention
        const userId = url.substring(1); // remove @
        let mentionName = linkText.replace(/^@/, '');
        
        if (profiles && profiles[userId]) {
            const p = profiles[userId];
            mentionName = p.profile.display_name || p.profile.real_name || mentionName;
        }

        elements.push(<span class={styles.mention}>@{mentionName}</span>);
      } else if (url.startsWith('#C')) {
        // Channel link
        elements.push(<span class={styles.channelLink}>#{linkText}</span>);
      } else if (url.startsWith('!subteam^')) {
         // Subteam mention
         elements.push(<span class={styles.mention}>@{linkText}</span>);
      } else if (url.startsWith('!')) {
         // Special mentions like !here, !channel
         let mentionText = url.substring(1);
         if (url.startsWith('!date^')) {
             const dateParts = url.split('^');
             mentionText = linkText !== url ? linkText : (dateParts.length > 2 ? dateParts[2] : dateParts[1]);
             elements.push(<span class={styles.dateLink} innerHTML={decodeHtmlEntities(mentionText)} />);
         } else {
             elements.push(<span class={styles.mention}>@{mentionText}</span>);
         }
      } else {
        // Standard link
        elements.push(
          <a href={url} target="_blank" rel="noopener noreferrer" class={styles.link}>
            <span innerHTML={decodeHtmlEntities(linkText)} />
          </a>
        );
      }
    } else if (match[4]) {
      // Bold
      const boldContent = matchText.slice(1, -1);
      elements.push(<strong class={styles.bold} innerHTML={decodeHtmlEntities(boldContent)} />);
    } else if (match[5]) {
      // Italic
      const italicContent = matchText.slice(1, -1);
      elements.push(<em class={styles.italic} innerHTML={decodeHtmlEntities(italicContent)} />);
    } else if (match[6]) {
      // Strikethrough
      const strikeContent = matchText.slice(1, -1);
      elements.push(<del class={styles.strike} innerHTML={decodeHtmlEntities(strikeContent)} />);
    } else if (match[7]) {
      // Blockquote
      const quoteContent = matchText.substring(1).trim();
      elements.push(
        <blockquote class={styles.blockquote}>
          <span innerHTML={decodeHtmlEntities(quoteContent)} />
        </blockquote>
      );
    }

    currentIndex = regex.lastIndex;
  }

  // Push remaining unformatted text
  if (currentIndex < text.length) {
    const remainingText = text.substring(currentIndex);
    elements.push(<span innerHTML={decodeHtmlEntities(remainingText)} />);
  }

  // Handle line breaks (split spans containing newlines into arrays with <br/>)
  // This is a simplified approach, but valid for most cases.
  return processLineBreaks(elements);
}

function decodeHtmlEntities(text: string): string {
    return text.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
}

function processLineBreaks(elements: JSX.Element[]): JSX.Element[] {
    const processed: JSX.Element[] = [];
    
    for (const el of elements) {
        const anyEl = el as any;
        if (typeof el === 'object' && el !== null && 't' in anyEl && anyEl.t === '<span/>' && anyEl.innerHTML) {
            // It's a span we created with innerHTML
            const text = anyEl.innerHTML as string;
            const lines = text.split('\n');
            if (lines.length > 1) {
                for (let i = 0; i < lines.length; i++) {
                    processed.push(<span innerHTML={lines[i]} />);
                    if (i < lines.length - 1) {
                        processed.push(<br />);
                    }
                }
            } else {
                processed.push(el);
            }
        } else {
            processed.push(el);
        }
    }
    
    return processed;
}
