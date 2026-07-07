/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Button, Spinner, Tab, TabList, type SelectTabData, type SelectTabEvent } from '@fluentui/react-components';
import * as React from 'react';
import { useCallback, useContext, useEffect, useMemo, useReducer, type JSX } from 'react';
import { WebviewContext } from '../WebviewContext';
import '../styles/templateGalleryView.scss';
import { useConfiguration } from '../useConfiguration';
import { TemplateGalleryConfigProvider, useTemplateGalleryConfig } from './TemplateGalleryConfigContext';
import { AiGenerateView } from './components/AiGenerateView';
import { CreatingView } from './components/CreatingView';
import { FilterBar } from './components/FilterBar';
import { TemplateCard } from './components/TemplateCard';
import { TemplateConfigView } from './components/TemplateConfigView';
import type {
    TemplateGalleryAction as Action,
    ActiveView,
    AiState,
    ExtensionToWebviewMessage,
    FilterState,
    IProjectTemplate,
    TemplateGalleryConfig,
    ViewMode,
    WebviewToExtensionMessage,
} from './types';
import { defaultLanguageFilterMap } from './types';

// ── State ──

interface GalleryState {
    templates: IProjectTemplate[];
    filteredTemplates: IProjectTemplate[];
    selectedTemplate: IProjectTemplate | null;
    filters: FilterState;
    projectLocation: string;
    isLoading: boolean;
    error: string | null;
    mode: ViewMode;
    activeView: ActiveView;
    ai: AiState;
    readmeMarkdown: string;
    readmeLoading: boolean;
    creatingDetail: string;
}

const initialState: GalleryState = {
    templates: [],
    filteredTemplates: [],
    selectedTemplate: null,
    filters: { language: 'all', useCase: 'all', resource: 'all', search: '' },
    projectLocation: '',
    isLoading: true,
    error: null,
    mode: 'browse',
    activeView: 'gallery',
    ai: {
        prompt: '',
        language: 'TypeScript',
    },
    readmeMarkdown: '',
    readmeLoading: false,
    creatingDetail: '',
};

