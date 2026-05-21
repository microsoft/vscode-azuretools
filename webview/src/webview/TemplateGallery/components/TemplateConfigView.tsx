/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Badge, Button, Dropdown, Input, Label, Option } from '@fluentui/react-components';
import { ArrowLeftRegular } from '@fluentui/react-icons';
import { useState, useMemo, useCallback, useId, type JSX } from 'react';
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

    const languageInputId = useId();
    const locationInputId = useId();

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
                if (seen.has(key)) { return null; }
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
                <Button
                    appearance="transparent"
                    icon={<ArrowLeftRegular />}
                    onClick={onBack}
                    aria-label="Back to gallery"
                >
                    Back
                </Button>
                <h1>Template Details</h1>
            </header>

            <div className="config-layout">
                <div className="config-left">
                    <div className="selected-template-card">
                        <h2>{template.displayName}</h2>
                        <p>{template.shortDescription}</p>
                        <div className="card-languages">
                            {languageBadges.map(b => (
                                <Badge key={b.key} appearance="filled" className={`language-badge ${b.filterClass}`}>
                                    {b.displayName}
                                </Badge>
                            ))}
                        </div>
                    </div>

                    <form className="config-form" onSubmit={handleSubmit}>
                        <div className="form-field">
                            <Label htmlFor={languageInputId} className="form-label">Language</Label>
                            {uniqueLanguages.length === 1 ? (
                                <span id={languageInputId} className="form-static">{uniqueLanguages[0]}</span>
                            ) : (
                                <Dropdown
                                    id={languageInputId}
                                    value={selectedLanguage}
                                    selectedOptions={[selectedLanguage]}
                                    onOptionSelect={(_ev, data) => {
                                        if (data.optionValue) { setSelectedLanguage(data.optionValue); }
                                    }}
                                >
                                    {uniqueLanguages.map(lang => (
                                        <Option key={lang} value={lang}>{lang}</Option>
                                    ))}
                                </Dropdown>
                            )}
                        </div>

                        <div className="form-field">
                            <Label htmlFor={locationInputId} className="form-label">Project Location</Label>
                            <div className="location-input-group">
                                <Input
                                    id={locationInputId}
                                    value={projectLocation}
                                    readOnly
                                    required
                                    className="form-input"
                                />
                                <Button appearance="secondary" onClick={onBrowse}>
                                    Browse...
                                </Button>
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
                            <Button
                                appearance="secondary"
                                icon={<ArrowLeftRegular />}
                                onClick={onBack}
                            >
                                Back to Gallery
                            </Button>
                            <Button
                                appearance="primary"
                                type="submit"
                                disabled={!projectLocation}
                            >
                                Create Project
                            </Button>
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
                            {/* eslint-disable-next-line @typescript-eslint/naming-convention */}
                            <div dangerouslySetInnerHTML={{ __html: renderMarkdown(readmeMarkdown) }} />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
