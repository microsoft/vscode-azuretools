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

export interface AiExamplePrompt {
    label: string;
    prompt: string;
}

export interface AiGenerationConfig {
    /** Label for the AI generation tab. */
    tabLabel?: string;
    /** Introductory copy above the prompt text area. */
    introDescription?: string;
    /** Placeholder shown in the prompt text area. */
    promptPlaceholder?: string;
    /** Accessible label for the prompt text area. */
    promptAriaLabel?: string;
    /** Label before example prompt chips. */
    examplesLabel?: string;
    /** Example prompt chips shown under the prompt text area. */
    examplePrompts?: AiExamplePrompt[];
    /** Label for the language picker. */
    languageLabel?: string;
    /** Primary button text for opening chat. */
    openChatButtonLabel?: string;
    /** Confirmation heading shown after chat is requested. */
    chatConfirmationTitle?: string;
    /** Confirmation copy shown after chat is requested. */
    chatConfirmationDescription?: string;
    /** Back button text in the confirmation view. */
    chatConfirmationBackLabel?: string;
    /** Heading for the capabilities panel. */
    capabilitiesTitle?: string;
    /** Accessible label for the capabilities list. */
    capabilitiesAriaLabel?: string;
    /** Capability bullets shown in the AI tab. */
    capabilities?: string[];
}

export interface ResolvedAiGenerationConfig {
    tabLabel: string;
    introDescription: string;
    promptPlaceholder: string;
    promptAriaLabel: string;
    examplesLabel: string;
    examplePrompts: AiExamplePrompt[];
    languageLabel: string;
    openChatButtonLabel: string;
    chatConfirmationTitle: string;
    chatConfirmationDescription: string;
    chatConfirmationBackLabel: string;
    capabilitiesTitle: string;
    capabilitiesAriaLabel: string;
    capabilities: string[];
}

export interface TemplateGalleryConfig {
    /** Service name displayed in UI, e.g. "Azure Functions" */
    serviceName: string;
    /** Main heading, e.g. "Create a new Azure Functions project" */
    headerTitle: string;
    /** Subtitle under heading */
    headerSubtitle: string;
    /** Whether to show the AI generation tab */
    supportsAiGeneration: boolean;
    /** AI generation tab display configuration. */
    aiGeneration?: AiGenerationConfig;
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
    /** Ordered list of category keys for display order. Unlisted categories appear alphabetically at the end. */
    categoryOrder?: string[];
    /** Ordered list of resource keys for display order. Unlisted resources appear alphabetically at the end. */
    resourceOrder?: string[];
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

export interface ContinueInChatMessage {
    type: 'continueInChat';
    prompt: string;
    language: string;
    location: string;
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
    | ChatOpenedMessage
    | ChatUnavailableMessage;

// ── UI state types ──

export interface FilterState {
    language: string;
    useCase: string;
    resource: string;
    search: string;
}

/**
 * AI tab state. The AI tab is now a chat-handoff funnel — Copilot Chat owns
 * the multi-turn design + file-writing flow, so the webview only needs to
 * track the prompt and language used to ground the chat conversation.
 */
export interface AiState {
    prompt: string;
    language: string;
}

export type ViewMode = 'browse' | 'ai';
export type ActiveView = 'gallery' | 'config' | 'creating';

// ── Reducer action contract (shared between TemplateGalleryView and child components like AiGenerateView) ──

export type TemplateGalleryAction =
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
    | { type: 'SET_AI_PROMPT'; prompt: string }
    | { type: 'SET_AI_LANGUAGE'; language: string }
    | { type: 'SET_README_LOADING' }
    | { type: 'SET_README_CONTENT'; markdown: string }
    | { type: 'SET_CREATING_DETAIL'; detail: string }
    | { type: 'CREATION_FAILED' };

// ── Default display name maps ──
// These maps use external manifest keys which don't follow camelCase conventions
/* eslint-disable @typescript-eslint/naming-convention */

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

/**
 * Default category display order. Categories listed here appear first (in this order);
 * any categories from templates not listed here are appended alphabetically at the end.
 */
export const defaultCategoryOrder: string[] = [
    'starter',
    'web-apis',
    'data-processing',
    'event-processing',
    'ai-ml',
    'scheduling',
    'workflows',
    'other',
];

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

/**
 * Default resource display order. Resources listed here appear first (in this order);
 * any resources from templates not listed here are appended alphabetically at the end.
 */
export const defaultResourceOrder: string[] = [
    'http',
    'timer',
    'storage',
    'cosmos',
    'sql',
    'eventhub',
    'eventgrid',
    'servicebus',
    'signalr',
];

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

/* eslint-enable @typescript-eslint/naming-convention */

export const defaultLanguageOrder = ['python', 'dotnet', 'typescript', 'javascript', 'java', 'go', 'powershell'];

export const defaultAiGenerationConfig: ResolvedAiGenerationConfig = {
    tabLabel: 'Build with Copilot Chat',
    introDescription: 'Describe the Azure Functions app you want to build. Copilot Chat will help you design, scaffold, and refine it — with full visibility into every change before it is applied to your workspace.',
    promptPlaceholder: 'e.g., I need an HTTP API that receives sensor readings, validates the data, and stores it in Azure Cosmos DB. It should also send alerts to a Service Bus queue when values exceed a threshold.',
    promptAriaLabel: 'Describe your function app',
    examplesLabel: 'Try an example:',
    examplePrompts: [
        {
            label: 'HTTP API + Cosmos DB',
            prompt: 'I need an HTTP API that receives JSON payloads, validates them, and stores the records in Azure Cosmos DB. Include input validation and clear error responses.',
        },
        {
            label: 'Service Bus consumer',
            prompt: 'A Service Bus queue trigger that processes order messages, calls a downstream HTTP API to enrich each order, and writes the result to Blob Storage.',
        },
        {
            label: 'Timer-driven cleanup',
            prompt: 'A timer-triggered job that runs every night, scans a Cosmos DB container for documents older than 90 days, and archives them to Blob Storage before deleting.',
        },
        {
            label: 'Event Grid webhook',
            prompt: 'An Event Grid-triggered function that handles BlobCreated events, generates a thumbnail for each uploaded image, and writes it back to a different container.',
        },
    ],
    languageLabel: 'Language',
    openChatButtonLabel: 'Open in Copilot Chat',
    chatConfirmationTitle: 'Copilot Chat is opening...',
    chatConfirmationDescription: 'Your prompt has been pre-filled with Azure Functions best-practice guidance. Continue the conversation in the chat panel to design and generate your app — you will review every change before it is applied to your workspace.',
    chatConfirmationBackLabel: 'Back to prompt',
    capabilitiesTitle: 'What Copilot Chat will do',
    capabilitiesAriaLabel: 'Copilot Chat capabilities',
    capabilities: [
        'Multi-turn design conversation — you stay in control',
        'Reads your workspace for context-aware suggestions',
        'Writes files directly with your review at each step',
        'Can run terminal commands and iterate on errors',
    ],
};
