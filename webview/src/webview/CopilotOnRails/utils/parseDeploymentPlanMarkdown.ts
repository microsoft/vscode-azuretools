/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { type DeploymentPlanData, type DeploymentPlanTable } from "../DeploymentPlanView";

/**
 * Parses a deployment plan markdown file into DeploymentPlanData.
 *
 * Expected format:
 *
 * **Status**: Awaiting Approval
 * **Mode**: MODERNIZE — deploy existing full-stack app to Azure
 * **Subscription**: meganmott dev
 * **Location**: East US
 * **LocationCode**: eastus
 *
 * ## Architecture Diagram
 * ```mermaid
 * graph TD
 *     ...
 * ```
 *
 * ## Workspace Scan
 * | Component | Technology | Azure Target |
 * |-----------|------------|--------------|
 * | ...       | ...        | ...          |
 *
 * ## Decisions
 * | Decision | Choice | Rationale |
 * |----------|--------|-----------|
 * | ...      | ...    | ...       |
 *
 * ## Azure Resources
 * | Resource | Name pattern | SKU / Tier |
 * |----------|--------------|------------|
 * | ...      | ...          | ...        |
 */
export function parseDeploymentPlanMarkdown(markdown: string): DeploymentPlanData {
    const lines = markdown.replace(/\r\n/g, '\n').split('\n');

    const status = extractMetadata(lines, 'Status') ?? 'Unknown';
    const mode = extractMetadata(lines, 'Mode') ?? 'Unknown';
    const subscription = extractMetadata(lines, 'Subscription') ?? 'Unknown';
    const rawLocation = extractMetadata(lines, 'Location') ?? 'Unknown';

    // Parse location: "East US (`eastus`)" → name="East US", code="eastus"
    const locationMatch = rawLocation.match(/^(.+?)\s*\(`?([^`)]+)`?\)\s*$/);
    const location = locationMatch ? locationMatch[1].trim() : rawLocation;
    const locationCode = locationMatch ? locationMatch[2].trim() : extractMetadata(lines, 'LocationCode') ?? 'unknown';

    const sections = extractNamedSections(lines);

    const mermaidDiagram = extractMermaidBlock(sections['Architecture Diagram'] ?? []);
    const workspaceScan = extractTable(sections['Workspace Scan'] ?? []);
    const decisions = extractTable(sections['Decisions'] ?? []);
    const resources = extractTable(sections['Azure Resources'] ?? []);

    // Provide placeholder dropdown options when values are unknown
    const availableSubscriptions = subscription === 'Unknown'
        ? ['Visual Studio Enterprise', 'Azure for Students', 'Pay-As-You-Go', 'MSDN Platforms']
        : undefined;

    const availableLocations = locationCode === 'unknown'
        ? [
            { name: 'East US', code: 'eastus' },
            { name: 'East US 2', code: 'eastus2' },
            { name: 'West US', code: 'westus' },
            { name: 'West US 2', code: 'westus2' },
            { name: 'Central US', code: 'centralus' },
            { name: 'North Europe', code: 'northeurope' },
            { name: 'West Europe', code: 'westeurope' },
            { name: 'Southeast Asia', code: 'southeastasia' },
        ]
        : undefined;

    return {
        status,
        mode,
        subscription: subscription === 'Unknown' ? '' : subscription,
        availableSubscriptions,
        location: location === 'Unknown' ? '' : location,
        locationCode: locationCode === 'unknown' ? '' : locationCode,
        availableLocations,
        mermaidDiagram,
        workspaceScan,
        decisions,
        resources,
    };
}

function extractMetadata(lines: string[], key: string): string | undefined {
    for (const line of lines) {
        // Match both **Key**: value and **Key:** value
        const match = line.match(new RegExp(`^\\*\\*${key}:?\\*\\*:?\\s*(.+)$`));
        if (match) {
            return match[1].trim();
        }
    }
    return undefined;
}

function extractNamedSections(lines: string[]): Record<string, string[]> {
    const sections: Record<string, string[]> = {};
    let currentTitle: string | undefined;

    for (const line of lines) {
        const sectionMatch = line.match(/^##\s+(?:\d+\.\s+)?(.+)$/);
        if (sectionMatch) {
            currentTitle = sectionMatch[1].trim();
            sections[currentTitle] = [];
            continue;
        }

        if (currentTitle) {
            sections[currentTitle].push(line);
        }
    }

    return sections;
}

function extractMermaidBlock(lines: string[]): string {
    const diagramLines: string[] = [];
    let inBlock = false;

    for (const line of lines) {
        // Match ```mermaid or plain ``` code blocks
        if (!inBlock && line.trim().match(/^```/)) {
            inBlock = true;
            // Skip the opening fence line itself
            continue;
        }
        if (inBlock && line.trim() === '```') {
            break;
        }
        if (inBlock) {
            diagramLines.push(line);
        }
    }

    // If no fenced code block, use all non-empty lines as the diagram text
    if (diagramLines.length === 0) {
        return lines.filter(l => l.trim().length > 0).join('\n');
    }

    return diagramLines.join('\n');
}

function extractTable(lines: string[]): DeploymentPlanTable {
    const tableLines = lines.filter(l => l.trim().startsWith('|'));

    if (tableLines.length < 2) {
        return { headers: [], rows: [] };
    }

    const headers = parseTableRow(tableLines[0]);

    // Skip separator line
    let dataStart = 1;
    if (tableLines[dataStart]?.trim().match(/^\|[\s\-:|]+\|$/)) {
        dataStart = 2;
    }

    const rows = tableLines.slice(dataStart).map(parseTableRow);

    return { headers, rows };
}

function parseTableRow(line: string): string[] {
    return line
        .split('|')
        .slice(1, -1)
        .map(cell => cell.trim().replace(/\*\*/g, ''));
}
