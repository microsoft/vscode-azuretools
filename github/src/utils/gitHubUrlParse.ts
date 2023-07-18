/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export interface ParsedGitHubUrl {
    /**
     * The original URL for reference
     * @example 'https://github.com/microsoft/foo-bar'
     */
    urlReference?: string;
    /**
     * The owner or organization, parsed from the full GitHub URL
     * @example 'microsoft'
     */
    ownerOrOrganization?: string;
    /**
     * The repository (base), parsed from the full GitHub URL
     * @example 'foo-bar'
     */
    repositoryName?: string;
}

/**
 * A minimal utility function for parsing a full GitHub URL into its constituent parts
 * @params url A complete GitHub repository URL
 * @example 'https://github.com/microsoft/foo-bar'
 */
export function gitHubUrlParse(url: string): ParsedGitHubUrl {
    const match: RegExpMatchArray | null = url.match(/github\.com\/(?<ownerOrOrganization>[^/]+)\/(?<repositoryName>[^/]+)/i);
    return {
        urlReference: url,
        ownerOrOrganization: match?.groups?.ownerOrOrganization,
        repositoryName: match?.groups?.repositoryName
    };
}
