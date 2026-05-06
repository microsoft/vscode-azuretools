/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as React from 'react';
import { useMemo, useCallback, type JSX } from 'react';
import { useTemplateGalleryConfig } from '../TemplateGalleryConfigContext';
import type { IProjectTemplate, FilterState } from '../types';

interface FilterBarProps {
    templates: IProjectTemplate[];
    filters: FilterState;
    onFilterChange: (key: keyof FilterState, value: string) => void;
    onClearFilters: () => void;
}

export const FilterBar = ({ templates, filters, onFilterChange, onClearFilters: _onClearFilters }: FilterBarProps): JSX.Element => {
    const {
        languageFilterMap,
        languageDisplayNames,
        categoryDisplayNames,
        resourceDisplayNames,
        languageOrder,
    } = useTemplateGalleryConfig();

    // Build dynamic language chips
    const languages = useMemo(() => {
        const langSet = new Set<string>();
        templates.forEach(t => {
            (t.languages || []).forEach(lang => {
                const filterVal = languageFilterMap[lang];
                if (filterVal) langSet.add(filterVal);
            });
        });
        const sorted = [...langSet].sort((a, b) => {
            const ai = languageOrder.indexOf(a);
            const bi = languageOrder.indexOf(b);
            return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
        });
        const displayMap: Record<string, string> = {};
        for (const [key, val] of Object.entries(languageFilterMap)) {
            if (!displayMap[val]) displayMap[val] = languageDisplayNames[key] || key;
        }
        return sorted.map(val => ({ value: val, label: displayMap[val] || val }));
    }, [templates, languageFilterMap, languageDisplayNames, languageOrder]);

    // Build dynamic use case chips
    const useCases = useMemo(() => {
        const caseSet = new Set<string>();
        templates.forEach(t => {
            const cats = t.categories || (t.category ? [t.category] : []);
            cats.forEach(c => caseSet.add(c));
        });
        return [...caseSet]
            .sort((a, b) => {
                const aName = categoryDisplayNames[a] || a;
                const bName = categoryDisplayNames[b] || b;
                return aName.localeCompare(bName);
            })
            .map(val => ({ value: val, label: categoryDisplayNames[val] || val.charAt(0).toUpperCase() + val.slice(1) }));
    }, [templates, categoryDisplayNames]);

    // Build dynamic resource chips
    const resources = useMemo(() => {
        const resSet = new Set<string>();
        templates.forEach(t => {
            if (t.resource) resSet.add(t.resource);
        });
        return [...resSet]
            .sort((a, b) => {
                const aName = resourceDisplayNames[a] || a;
                const bName = resourceDisplayNames[b] || b;
                return aName.localeCompare(bName);
            })
            .map(val => ({ value: val, label: resourceDisplayNames[val] || val.charAt(0).toUpperCase() + val.slice(1) }));
    }, [templates, resourceDisplayNames]);

    const handleSearch = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        onFilterChange('search', e.target.value);
    }, [onFilterChange]);

    const clearSearch = useCallback(() => {
        onFilterChange('search', '');
    }, [onFilterChange]);

    return (
        <div className="filter-bar">
            <div className="search-container">
                <span className="search-icon codicon codicon-search"></span>
                <input
                    type="text"
                    className="search-input"
                    placeholder="Search templates..."
                    aria-label="Search templates"
                    value={filters.search}
                    onChange={handleSearch}
                />
                {filters.search && (
                    <button className="clear-search" aria-label="Clear search" onClick={clearSearch}>
                        <span className="codicon codicon-close"></span>
                    </button>
                )}
            </div>

            <div className="filters-container">
                <FilterGroup
                    label="Language"
                    items={languages}
                    activeValue={filters.language}
                    onChange={(val) => onFilterChange('language', val)}
                />
                <FilterGroup
                    label="Use Case"
                    items={useCases}
                    activeValue={filters.useCase}
                    onChange={(val) => onFilterChange('useCase', val)}
                />
                <FilterGroup
                    label="Resource"
                    items={resources}
                    activeValue={filters.resource}
                    onChange={(val) => onFilterChange('resource', val)}
                />
            </div>
        </div>
    );
};

interface FilterGroupProps {
    label: string;
    items: Array<{ value: string; label: string }>;
    activeValue: string;
    onChange: (value: string) => void;
}

const FilterGroup = ({ label, items, activeValue, onChange }: FilterGroupProps): JSX.Element => (
    <div className="filter-group">
        <label className="filter-label">{label}:</label>
        <div className="filter-chips" role="radiogroup" aria-label={`Filter by ${label.toLowerCase()}`}>
            <button
                className={`filter-chip ${activeValue === 'all' ? 'active' : ''}`}
                role="radio"
                aria-checked={activeValue === 'all'}
                onClick={() => onChange('all')}
            >
                All
            </button>
            {items.map(item => (
                <button
                    key={item.value}
                    className={`filter-chip ${activeValue === item.value ? 'active' : ''}`}
                    data-value={item.value}
                    role="radio"
                    aria-checked={activeValue === item.value}
                    onClick={() => onChange(item.value)}
                >
                    {item.label}
                </button>
            ))}
        </div>
    </div>
);
