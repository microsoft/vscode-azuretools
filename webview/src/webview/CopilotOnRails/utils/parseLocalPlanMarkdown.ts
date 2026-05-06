/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export interface LocalPlanData {
    title: string;
    status: string;
    headerNote: string;
    sections: LocalPlanSection[];
}

export interface LocalPlanSection {
    title: string;
    content: LocalPlanContent[];
}

export type LocalPlanContent =
    | { type: 'table'; headers: string[]; rows: string[][] }
    | { type: 'blockquote'; text: string }
    | { type: 'paragraph'; text: string }
    | { type: 'codeBlock'; language: string; code: string }
    | { type: 'bulletList'; items: string[] }
    | { type: 'subsection'; title: string; content: LocalPlanContent[] };

export function parseLocalPlanMarkdown(markdown: string): LocalPlanData {
    const lines = markdown.replace(/\r\n/g, '\n').split('\n');

    const header = extractHeader(lines);
    const sections = parseSections(lines, header.firstSectionIdx);

    return {
        title: header.title,
        status: header.status,
        headerNote: header.headerNote,
        sections,
    };
}

function extractHeader(lines: string[]): { title: string; status: string; headerNote: string; firstSectionIdx: number } {
    let title = 'Local Development Plan';
    let status = 'Unknown';
    const noteLines: string[] = [];
    let firstSectionIdx = lines.length;

    for (let i = 0; i < lines.length; i++) {
        const trimmed = lines[i].trim();

        if (trimmed.match(/^#\s/) && !trimmed.match(/^##/)) {
            const match = trimmed.match(/^#\s+(.+)$/);
            if (match) { title = match[1].trim(); }
            continue;
        }

        if (trimmed.match(/^##(?!#)\s+/)) {
            firstSectionIdx = i;
            break;
        }

        if (trimmed.startsWith('>')) {
            const text = trimmed.replace(/^>\s?/, '').trim();
            const statusMatch = text.match(/^\*\*Status:?\*\*:?\s*(.+)$/);
            if (statusMatch) {
                status = statusMatch[1].trim();
            } else if (text) {
                noteLines.push(text);
            }
            continue;
        }
    }

    return { title, status, headerNote: noteLines.join(' '), firstSectionIdx };
}

function parseSections(lines: string[], startIdx: number): LocalPlanSection[] {
    const sections: LocalPlanSection[] = [];
    let i = startIdx;

    while (i < lines.length) {
        const match = lines[i].match(/^##(?!#)\s+(.+)$/);
        if (match) {
            const sectionTitle = match[1].trim();
            i++;
            const endIdx = findNextH2(lines, i);
            const content = parseContent(lines, i, endIdx);
            sections.push({ title: sectionTitle, content });
            i = endIdx;
        } else {
            i++;
        }
    }

    return sections;
}

function findNextH2(lines: string[], from: number): number {
    for (let i = from; i < lines.length; i++) {
        if (lines[i].match(/^##(?!#)\s+/)) { return i; }
    }
    return lines.length;
}

function parseContent(lines: string[], start: number, end: number): LocalPlanContent[] {
    const content: LocalPlanContent[] = [];
    let i = start;

    while (i < end) {
        const trimmed = lines[i].trim();

        if (trimmed === '' || trimmed === '---') {
            i++;
            continue;
        }

        // Sub-section heading (###)
        const subMatch = trimmed.match(/^###\s+(.+)$/);
        if (subMatch) {
            const subTitle = subMatch[1].trim();
            i++;
            let subEnd = i;
            while (subEnd < end && !lines[subEnd].trim().match(/^###\s+/)) {
                subEnd++;
            }
            const subContent = parseContent(lines, i, subEnd);
            content.push({ type: 'subsection', title: subTitle, content: subContent });
            i = subEnd;
            continue;
        }

        // Code block
        if (trimmed.startsWith('```')) {
            const lang = trimmed.substring(3).trim();
            i++;
            const codeLines: string[] = [];
            while (i < end && !lines[i].trim().startsWith('```')) {
                codeLines.push(lines[i]);
                i++;
            }
            if (i < end) { i++; }
            content.push({ type: 'codeBlock', language: lang, code: codeLines.join('\n') });
            continue;
        }

        // Table
        if (trimmed.startsWith('|')) {
            const headers = parseTableRow(trimmed);
            i++;
            if (i < end && lines[i].trim().match(/^\|[-\s|:]+$/)) {
                i++;
            }
            const rows: string[][] = [];
            while (i < end && lines[i].trim().startsWith('|')) {
                rows.push(parseTableRow(lines[i].trim()));
                i++;
            }
            content.push({ type: 'table', headers, rows });
            continue;
        }

        // Bullet list
        if (trimmed.startsWith('- ')) {
            const items: string[] = [];
            while (i < end && lines[i].trim().startsWith('- ')) {
                items.push(lines[i].trim().substring(2).trim());
                i++;
            }
            content.push({ type: 'bulletList', items });
            continue;
        }

        // Blockquote
        if (trimmed.startsWith('>')) {
            const quoteLines: string[] = [];
            while (i < end && (lines[i].trim().startsWith('>') || lines[i].trim() === '>')) {
                quoteLines.push(lines[i].trim().replace(/^>\s?/, ''));
                i++;
            }
            content.push({ type: 'blockquote', text: quoteLines.join(' ').trim() });
            continue;
        }

        // Paragraph
        content.push({ type: 'paragraph', text: trimmed });
        i++;
    }

    return content;
}

function parseTableRow(line: string): string[] {
    return line
        .split('|')
        .slice(1, -1)
        .map((cell) => cell.trim());
}