function createApplyFilters(languageFilterMap: Record<string, string>) {
    return function applyFilters(templates: IProjectTemplate[], filters: FilterState): IProjectTemplate[] {
        let results = [...templates];

        if (filters.language !== 'all') {
            results = results.filter(t =>
                t.languages.some(lang => languageFilterMap[lang] === filters.language)
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
                (t.tags && t.tags.some(tag => tag.toLowerCase().includes(query)))
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

function createReducer(languageFilterMap: Record<string, string>) {
    const applyFilters = createApplyFilters(languageFilterMap);

    return function reducer(state: GalleryState, action: Action): GalleryState {
        switch (action.type) {
            case 'SET_TEMPLATES': {
                const newState = {
                    ...state,
                    templates: action.templates,
                    isLoading: false,
                    error: null,
                    projectLocation: state.projectLocation || action.defaultLocation,
                };
                newState.filteredTemplates = applyFilters(newState.templates, newState.filters);
                return newState;
            }
            case 'SET_ERROR':
                return { ...state, isLoading: false, error: action.message };
            case 'SET_LOADING':
                return { ...state, isLoading: true, error: null };
            case 'SET_FILTER': {
                const newFilters = { ...state.filters, [action.key]: action.value };
                return {
                    ...state,
                    filters: newFilters,
                    filteredTemplates: applyFilters(state.templates, newFilters),
                };
            }
            case 'CLEAR_FILTERS': {
                const cleared: FilterState = { language: 'all', useCase: 'all', resource: 'all', search: '' };
                return {
                    ...state,
                    filters: cleared,
                    filteredTemplates: applyFilters(state.templates, cleared),
                };
            }
            case 'SELECT_TEMPLATE':
                return {
                    ...state,
                    selectedTemplate: action.template,
                    activeView: 'config',
                    readmeMarkdown: '',
                    readmeLoading: false,
                };
            case 'BACK_TO_GALLERY':
                return {
                    ...state,
                    activeView: 'gallery',
                    selectedTemplate: null,
                    readmeMarkdown: '',
                    readmeLoading: false,
                };
            case 'SET_MODE':
                return { ...state, mode: action.mode };
            case 'SET_VIEW':
                return { ...state, activeView: action.view };
            case 'SET_PROJECT_LOCATION':
                return { ...state, projectLocation: action.path };
            case 'SET_AI_PROMPT':
                return { ...state, ai: { ...state.ai, prompt: action.prompt } };
            case 'SET_AI_LANGUAGE':
                return { ...state, ai: { ...state.ai, language: action.language } };
            case 'SET_README_LOADING':
                return { ...state, readmeLoading: true, readmeMarkdown: '' };
            case 'SET_README_CONTENT':
                return { ...state, readmeLoading: false, readmeMarkdown: action.markdown };
            case 'SET_CREATING_DETAIL':
                return { ...state, creatingDetail: action.detail };
            case 'CREATION_FAILED':
                return { ...state, activeView: 'gallery' };
            default:
                return state;
        }
    };
}

// ── Inner component that uses config context ──

const TemplateGalleryViewInner = (): JSX.Element => {
    const { vscodeApi } = useContext(WebviewContext);
    const config = useTemplateGalleryConfig();

    const reducer = React.useMemo(() => createReducer(config.languageFilterMap), [config.languageFilterMap]);
    const [state, dispatch] = useReducer(reducer, initialState);

    const postMessage = useCallback((msg: WebviewToExtensionMessage) => {
        vscodeApi.postMessage(msg);
    }, [vscodeApi]);

    // Listen for messages from extension
    useEffect(() => {
        const handler = (event: MessageEvent<ExtensionToWebviewMessage>) => {
            const message = event.data;
            switch (message.type) {
                case 'templates':
                    dispatch({ type: 'SET_TEMPLATES', templates: message.templates, defaultLocation: message.defaultLocation });
                    break;
                case 'error':
                    dispatch({ type: 'SET_ERROR', message: message.message });
                    break;
                case 'folderSelected':
                    // AI tab no longer needs a folder picker — Copilot Chat owns the
                    // file-writing flow and resolves the destination itself.
                    if (message.source === 'template') {
                        dispatch({ type: 'SET_PROJECT_LOCATION', path: message.path });
                    }
                    break;
                case 'readmeLoading':
                    dispatch({ type: 'SET_README_LOADING' });
                    break;
                case 'readmeContent':
                    dispatch({ type: 'SET_README_CONTENT', markdown: message.markdown });
                    break;
                case 'creatingProgress':
                    dispatch({ type: 'SET_CREATING_DETAIL', detail: message.detail });
                    break;
                case 'projectCreationFailed':
                    dispatch({ type: 'CREATION_FAILED' });
                    // Empty error indicates a silent cancellation (e.g. user declined a confirmation prompt) — don't surface a dialog.
                    if (message.error) {
                        postMessage({ type: 'showError', message: message.error });
                    }
                    break;
            }
        };

        window.addEventListener('message', handler);
        return () => window.removeEventListener('message', handler);
    }, [postMessage]);

    // Request templates on mount
    useEffect(() => {
        postMessage({ type: 'getTemplates' });
    }, [postMessage]);

    // ── Handlers ──

    const handleSelectTemplate = useCallback((template: IProjectTemplate) => {
        dispatch({ type: 'SELECT_TEMPLATE', template });
        postMessage({ type: 'templateSelected', templateId: template.id, template });
    }, [postMessage]);

    const handleBackToGallery = useCallback(() => {
        dispatch({ type: 'BACK_TO_GALLERY' });
    }, []);

    const handleBrowseFolder = useCallback((source: 'template' | 'ai') => {
        postMessage({ type: 'browseFolder', source });
    }, [postMessage]);

    const handleCreateProject = useCallback((template: IProjectTemplate, language: string, location: string) => {
        dispatch({ type: 'SET_VIEW', view: 'creating' });
        postMessage({ type: 'createProject', template, language, location });
    }, [postMessage]);

    // "Use Template" button on the card → create immediately using the default
    // project location and the template's first language. Skips the details screen.
    const handleUseTemplateDirect = useCallback((template: IProjectTemplate) => {
        const language = template.languages[0] || '';
        handleCreateProject(template, language, state.projectLocation);
    }, [handleCreateProject, state.projectLocation]);

    const handleRefresh = useCallback(() => {
        dispatch({ type: 'SET_LOADING' });
        postMessage({ type: 'refreshTemplates' });
    }, [postMessage]);

    const handleUseCached = useCallback(() => {
        postMessage({ type: 'useCachedTemplates' });
    }, [postMessage]);

    const handleTabSelect = useCallback((_event: SelectTabEvent, data: SelectTabData) => {
        dispatch({ type: 'SET_MODE', mode: data.value as ViewMode });
    }, [dispatch]);

    // ── Render ──

    if (state.activeView === 'config' && state.selectedTemplate) {
        return (
            <TemplateConfigView
                template={state.selectedTemplate}
                projectLocation={state.projectLocation}
                readmeMarkdown={state.readmeMarkdown}
                readmeLoading={state.readmeLoading}
                onBack={handleBackToGallery}
                onBrowse={() => handleBrowseFolder('template')}
                onCreateProject={handleCreateProject}
            />
        );
    }

    if (state.activeView === 'creating') {
        return <CreatingView detail={state.creatingDetail} />;
    }

    // Gallery view
    const featured = state.filteredTemplates.filter(t => t.isHighlighted);
    const rest = state.filteredTemplates.filter(t => !t.isHighlighted);

    return (
        <div className="template-gallery">
            <header className="gallery-header">
                <div className="header-content">
                    <h1>{config.headerTitle}</h1>
                    <p className="subtitle">{config.headerSubtitle}</p>
                </div>
            </header>

            {/* Mode Toggle */}
            <div className="mode-toggle">
                <TabList
                    selectedValue={state.mode}
                    onTabSelect={handleTabSelect}
                >
                    <Tab value="browse" icon={<span className="codicon codicon-extensions"></span>}>
                        Browse Templates
                    </Tab>
                    {config.supportsAiGeneration && (
                        <Tab value="ai" icon={<span className="codicon codicon-sparkle"></span>}>
                            {config.aiGeneration.tabLabel}
                        </Tab>
                    )}
                </TabList>
            </div>

            {/* Browse Mode */}
            {state.mode === 'browse' && (
                <div className="browse-content">
                    <FilterBar
                        templates={state.templates}
                        filters={state.filters}
                        onFilterChange={(key, value) => dispatch({ type: 'SET_FILTER', key, value })}
                        onClearFilters={() => dispatch({ type: 'CLEAR_FILTERS' })}
                    />

                    <div className="results-bar">
                        <span className="results-count">
                            Showing {state.filteredTemplates.length} template{state.filteredTemplates.length !== 1 ? 's' : ''}
                        </span>
                        <Button
                            appearance="transparent"
                            icon={<span className="codicon codicon-refresh"></span>}
                            onClick={handleRefresh}
                            className="refresh-btn"
                            title="Refresh templates"
                            aria-label="Refresh templates"
                        >
                            Refresh
                        </Button>
                    </div>

                    {state.isLoading && (
                        <div className="loading-state">
                            <Spinner size="medium" label="Loading templates..." />
                        </div>
                    )}

                    {state.error && !state.isLoading && (
                        <div className="error-state">
                            <span className="codicon codicon-warning error-icon"></span>
                            <h2>Unable to load templates</h2>
                            <p>Check your internet connection and try again</p>
                            <div className="error-actions">
                                <Button appearance="primary" onClick={handleRefresh}>Retry</Button>
                                <Button appearance="secondary" onClick={handleUseCached}>Use Cached</Button>
                            </div>
                        </div>
                    )}

                    {!state.isLoading && !state.error && state.filteredTemplates.length === 0 && (
                        <div className="empty-state">
                            <span className="codicon codicon-inbox empty-icon"></span>
                            <h2>No templates found</h2>
                            <p>Try adjusting your filters or search</p>
                            <Button appearance="secondary" onClick={() => dispatch({ type: 'CLEAR_FILTERS' })}>
                                Clear all filters
                            </Button>
                        </div>
                    )}

                    {!state.isLoading && !state.error && state.filteredTemplates.length > 0 && (
                        <>
                            {featured.length > 0 && (
                                <div className="template-section">
                                    <h2 className="section-heading">Featured Templates</h2>
                                    <div className="templates-grid" role="list" aria-label="Featured Templates">
                                        {featured.map(t => (
                                            <TemplateCard key={t.id} template={t} onSelect={handleSelectTemplate} onUseTemplate={handleUseTemplateDirect} />
                                        ))}
                                    </div>
                                </div>
                            )}

                            {rest.length > 0 && (
                                <div className="template-section">
                                    <h2 className="section-heading">
                                        {featured.length > 0 ? 'Explore More Templates' : 'All Templates'}
                                    </h2>
                                    <div className="templates-grid" role="list" aria-label="Templates">
                                        {rest.map(t => (
                                            <TemplateCard key={t.id} template={t} onSelect={handleSelectTemplate} onUseTemplate={handleUseTemplateDirect} />
                                        ))}
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            )}

            {/* AI Mode */}
            {state.mode === 'ai' && config.supportsAiGeneration && (
                <AiGenerateView
                    ai={state.ai}
                    projectLocation={state.projectLocation}
                    postMessage={postMessage}
                    dispatch={dispatch}
                />
            )}
        </div>
    );
};

// ── Public component (wraps with config provider) ──

export const TemplateGalleryView = (): JSX.Element => {
    const config = useConfiguration<TemplateGalleryConfig>();

    // Memoize the merged config so the context value (and every consumer) keeps a stable
    // identity across renders. Without this, every parent re-render recreates the object
    // and invalidates the provider's internal memo, re-rendering FilterBar, TemplateCard, etc.
    const mergedConfig: TemplateGalleryConfig = useMemo(() => ({
        ...config,
        languageFilterMap: { ...defaultLanguageFilterMap, ...config.languageFilterMap },
    }), [config]);

    return (
        <TemplateGalleryConfigProvider config={mergedConfig}>
            <TemplateGalleryViewInner />
        </TemplateGalleryConfigProvider>
    );
};
