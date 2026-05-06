/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as React from 'react';
import { useReducer, useEffect, useCallback, useContext, type JSX } from 'react';
import { WebviewContext } from '../WebviewContext';
import { useConfiguration } from '../useConfiguration';
import { TemplateGalleryConfigProvider, useTemplateGalleryConfig } from './TemplateGalleryConfigContext';
import type {
    IProjectTemplate,
    FilterState,
    AiState,
    ViewMode,
    ActiveView,
    ExtensionToWebviewMessage,
    WebviewToExtensionMessage,
    AiCompleteMessage,
    TemplateGalleryConfig,
} from './types';
import { defaultLanguageFilterMap } from './types';
import { FilterBar } from './components/FilterBar';
import { TemplateCard } from './components/TemplateCard';
import { TemplateConfigView } from './components/TemplateConfigView';
import { CreatingView } from './components/CreatingView';
import { AiGenerateView } from './components/AiGenerateView';
import '../styles/templateGalleryView.scss';

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
        location: '',
        projectData: null,
        isGenerating: false,
    },
    readmeMarkdown: '',
    readmeLoading: false,
    creatingDetail: '',
};

// ── Actions ──

type Action =
    | { type: 'SET_TEMPLATES'; templates: IProjectTemplate[]; defaultLocation: string }
    | { type: 'SET_ERROR'; message: string }
    | { type: 'SET_LOADING' }
    | { type: 'SET_FILTER'; key: keyof FilterState; value: string }
    | { type: 'CLEAR_FILTERS' }
    | { type: 'SELECT_TEMPLATE'; template: IProjectTemplate }
    | { type: 'BACK_TO_GALLERY' }
    | { type: 'SET_MODE'; mode: ViewMode }
    | { type: 'SET_VIEW'; view: ActiveView }
    | { type: 'SET_PROJECT_LOCATION'; path: string }
    | { type: 'SET_AI_LOCATION'; path: string }
    | { type: 'SET_AI_PROMPT'; prompt: string }
    | { type: 'SET_AI_LANGUAGE'; language: string }
    | { type: 'SET_AI_GENERATING' }
    | { type: 'AI_COMPLETE'; data: AiCompleteMessage['projectData']; title: string; description: string; files: string[] }
    | { type: 'AI_ERROR'; error: string }
    | { type: 'SET_README_LOADING' }
    | { type: 'SET_README_CONTENT'; markdown: string }
    | { type: 'SET_CREATING_DETAIL'; detail: string }
    | { type: 'CREATION_FAILED' };

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
            if (a.isHighlighted && !b.isHighlighted) return -1;
            if (!a.isHighlighted && b.isHighlighted) return 1;
            const aPrio = a.priority ?? 999;
            const bPrio = b.priority ?? 999;
            if (aPrio !== bPrio) return aPrio - bPrio;
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
                    ai: {
                        ...state.ai,
                        location: state.ai.location || action.defaultLocation,
                    },
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
            case 'SET_AI_LOCATION':
                return { ...state, ai: { ...state.ai, location: action.path } };
            case 'SET_AI_PROMPT':
                return { ...state, ai: { ...state.ai, prompt: action.prompt } };
            case 'SET_AI_LANGUAGE':
                return { ...state, ai: { ...state.ai, language: action.language } };
            case 'SET_AI_GENERATING':
                return { ...state, ai: { ...state.ai, isGenerating: true, projectData: null } };
            case 'AI_COMPLETE':
                return {
                    ...state,
                    ai: {
                        ...state.ai,
                        isGenerating: false,
                        projectData: action.data,
                    },
                };
            case 'AI_ERROR':
                return { ...state, ai: { ...state.ai, isGenerating: false } };
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
                    if (message.source === 'ai') {
                        dispatch({ type: 'SET_AI_LOCATION', path: message.path });
                    } else {
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
                    postMessage({ type: 'showError', message: message.error });
                    break;
                case 'aiGenerating':
                    dispatch({ type: 'SET_AI_GENERATING' });
                    break;
                case 'aiComplete':
                    dispatch({
                        type: 'AI_COMPLETE',
                        data: message.projectData,
                        title: message.title,
                        description: message.description,
                        files: message.files,
                    });
                    break;
                case 'aiError':
                    dispatch({ type: 'AI_ERROR', error: message.error });
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

    const handleRefresh = useCallback(() => {
        dispatch({ type: 'SET_LOADING' });
        postMessage({ type: 'refreshTemplates' });
    }, [postMessage]);

    const handleUseCached = useCallback(() => {
        postMessage({ type: 'useCachedTemplates' });
    }, [postMessage]);

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
                <button
                    className={`mode-tab ${state.mode === 'browse' ? 'active' : ''}`}
                    onClick={() => dispatch({ type: 'SET_MODE', mode: 'browse' })}
                >
                    <span className="codicon codicon-extensions"></span>
                    Browse Templates
                </button>
                {config.supportsAiGeneration && (
                    <button
                        className={`mode-tab ${state.mode === 'ai' ? 'active' : ''}`}
                        onClick={() => dispatch({ type: 'SET_MODE', mode: 'ai' })}
                    >
                        <span className="codicon codicon-sparkle"></span>
                        Generate with Copilot
                    </button>
                )}
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
                    </div>

                    {state.isLoading && (
                        <div className="loading-state">
                            <span className="codicon codicon-loading codicon-modifier-spin"></span>
                            <p>Loading templates...</p>
                        </div>
                    )}

                    {state.error && !state.isLoading && (
                        <div className="error-state">
                            <span className="codicon codicon-warning error-icon"></span>
                            <h2>Unable to load templates</h2>
                            <p>Check your internet connection and try again</p>
                            <div className="error-actions">
                                <button className="primary-button" onClick={handleRefresh}>Retry</button>
                                <button className="secondary-button" onClick={handleUseCached}>Use Cached</button>
                            </div>
                        </div>
                    )}

                    {!state.isLoading && !state.error && state.filteredTemplates.length === 0 && (
                        <div className="empty-state">
                            <span className="codicon codicon-inbox empty-icon"></span>
                            <h2>No templates found</h2>
                            <p>Try adjusting your filters or search</p>
                            <button className="secondary-button" onClick={() => dispatch({ type: 'CLEAR_FILTERS' })}>
                                Clear all filters
                            </button>
                        </div>
                    )}

                    {!state.isLoading && !state.error && state.filteredTemplates.length > 0 && (
                        <>
                            {featured.length > 0 && (
                                <div className="template-section">
                                    <h2 className="section-heading">Featured Templates</h2>
                                    <div className="templates-grid" role="list" aria-label="Featured Templates">
                                        {featured.map(t => (
                                            <TemplateCard key={t.id} template={t} onSelect={handleSelectTemplate} />
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
                                            <TemplateCard key={t.id} template={t} onSelect={handleSelectTemplate} />
                                        ))}
                                    </div>
                                </div>
                            )}
                        </>
                    )}

                    <footer className="gallery-footer">
                        <button className="text-button" onClick={handleRefresh}>
                            <span className="codicon codicon-refresh"></span>
                            Refresh templates
                        </button>
                    </footer>
                </div>
            )}

            {/* AI Mode */}
            {state.mode === 'ai' && config.supportsAiGeneration && (
                <AiGenerateView
                    ai={state.ai}
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

    // Merge with defaults for languageFilterMap if not provided
    const mergedConfig: TemplateGalleryConfig = {
        ...config,
        languageFilterMap: { ...defaultLanguageFilterMap, ...config.languageFilterMap },
    };

    return (
        <TemplateGalleryConfigProvider config={mergedConfig}>
            <TemplateGalleryViewInner />
        </TemplateGalleryConfigProvider>
    );
};
