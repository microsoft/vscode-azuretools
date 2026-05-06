/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { WebviewBaseController } from './WebviewBaseController';
import type { IProjectTemplate, TemplateGalleryConfig, WebviewToExtensionMessage, ExtensionToWebviewMessage } from '../webview/TemplateGallery/types';

/**
 * Abstract controller for the Template Gallery webview panel.
 *
 * Consuming extensions subclass this and implement the abstract methods
 * to provide service-specific template fetching, project creation, etc.
 *
 * The UI is owned by the shared package. The controller routes messages
 * between the webview and the extension-specific business logic.
 */
export abstract class TemplateGalleryController extends WebviewBaseController<TemplateGalleryConfig> {
    private _panel: vscode.WebviewPanel;

    constructor(
        context: vscode.ExtensionContext,
        config: TemplateGalleryConfig,
        viewColumn: vscode.ViewColumn = vscode.ViewColumn.Active,
    ) {
        super(context, 'templateGalleryView', config);

        this._panel = vscode.window.createWebviewPanel(
            'templateGallery',
            config.headerTitle ?? 'Template Gallery',
            viewColumn,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [vscode.Uri.file(context.extensionPath)],
            },
        );

        this._panel.webview.html = this.getDocumentTemplate(this._panel.webview);

        this._panel.webview.onDidReceiveMessage(
            (message: WebviewToExtensionMessage) => this._handleMessage(message),
        );

        this.registerDisposable(
            this._panel.onDidDispose(() => {
                this.dispose();
            }),
        );
    }

    // ── Public API ──

    /** The underlying webview panel. */
    public get panel(): vscode.WebviewPanel {
        return this._panel;
    }

    /** Reveal the panel in the editor. */
    public revealToForeground(viewColumn: vscode.ViewColumn = vscode.ViewColumn.Active): void {
        this._panel.reveal(viewColumn, true);
    }

    // ── Abstract methods (implemented by consuming extensions) ──

    /** Fetch templates from the extension's manifest source. */
    protected abstract fetchTemplates(): Promise<{ templates: IProjectTemplate[]; defaultLocation: string }>;

    /** Create a project from the selected template. */
    protected abstract createProject(template: IProjectTemplate, language: string, location: string): Promise<void>;

    /** Fetch the README markdown for a selected template. */
    protected abstract getReadme(template: IProjectTemplate): Promise<string>;

    // ── Optional overrides ──

    /** Generate a project using AI/Copilot. Override to enable AI generation. */
    protected async generateWithCopilot(_prompt: string, _language: string): Promise<void> {
        // No-op by default. Override in extension if supportsAiGeneration is true.
    }

    /** Create the AI-generated project files on disk. Override to enable AI generation. */
    protected async createAiProject(_files: Array<{ path: string; content: string }>, _location: string): Promise<void> {
        // No-op by default. Override in extension if supportsAiGeneration is true.
    }

    /** Continue an AI conversation in the VS Code chat. Override to enable. */
    protected async continueInChat(_prompt: string, _language: string, _context: string, _projectData?: { title?: string; description?: string }): Promise<void> {
        // No-op by default.
    }

    /** Called when a template is selected (e.g. for telemetry). */
    protected onTemplateSelected(_templateId: string, _template: IProjectTemplate): void {
        // No-op by default.
    }

    /** Show an error to the user. */
    protected async showError(message: string): Promise<void> {
        await vscode.window.showErrorMessage(message);
    }

    /** Open a folder picker dialog. Returns the selected path or undefined. */
    protected async browseFolder(): Promise<string | undefined> {
        const result = await vscode.window.showOpenDialog({
            canSelectFolders: true,
            canSelectFiles: false,
            canSelectMany: false,
            openLabel: 'Select Folder',
        });
        return result?.[0]?.fsPath;
    }

    /** Fetch cached templates when offline. Override if caching is supported. */
    protected async fetchCachedTemplates(): Promise<{ templates: IProjectTemplate[]; defaultLocation: string } | undefined> {
        return undefined;
    }

    // ── Message posting helpers ──

    /** Post a typed message to the webview. */
    protected postMessageToWebview(message: ExtensionToWebviewMessage): void {
        if (!this.isDisposed) {
            void this._panel.webview.postMessage(message);
        }
    }

    /** Send a progress update to the webview during project creation. */
    protected sendProgress(detail: string): void {
        this.postMessageToWebview({ type: 'creatingProgress', detail });
    }

    // ── Message routing ──

    private async _handleMessage(message: WebviewToExtensionMessage): Promise<void> {
        switch (message.type) {
            case 'getTemplates':
            case 'refreshTemplates':
                await this._handleGetTemplates();
                break;

            case 'useCachedTemplates':
                await this._handleUseCached();
                break;

            case 'templateSelected':
                this.onTemplateSelected(message.templateId, message.template);
                await this._handleReadme(message.template);
                break;

            case 'createProject':
                await this._handleCreateProject(message.template, message.language, message.location);
                break;

            case 'browseFolder':
                await this._handleBrowseFolder(message.source);
                break;

            case 'generateWithCopilot':
                await this._handleGenerateWithCopilot(message.prompt, message.language);
                break;

            case 'createAiProject':
                await this._handleCreateAiProject(message.files, message.location);
                break;

            case 'continueInChat':
                await this.continueInChat(message.prompt, message.language, message.context, message.projectData);
                break;

            case 'showError':
                await this.showError(message.message);
                break;
        }
    }

    private async _handleGetTemplates(): Promise<void> {
        try {
            const result = await this.fetchTemplates();
            this.postMessageToWebview({
                type: 'templates',
                templates: result.templates,
                defaultLocation: result.defaultLocation,
            });
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            this.postMessageToWebview({ type: 'error', message: msg });
        }
    }

    private async _handleUseCached(): Promise<void> {
        try {
            const result = await this.fetchCachedTemplates();
            if (result) {
                this.postMessageToWebview({
                    type: 'templates',
                    templates: result.templates,
                    defaultLocation: result.defaultLocation,
                });
            } else {
                this.postMessageToWebview({ type: 'error', message: 'No cached templates available.' });
            }
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            this.postMessageToWebview({ type: 'error', message: msg });
        }
    }

    private async _handleReadme(template: IProjectTemplate): Promise<void> {
        this.postMessageToWebview({ type: 'readmeLoading' });
        try {
            const markdown = await this.getReadme(template);
            this.postMessageToWebview({ type: 'readmeContent', markdown });
        } catch {
            this.postMessageToWebview({ type: 'readmeContent', markdown: '' });
        }
    }

    private async _handleCreateProject(template: IProjectTemplate, language: string, location: string): Promise<void> {
        try {
            await this.createProject(template, language, location);
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            this.postMessageToWebview({ type: 'projectCreationFailed', error: msg });
        }
    }

    private async _handleBrowseFolder(source: 'template' | 'ai'): Promise<void> {
        const folderPath = await this.browseFolder();
        if (folderPath) {
            this.postMessageToWebview({ type: 'folderSelected', path: folderPath, source });
        }
    }

    private async _handleGenerateWithCopilot(prompt: string, language: string): Promise<void> {
        this.postMessageToWebview({ type: 'aiGenerating' });
        try {
            await this.generateWithCopilot(prompt, language);
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            this.postMessageToWebview({ type: 'aiError', error: msg });
        }
    }

    private async _handleCreateAiProject(files: Array<{ path: string; content: string }>, location: string): Promise<void> {
        try {
            await this.createAiProject(files, location);
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            this.postMessageToWebview({ type: 'aiError', error: msg });
        }
    }
}
