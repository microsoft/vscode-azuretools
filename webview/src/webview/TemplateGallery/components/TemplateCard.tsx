/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Button, Badge } from '@fluentui/react-components';
import { useMemo, useCallback, type JSX } from 'react';
import { useTemplateGalleryConfig } from '../TemplateGalleryConfigContext';
import type { IProjectTemplate } from '../types';

interface TemplateCardProps {
    template: IProjectTemplate;
    onSelect: (template: IProjectTemplate) => void;
}

export const TemplateCard = ({ template, onSelect }: TemplateCardProps): JSX.Element => {
    const { languageDisplayNames, languageFilterMap, categoryDisplayNames } = useTemplateGalleryConfig();

    const handleSelect = useCallback(() => onSelect(template), [template, onSelect]);

    // Deduplicate language badges
    const languageBadges = useMemo(() => {
        const seen = new Set<string>();
        return template.languages
            .map(lang => {
                const displayName = languageDisplayNames[lang] || lang;
                const filterClass = languageFilterMap[lang] || 'other';
                const key = `${filterClass}-${displayName}`;
                if (seen.has(key)) {return null;}
                seen.add(key);
                return { displayName, filterClass, key };
            })
            .filter(Boolean) as Array<{ displayName: string; filterClass: string; key: string }>;
    }, [template.languages, languageDisplayNames, languageFilterMap]);

    const categories = template.categories || (template.category ? [template.category] : []);

    return (
        <article
            className={`template-card ${template.isHighlighted ? 'featured' : ''}`}
            role="listitem"
            aria-label={`${template.displayName}. ${template.shortDescription}`}
        >
            <div className="card-languages">
                {languageBadges.map(b => (
                    <Badge key={b.key} appearance="filled" className={`language-badge ${b.filterClass}`}>
                        {b.displayName}
                    </Badge>
                ))}
            </div>
            <h3 className="card-title">{template.displayName}</h3>
            <p className="card-description">{template.shortDescription}</p>
            <div className="card-footer">
                <div className="card-badges">
                    {categories.map(c => (
                        <Badge key={c} appearance="outline" className="category-badge">
                            {categoryDisplayNames[c] || c}
                        </Badge>
                    ))}
                    {template.isNew && (
                        <Badge appearance="tint" color="success" className="new-badge">
                            <span className="codicon codicon-sparkle"></span>New
                        </Badge>
                    )}
                </div>
                <Button
                    appearance="primary"
                    size="small"
                    className="use-template-btn"
                    onClick={handleSelect}
                >
                    Use Template
                </Button>
            </div>
        </article>
    );
};
