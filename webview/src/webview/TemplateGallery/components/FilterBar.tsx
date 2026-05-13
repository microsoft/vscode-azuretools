/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { SearchBox, type SearchBoxChangeEvent, type InputOnChangeData } from '@fluentui/react-components';
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
        categoryOrder,
        resourceOrder,
    } = useTemplateGalleryConfig();

    const languages = useMemo(() => {
        const langSet = new Set<string>();
        templates.forEach(t => {
            (t.languages || []).forEach(lang => {
                const filterVal = languageFilterMap[lang];
                if (filterVal) { langSet.add(filterVal); }
            });
        });
        const sorted = [...langSet].sort((a, b) => {
            const ai = languageOrder.indexOf(a);
            const bi = languageOrder.indexOf(b);
            return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
        });
        const displayMap: Record<string, string> = {};
        for (const [key, val] of Object.entries(languageFilterMap)) {
            if (!displayMap[val]) { displayMap[val] = languageDisplayNames[key] || key; }
        }
        return sorted.map(val => ({ value: val, label: displayMap[val] || val }));
    }, [templates, languageFilterMap, languageDisplayNames, languageOrder]);

    const useCases = useMemo(() => {
        const caseSet = new Set<string>();
        templates.forEach(t => {
            const cats = t.categories || (t.category ? [t.category] : []);
            cats.forEach(c => caseSet.add(c));
        });
        return [...caseSet]
            .sort((a, b) => {
                const aIdx = categoryOrder.indexOf(a);
                const bIdx = categoryOrder.indexOf(b);
                if (aIdx !== -1 && bIdx !== -1) { return aIdx - bIdx; }
                if (aIdx !== -1) { return -1; }
                if (bIdx !== -1) { return 1; }
                const aName = categoryDisplayNames[a] || a;
                const bName = categoryDisplayNames[b] || b;
                return aName.localeCompare(bName);
            })
            .map(val => ({ value: val, label: categoryDisplayNames[val] || val.charAt(0).toUpperCase() + val.slice(1) }));
    }, [templates, categoryDisplayNames, categoryOrder]);

    const resources = useMemo(() => {
        const resSet = new Set<string>();
        templates.forEach(t => {
            if (t.resource) { resSet.add(t.resource); }
        });
        return [...resSet]
            .sort((a, b) => {
                const aIdx = resourceOrder.indexOf(a);
                const bIdx = resourceOrder.indexOf(b);
                if (aIdx !== -1 && bIdx !== -1) { return aIdx - bIdx; }
                if (aIdx !== -1) { return -1; }
                if (bIdx !== -1) { return 1; }
                const aName = resourceDisplayNames[a] || a;
                const bName = resourceDisplayNames[b] || b;
                return aName.localeCompare(bName);
            })
            .map(val => ({ value: val, label: resourceDisplayNames[val] || val.charAt(0).toUpperCase() + val.slice(1) }));
    }, [templates, resourceDisplayNames, resourceOrder]);

    const handleSearch = useCallback((_ev: SearchBoxChangeEvent, data: InputOnChangeData) => {
        onFilterChange('search', data.value);
    }, [onFilterChange]);

    return (
        <div className="filter-bar">
            <div className="search-container">
                <SearchBox
                    placeholder="Search templates..."
                    aria-label="Search templates"
                    value={filters.search}
                    onChange={handleSearch}
                    className="search-input"
                />
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

const FilterGroup = ({ label, items, activeValue, onChange }: FilterGroupProps): JSX.Element => {
    const allItems = [{ value: 'all', label: 'All' }, ...items];
    return (
        <div className="filter-group">
            <label className="filter-label">{label}:</label>
            <div role="radiogroup" aria-label={`Filter by ${label.toLowerCase()}`} className="filter-chips">
                {allItems.map(item => {
                    const isActive = activeValue === item.value;
                    return (
                        <button
                            key={item.value}
                            type="button"
                            role="radio"
                            aria-checked={isActive}
                            className={`filter-chip${isActive ? ' active' : ''}`}
                            data-value={item.value}
                            onClick={() => onChange(item.value)}
                        >
                            {item.label}
                        </button>
                    );
                })}
            </div>
        </div>
    );
};
