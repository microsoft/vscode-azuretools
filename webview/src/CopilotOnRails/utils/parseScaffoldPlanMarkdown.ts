/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export interface PlanData {
    status: string;
    created: string;
    mode: string;
    sections: PlanSection[];
}

export interface PlanSection {
    number: number;
    title: string;
    content: PlanContent[];
}

export interface TreeNode {
    name: string;
    comment?: string;
    isFolder: boolean;
    children: TreeNode[];
}

export type PlanContent =
    | { type: 'keyValue'; key: string; value: string }
    | { type: 'table'; headers: string[]; rows: string[][] }
    | { type: 'blockquote'; text: string }
    | { type: 'paragraph'; text: string }
    | { type: 'tree'; root: string; nodes: TreeNode[] };

export function parseScaffoldPlanMarkdown(markdown: string): PlanData {
    const lines = markdown.replace(/\r\n/g, '\n').split('\n');

    const status = extractMetadata(lines, 'Status') ?? 'Unknown';
    const created = extractMetadata(lines, 'Created') ?? 'Unknown';
    const mode = extractMetadata(lines, 'Mode') ?? 'Unknown';

    const sections = extractSections(lines);

    return { status, created, mode, sections };
}

function extractMetadata(lines: string[], key: string): string | undefined {
    for (const line of lines) {
        const match = line.match(new RegExp(`^\\*\\*${key}\\*\\*\\s*:\\s*(.+)$`));
        if (match) {
            return match[1].trim();
        }
    }
    return undefined;
}

