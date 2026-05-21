/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Button } from '@fluentui/react-components';
import { useMemo, useCallback, type JSX } from 'react';
import { useTemplateGalleryConfig } from '../TemplateGalleryConfigContext';
import type { IProjectTemplate } from '../types';

interface TemplateCardProps {
    template: IProjectTemplate;
    onSelect: (template: IProjectTemplate) => void;
    onUseTemplate: (template: IProjectTemplate) => void;
}

export const TemplateCard = ({ template, onSelect, onUseTemplate }: TemplateCardProps): JSX.Element => {
    const { languageDisplayNames, languageFilterMap, categoryDisplayNames } = useTemplateGalleryConfig();

    const handleCardActivate = useCallback(() => onSelect(template), [template, onSelect]);
    const handleUseTemplate = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        onUseTemplate(template);
    }, [template, onUseTemplate]);
    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onSelect(template);
        }
    }, [template, onSelect]);

    const languageBadges = useMemo(() => {
        const seen = new Set<string>();
        return template.languages
            .map(lang => {
                const displayName = languageDisplayNames[lang] || lang;
                const filterClass = languageFilterMap[lang] || 'other';
                const key = `${filterClass}-${displayName}`;
                if (seen.has(key)) { return null; }
                seen.add(key);
                return { displayName, filterClass, key };
            })
            .filter(Boolean) as Array<{ displayName: string; filterClass: string; key: string }>;
    }, [template.languages, languageDisplayNames, languageFilterMap]);

    const categories = template.categories || (template.category ? [template.category] : []);

    return (
        <article
            className={`template-card clickable ${template.isHighlighted ? 'featured' : ''}`}
            role="listitem"
            aria-label={`${template.displayName}. ${template.shortDescription}`}
            tabIndex={0}
            onClick={handleCardActivate}
            onKeyDown={handleKeyDown}
        >
            <div className="card-languages">
                {languageBadges.map(b => (
                    <span key={b.key} className={`language-badge ${b.filterClass}`}>
                        {b.displayName}
                    </span>
                ))}
            </div>
            <h3 className="card-title">{template.displayName}</h3>
            <p className="card-description">{template.shortDescription}</p>
            <div className="card-footer">
                <div className="card-badges">
                    {categories.map(c => (
                        <span key={c} className="category-badge">
                            {categoryDisplayNames[c] || c}
                        </span>
                    ))}
                    {template.isNew && (
                        <span className="new-badge">
                            <span className="codicon codicon-sparkle"></span>New
                        </span>
                    )}
                </div>
                <Button
                    appearance="primary"
                    size="small"
                    className="use-template-btn"
                    onClick={handleUseTemplate}
                >
                    Use Template
                </Button>
            </div>
        </article>
    );
};
