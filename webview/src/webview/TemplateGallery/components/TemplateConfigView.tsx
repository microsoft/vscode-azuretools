/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as React from 'react';
import { useState, useMemo, useCallback, type JSX } from 'react';
import { useTemplateGalleryConfig } from '../TemplateGalleryConfigContext';
import type { IProjectTemplate } from '../types';
import { renderMarkdown } from '../utils/renderMarkdown';

interface TemplateConfigViewProps {
    template: IProjectTemplate;
    projectLocation: string;
    readmeMarkdown: string;
    readmeLoading: boolean;
    onBack: () => void;
    onBrowse: () => void;
    onCreateProject: (template: IProjectTemplate, language: string, location: string) => void;
}

export const TemplateConfigView = ({
    template,
    projectLocation,
    readmeMarkdown,
    readmeLoading,
    onBack,
    onBrowse,
    onCreateProject,
}: TemplateConfigViewProps): JSX.Element => {
    const { languageDisplayNames, languageFilterMap } = useTemplateGalleryConfig();

    const uniqueLanguages = useMemo(() => [...new Set(template.languages)], [template.languages]);
    const [selectedLanguage, setSelectedLanguage] = useState(uniqueLanguages[0] || '');

    const handleSubmit = useCallback((e: React.FormEvent) => {
        e.preventDefault();
        if (selectedLanguage && projectLocation) {
            onCreateProject(template, selectedLanguage, projectLocation);
        }
    }, [template, selectedLanguage, projectLocation, onCreateProject]);

    const languageBadges = useMemo(() => {
        const seen = new Set<string>();
        return template.languages
            .map(lang => {
                const displayName = languageDisplayNames[lang] || lang;
                const filterClass = languageFilterMap[lang] || 'other';
                const key = `${filterClass}-${displayName}`;
                if (seen.has(key)) return null;
                seen.add(key);
                return { displayName, filterClass, key };
            })
            .filter(Boolean) as Array<{ displayName: string; filterClass: string; key: string }>;
    }, [template.languages, languageDisplayNames, languageFilterMap]);

    const whatsIncluded = template.whatsIncluded && template.whatsIncluded.length > 0
        ? template.whatsIncluded
        : [
            'Working function code with best practices',
            'Infrastructure files for Azure deployment',
            'README with setup instructions',
            'VS Code debug configuration'
        ];

    return (
        <div className="config-view">
            <header className="config-header">
                <button className="back-button" aria-label="Back to gallery" onClick={onBack}>
                    <span className="codicon codicon-arrow-left"></span>
                    Back
                </button>
                <h1>Configure your project</h1>
            </header>

            <div className="config-layout">
                <div className="config-left">
                    <div className="selected-template-card">
                        <h2>{template.displayName}</h2>
                        <p>{template.shortDescription}</p>
                        <div className="card-languages">
                            {languageBadges.map(b => (
                                <span key={b.key} className={`language-badge ${b.filterClass}`}>
                                    {b.displayName}
                                </span>
                            ))}
                        </div>
                    </div>

                    <form className="config-form" onSubmit={handleSubmit}>
                        <div className="form-group">
                            <label htmlFor="language-select">Language</label>
                            {uniqueLanguages.length === 1 ? (
                                <span className="form-static">{uniqueLanguages[0]}</span>
                            ) : (
                                <select
                                    id="language-select"
                                    className="form-select"
                                    value={selectedLanguage}
                                    onChange={e => setSelectedLanguage(e.target.value)}
                                >
                                    {uniqueLanguages.map(lang => (
                                        <option key={lang} value={lang}>{lang}</option>
                                    ))}
                                </select>
                            )}
                        </div>

                        <div className="form-group">
                            <label htmlFor="location-input">Project Location</label>
                            <div className="location-input-group">
                                <input
                                    type="text"
                                    id="location-input"
                                    className="form-input"
                                    value={projectLocation}
                                    readOnly
                                    required
                                />
                                <button type="button" className="secondary-button" onClick={onBrowse}>
                                    Browse...
                                </button>
                            </div>
                        </div>

                        <div className="whats-included">
                            <h3>What&apos;s included:</h3>
                            <ul className="included-list">
                                {whatsIncluded.map((item, i) => (
                                    <li key={i}>
                                        <span className="codicon codicon-check"></span> {item}
                                    </li>
                                ))}
                            </ul>
                        </div>

                        <div className="form-actions">
                            <button type="button" className="secondary-button" onClick={onBack}>
                                <span className="codicon codicon-arrow-left"></span> Back to Gallery
                            </button>
                            <button type="submit" className="primary-button" disabled={!projectLocation}>
                                Create Project
                            </button>
                        </div>
                    </form>
                </div>

                <div className="config-right">
                    {readmeLoading && (
                        <div className="readme-loading">
                            <span className="codicon codicon-loading codicon-modifier-spin"></span>
                            <span>Loading README...</span>
                        </div>
                    )}
                    {readmeMarkdown && (
                        <div className="readme-content">
                            <div className="readme-header">
                                <span className="codicon codicon-book"></span> README
                            </div>
                            <div dangerouslySetInnerHTML={{ __html: renderMarkdown(readmeMarkdown) }} />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