function extractSections(lines: string[]): PlanSection[] {
    const sections: PlanSection[] = [];
    let currentSection: PlanSection | undefined;
    let i = 0;

    while (i < lines.length) {
        const line = lines[i];

        // Match section headers like "## 1. Project Overview"
        const sectionMatch = line.match(/^##\s+(\d+)\.\s+(.+)$/);
        if (sectionMatch) {
            currentSection = {
                number: parseInt(sectionMatch[1], 10),
                title: sectionMatch[2].trim(),
                content: [],
            };
            sections.push(currentSection);
            i++;
            continue;
        }

        if (!currentSection) {
            i++;
            continue;
        }

        // Skip empty lines and horizontal rules
        if (line.trim() === '' || line.trim() === '---') {
            i++;
            continue;
        }

        // Parse tree structures (lines starting with tree connectors or a root folder)
        if (line.trim().match(/^[a-zA-Z0-9._-]+\/$/) || line.trim().startsWith('├') || line.trim().startsWith('└') || line.trim().startsWith('│')) {
            const tree = parseTree(lines, i);
            if (tree) {
                currentSection.content.push(tree.content);
                i = tree.endIndex;
                continue;
            }
        }

        // Parse tables
        if (line.trim().startsWith('|')) {
            const table = parseTable(lines, i);
            if (table) {
                currentSection.content.push(table.content);
                i = table.endIndex;
                continue;
            }
        }

        // Parse blockquotes
        if (line.trim().startsWith('>')) {
            const text = line.trim().replace(/^>\s*/, '');
            currentSection.content.push({ type: 'blockquote', text });
            i++;
            continue;
        }

        // Parse bold key-value pairs like "**Goal**: ..."
        const kvMatch = line.match(/^\*\*(.+?)\*\*\s*:\s*(.+)$/);
        if (kvMatch) {
            currentSection.content.push({
                type: 'keyValue',
                key: kvMatch[1].trim(),
                value: kvMatch[2].trim(),
            });
            i++;
            continue;
        }

        // Fallback: paragraph
        if (line.trim().length > 0) {
            currentSection.content.push({ type: 'paragraph', text: line.trim() });
        }

        i++;
    }

    return sections;
}

function parseTable(lines: string[], startIndex: number): { content: PlanContent; endIndex: number } | undefined {
    const headerLine = lines[startIndex];
    if (!headerLine?.trim().startsWith('|')) {
        return undefined;
    }

    const headers = parseTableRow(headerLine);
    if (headers.length === 0) {
        return undefined;
    }

    // Skip the separator line (e.g., |---|---|)
    let i = startIndex + 1;
    if (i < lines.length && lines[i].trim().match(/^\|[\s\-|]+\|$/)) {
        i++;
    }

    const rows: string[][] = [];
    while (i < lines.length && lines[i].trim().startsWith('|')) {
        rows.push(parseTableRow(lines[i]));
        i++;
    }

    return {
        content: { type: 'table', headers, rows },
        endIndex: i,
    };
}

function parseTableRow(line: string): string[] {
    return line
        .split('|')
        .slice(1, -1) // Remove leading/trailing empty strings from split
        .map((cell) => cell.trim().replace(/\*\*/g, '')); // Strip bold markers
}

function parseTree(lines: string[], startIndex: number): { content: PlanContent; endIndex: number } | undefined {
    let i = startIndex;
    const firstLine = lines[i].trim();

    // First line should be the root folder (e.g. "project-root/")
    const rootMatch = firstLine.match(/^([a-zA-Z0-9._-]+\/)\s*$/);
    if (!rootMatch) {
        return undefined;
    }

    const root = rootMatch[1];
    i++;

    // Collect all tree lines
    const treeLines: string[] = [];
    while (i < lines.length) {
        const line = lines[i];
        if (line.match(/[├└│]/) || (line.startsWith('    ') && treeLines.length > 0)) {
            treeLines.push(line);
            i++;
        } else if (line.trim() === '' || line.trim() === '```') {
            i++;
            break;
        } else {
            break;
        }
    }

    const nodes = buildTreeNodes(treeLines, 0);
    return { content: { type: 'tree', root, nodes }, endIndex: i };
}

function buildTreeNodes(lines: string[], depth: number): TreeNode[] {
    const nodes: TreeNode[] = [];
    let i = 0;

    while (i < lines.length) {
        const line = lines[i];

        // Calculate this line's depth by counting indentation units
        const lineDepth = getTreeDepth(line);

        if (lineDepth < depth) {
            break;
        }

        if (lineDepth > depth) {
            i++;
            continue;
        }

        // Extract name and optional comment
        const cleaned = line.replace(/[│├└─\s]/g, '').trim();
        if (!cleaned) {
            i++;
            continue;
        }

        // More precise extraction: find the connector then get the rest
        const connectorMatch = line.match(/[├└]──\s+(.+)/);
        if (!connectorMatch) {
            i++;
            continue;
        }

        let nameAndComment = connectorMatch[1].trim();
        let comment: string | undefined;

        // Extract comment (← description)
        const commentMatch = nameAndComment.match(/^(.+?)\s+←\s+(.+)$/);
        if (commentMatch) {
            nameAndComment = commentMatch[1].trim();
            comment = commentMatch[2].trim();
        }

        const isFolder = nameAndComment.endsWith('/');
        const name = nameAndComment;

        // Collect children (lines at deeper depth)
        const children: string[] = [];
        let j = i + 1;
        while (j < lines.length && getTreeDepth(lines[j]) > depth) {
            children.push(lines[j]);
            j++;
        }

        const node: TreeNode = {
            name,
            comment,
            isFolder,
            children: children.length > 0 ? buildTreeNodes(children, depth + 1) : [],
        };

        nodes.push(node);
        i = j;
    }

    return nodes;
}

function getTreeDepth(line: string): number {
    let depth = 0;
    let pos = 0;

    while (pos < line.length) {
        // Check for "│   " (pipe + 3 spaces) or "    " (4 spaces)
        const chunk = line.substring(pos, pos + 4);
        if (chunk === '│   ' || chunk === '    ') {
            depth++;
            pos += 4;
        } else {
            break;
        }
    }

    return depth;
}
