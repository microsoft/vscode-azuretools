/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { FilterState, IProjectTemplate } from './types';

/**
 * Build the gallery filter/search function. Kept free of React imports so the
 * logic can be unit tested in isolation.
 *
 * `languageDisplayNames` lets the search match a template's language display
 * name (e.g. ".NET" for CSharp) so searching stays consistent with the
 * language filter chips.
 */
export function createApplyFilters(
    languageFilterMap: Record<string, string>,
    languageDisplayNames: Record<string, string>,
) {
    return function applyFilters(templates: IProjectTemplate[], filters: FilterState): IProjectTemplate[] {
        let results = [...templates];

        if (filters.language !== 'all') {
            results = results.filter(t =>
                (t.languages ?? []).some(lang => languageFilterMap[lang] === filters.language)
            );
        }

        if (filters.useCase !== 'all') {
            results = results.filter(t => {
                const cats = t.categories || (t.category ? [t.category] : []);
                return cats.includes(filters.useCase);
            });
        }

        if (filters.resource !== 'all') {
            results = results.filter(t => t.resource === filters.resource);
        }

        if (filters.search.trim()) {
            const query = filters.search.toLowerCase();
            results = results.filter(t =>
                t.displayName.toLowerCase().includes(query) ||
                t.shortDescription.toLowerCase().includes(query) ||
                (t.tags && t.tags.some(tag => tag.toLowerCase().includes(query))) ||
                // Match language keys and their display names so a search like
                // ".NET" or "C#" stays consistent with the language filter chips.
                (t.languages ?? []).some(lang =>
                    lang.toLowerCase().includes(query) ||
                    (languageDisplayNames[lang]?.toLowerCase().includes(query) ?? false)
                )
            );
        }

        results.sort((a, b) => {
            if (a.isHighlighted && !b.isHighlighted) { return -1; }
            if (!a.isHighlighted && b.isHighlighted) { return 1; }
            const aPrio = a.priority ?? 999;
            const bPrio = b.priority ?? 999;
            if (aPrio !== bPrio) { return aPrio - bPrio; }
            return a.displayName.localeCompare(b.displayName);
        });

        return results;
    };
}
