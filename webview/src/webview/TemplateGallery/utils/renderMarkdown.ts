/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * Simple markdown-to-HTML renderer for README display.
 * Handles headings, bold/italic, code blocks, links, lists, tables, blockquotes, and horizontal rules.
 */
export function renderMarkdown(md: string): string {
    // 0. Strip HTML comments
    md = md.replace(/<!--[\s\S]*?-->/g, '').trim();

    // 1. Extract and protect code blocks
    const codeBlocks: string[] = [];
    md = md.replace(/```([\w]*)\n?([\s\S]*?)```/g, (_, lang: string, code: string) => {
        const escaped = code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        codeBlocks.push(`<pre><code${lang ? ` class="language-${escapeHtml(lang)}"` : ''}>${escaped}</code></pre>`);
        return `\x00BLOCK${codeBlocks.length - 1}\x00`;
    });

    // 2. Escape HTML in remaining text
    md = md.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    // 3. Inline code
    md = md.replace(/`([^`]+)`/g, '<code>$1</code>');

    // 4. Images (strip — unsafe origins)
    md = md.replace(/!\[[^\]]*\]\([^)]*\)/g, '');

    // 5. Links (http/https only; show text for others)
    md = md.replace(
        /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g,
        '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>'
    );
    md = md.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1');

    // 6. Bold / italic
    md = md.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
    md = md.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    md = md.replace(/\*([^*\n]+?)\*/g, '<em>$1</em>');
    md = md.replace(/___(.+?)___/g, '<strong><em>$1</em></strong>');
    md = md.replace(/__(.+?)__/g, '<strong>$1</strong>');

    // 7. Headings
    md = md.replace(/^(#{1,6})\s+(.+)$/gm, (_, h: string, text: string) =>
        `<h${h.length}>${text.trim()}</h${h.length}>`);

    // 8. Blockquotes
    md = md.replace(/^&gt;\s?(.*)$/gm, '<blockquote>$1</blockquote>');

    // 9. Horizontal rules
    md = md.replace(/^[-*_]{3,}\s*$/gm, '<hr>');

    // 10. Tables (basic)
    md = md.replace(/^\|(.+)\|\s*\n\|[-| :]+\|\s*\n((?:\|.+\|\s*\n?)*)/gm, (_, header: string, rows: string) => {
        const ths = header.split('|').map((c: string) => `<th>${c.trim()}</th>`).join('');
        const trs = rows.trim().split('\n').map((row: string) => {
            const tds = row.split('|').filter((_: string, i: number, a: string[]) => i > 0 && i < a.length - 1)
                .map((c: string) => `<td>${c.trim()}</td>`).join('');
            return `<tr>${tds}</tr>`;
        }).join('');
        return `<table><thead><tr>${ths}</tr></thead><tbody>${trs}</tbody></table>`;
    });

    // 11. Lists and paragraphs (line by line)
    const lines = md.split('\n');
    const out: string[] = [];
    let inUL = false, inOL = false;

    for (const line of lines) {
        const ulM = line.match(/^[-*+]\s+(.+)$/);
        const olM = line.match(/^\d+\.\s+(.+)$/);

        if (ulM) {
            if (inOL) { out.push('</ol>'); inOL = false; }
            if (!inUL) { out.push('<ul>'); inUL = true; }
            out.push(`<li>${ulM[1]}</li>`);
        } else if (olM) {
            if (inUL) { out.push('</ul>'); inUL = false; }
            if (!inOL) { out.push('<ol>'); inOL = true; }
            out.push(`<li>${olM[1]}</li>`);
        } else {
            if (inUL) { out.push('</ul>'); inUL = false; }
            if (inOL) { out.push('</ol>'); inOL = false; }
            if (/^<(h[1-6]|pre|blockquote|hr|ul|ol|li|table|thead|tbody|tr|div)/.test(line)) {
                out.push(line);
            } else if (line.trim() === '') {
                out.push('');
            } else {
                out.push(`<p>${line}</p>`);
            }
        }
    }
    if (inUL) out.push('</ul>');
    if (inOL) out.push('</ol>');

    // 12. Restore code blocks
    let html = out.join('\n');
    html = html.replace(/\x00BLOCK(\d+)\x00/g, (_, i: string) => codeBlocks[parseInt(i)]);

    return html;
}

function escapeHtml(str: string): string {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
