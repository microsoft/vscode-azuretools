/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * Shared types for the Template Gallery webview.
 * Used by both the webview React components and extension-side controllers.
 */

// ── Template model ──

export interface IProjectTemplate {
    id: string;
    displayName: string;
    shortDescription: string;
    repositoryUrl: string;
    branch?: string;
    folderPath?: string;
    subdirectory?: string;
    languages: string[];
    categories?: string[];
    category?: string;
    tags?: string[];
    resource?: string;
    priority?: number;
    isHighlighted?: boolean;
    isNew?: boolean;
    whatsIncluded?: string[];
    runtimeVersions?: string[];
}

// ── Configuration (passed as initial data to the webview) ──

export interface TemplateGalleryConfig {
    /** Service name displayed in UI, e.g. "Azure Functions" */
    serviceName: string;
    /** Main heading, e.g. "Create a new Azure Functions project" */
    headerTitle: string;
    /** Subtitle under heading */
    headerSubtitle: string;
    /** Whether to show the AI generation tab */
    supportsAiGeneration: boolean;
    /** Map of language keys to display names. Falls back to built-in defaults. */
    languageDisplayNames?: Record<string, string>;
    /** Map of category keys to display names */
    categoryDisplayNames?: Record<string, string>;
    /** Map of resource keys to display names */
    resourceDisplayNames?: Record<string, string>;
    /** Map of language keys to filter group keys (e.g., CSharp → dotnet) */
    languageFilterMap?: Record<string, string>;
    /** Ordered list of language filter keys for display order */
    languageOrder?: string[];
}

// ── Messages: Webview → Extension ──

export interface GetTemplatesMessage {
    type: 'getTemplates';
}

export interface RefreshTemplatesMessage {
    type: 'refreshTemplates';
}

export interface UseCachedTemplatesMessage {
    type: 'useCachedTemplates';
}

export interface TemplateSelectedMessage {
    type: 'templateSelected';
    templateId: string;
    template: IProjectTemplate;
}

export interface BrowseFolderMessage {
    type: 'browseFolder';
    source: 'template' | 'ai';
}

export interface CreateProjectMessage {
    type: 'createProject';
    template: IProjectTemplate;
    language: string;
    location: string;
}

export interface GenerateWithCopilotMessage {
    type: 'generateWithCopilot';
    prompt: string;
    language: string;
}

export interface CreateAiProjectMessage {
    type: 'createAiProject';
    files: Array<{ path: string; content: string }>;
    location: string;
}

export interface ContinueInChatMessage {
    type: 'continueInChat';
    prompt: string;
    language: string;
    context: 'prompt' | 'success' | 'error';
    projectData?: { title?: string; description?: string };
}

export interface ShowErrorMessage {
    type: 'showError';
    message: string;
}

export type WebviewToExtensionMessage =
    | GetTemplatesMessage
    | RefreshTemplatesMessage
    | UseCachedTemplatesMessage
    | TemplateSelectedMessage
    | BrowseFolderMessage
    | CreateProjectMessage
    | GenerateWithCopilotMessage
    | CreateAiProjectMessage
    | ContinueInChatMessage
    | ShowErrorMessage;

// ── Messages: Extension → Webview ──

export interface TemplatesResponseMessage {
    type: 'templates';
    templates: IProjectTemplate[];
    defaultLocation: string;
}

export interface ErrorResponseMessage {
    type: 'error';
    message: string;
}

export interface FolderSelectedMessage {
    type: 'folderSelected';
    path: string;
    source: 'template' | 'ai';
}

export interface ReadmeLoadingMessage {
    type: 'readmeLoading';
}

export interface ReadmeContentMessage {
    type: 'readmeContent';
    markdown: string;
}

export interface CreatingProgressMessage {
    type: 'creatingProgress';
    detail: string;
}

export interface ProjectCreationFailedMessage {
    type: 'projectCreationFailed';
    error: string;
}

export interface AiGeneratingMessage {
    type: 'aiGenerating';
}

export interface AiCompleteMessage {
    type: 'aiComplete';
    title: string;
    description: string;
    files: string[];
    projectData: {
        title: string;
        description: string;
        files: Array<{ path: string; content: string }>;
    };
}

export interface AiErrorMessage {
    type: 'aiError';
    error: string;
}

export interface ChatOpenedMessage {
    type: 'chatOpened';
}

export interface ChatUnavailableMessage {
    type: 'chatUnavailable';
    message: string;
}

export type ExtensionToWebviewMessage =
    | TemplatesResponseMessage
    | ErrorResponseMessage
    | FolderSelectedMessage
    | ReadmeLoadingMessage
    | ReadmeContentMessage
    | CreatingProgressMessage
    | ProjectCreationFailedMessage
    | AiGeneratingMessage
    | AiCompleteMessage
    | AiErrorMessage
    | ChatOpenedMessage
    | ChatUnavailableMessage;

// ── UI state types ──

export interface FilterState {
    language: string;
    useCase: string;
    resource: string;
    search: string;
}

export interface AiState {
    prompt: string;
    language: string;
    location: string;
    projectData: AiCompleteMessage['projectData'] | null;
    isGenerating: boolean;
}

export type ViewMode = 'browse' | 'ai';
export type ActiveView = 'gallery' | 'config' | 'creating';

// ── AI project result (returned by extension's generateWithCopilot) ──

export interface AiProjectResult {
    title: string;
    description: string;
    files: Array<{ path: string; content: string }>;
}

// ── Default display name maps ──

export const defaultLanguageFilterMap: Record<string, string> = {
    'JavaScript': 'javascript',
    'TypeScript': 'typescript',
    'Python': 'python',
    'CSharp': 'dotnet',
    'FSharp': 'dotnet',
    'C#': 'dotnet',
    'Java': 'java',
    'PowerShell': 'powershell',
    'Go': 'go',
};

export const defaultCategoryDisplayNames: Record<string, string> = {
    'starter': 'Starter',
    'web-apis': 'Web APIs',
    'event-processing': 'Event Processing',
    'scheduling': 'Scheduled Tasks',
    'ai-ml': 'AI & ML',
    'data-processing': 'Data Processing',
    'workflows': 'Orchestrations',
    'other': 'Other',
};

export const defaultResourceDisplayNames: Record<string, string> = {
    'http': 'HTTP',
    'timer': 'Timer',
    'cosmos': 'Cosmos DB',
    'eventhub': 'Event Hub',
    'servicebus': 'Service Bus',
    'storage': 'Storage',
    'signalr': 'SignalR',
    'eventgrid': 'Event Grid',
    'sql': 'SQL',
};

export const defaultLanguageDisplayNames: Record<string, string> = {
    'JavaScript': 'JavaScript',
    'TypeScript': 'TypeScript',
    'Go': 'Go',
    'Python': 'Python',
    'CSharp': '.NET',
    'FSharp': '.NET',
    'C#': '.NET',
    'Java': 'Java',
    'PowerShell': 'PowerShell',
};

export const defaultLanguageOrder = ['python', 'dotnet', 'typescript', 'javascript', 'java', 'go', 'powershell'];
