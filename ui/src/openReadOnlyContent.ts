/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { isNumber } from "util";
import { CancellationToken, Event, EventEmitter, TextDocument, TextDocumentContentProvider, TextDocumentShowOptions, Uri, window, workspace, WorkspaceConfiguration } from "vscode";
import { ext } from "./extensionVariables";
import { nonNullValue } from "./utils/nonNull";
import { randomUtils } from "./utils/randomUtils";

let contentProvider: ReadOnlyContentProvider | undefined;
const scheme: string = 'azureextensionuiReadonly';

export async function openReadOnlyJson(node: { label: string, fullId: string }, data: {}): Promise<void> {
    let tab: string = '	';
    const config: WorkspaceConfiguration = workspace.getConfiguration('editor');
    const insertSpaces: boolean = !!config.get<boolean>('insertSpaces');
    if (insertSpaces) {
        let tabSize: number | undefined = config.get<number>('tabSize');
        if (!isNumber(tabSize) || tabSize < 0) {
            tabSize = 4;
        }

        tab = ' '.repeat(tabSize);
    }

    const content: string = JSON.stringify(data, undefined, tab);
    await openReadOnlyContent(node, content, '.json');
}

export async function openReadOnlyContent(node: { label: string, fullId: string }, content: string, fileExtension: string, options?: TextDocumentShowOptions): Promise<ReadOnlyContent> {
    if (!contentProvider) {
        contentProvider = new ReadOnlyContentProvider();
        ext.context.subscriptions.push(workspace.registerTextDocumentContentProvider(scheme, contentProvider));
    }

    return await contentProvider.openReadOnlyContent(node, content, fileExtension, options);
}

export class ReadOnlyContent {
    private _uri: Uri;
    private _emitter: EventEmitter<Uri>;
    private _content: string;

    constructor(uri: Uri, emitter: EventEmitter<Uri>, content: string) {
        this._uri = uri;
        this._emitter = emitter;
        this._content = content;
    }

    public get content(): string {
        return this._content;
    }

    public async append(content: string): Promise<void> {
        this._content += content;
        this._emitter.fire(this._uri);
    }

    public clear(): void {
        this._content = '';
        this._emitter.fire(this._uri);
    }

    public async isVisible(): Promise<boolean> {
        const visibleDocuments: TextDocument[] = window.visibleTextEditors.map(editor => editor.document);
        return visibleDocuments.includes(await workspace.openTextDocument(this._uri));
    }

    public async show(options?: TextDocumentShowOptions): Promise<void> {
        await window.showTextDocument(this._uri, options);
    }
}

class ReadOnlyContentProvider implements TextDocumentContentProvider {
    private _onDidChangeEmitter: EventEmitter<Uri> = new EventEmitter<Uri>();
    private _contentMap: Map<string, ReadOnlyContent> = new Map<string, ReadOnlyContent>();

    public get onDidChange(): Event<Uri> {
        return this._onDidChangeEmitter.event;
    }

    public async openReadOnlyContent(node: { label: string, fullId: string }, content: string, fileExtension: string, options?: TextDocumentShowOptions): Promise<ReadOnlyContent> {
        const idHash: string = randomUtils.getPseudononymousStringHash(node.fullId, 'hex');
        // in a URI, # means fragment and ? means query and is parsed in that way, so they should be removed to not break the path
        const uri: Uri = Uri.parse(`${scheme}:///${idHash}/${node.label.replace(/\#|\?/g, '_')}${fileExtension}`);
        const readOnlyContent: ReadOnlyContent = new ReadOnlyContent(uri, this._onDidChangeEmitter, content);
        this._contentMap.set(uri.toString(), readOnlyContent);
        await window.showTextDocument(uri, options);
        this._onDidChangeEmitter.fire(uri);
        return readOnlyContent;
    }

    public async provideTextDocumentContent(uri: Uri, _token: CancellationToken): Promise<string> {
        const readOnlyContent: ReadOnlyContent = nonNullValue(this._contentMap.get(uri.toString()), 'ReadOnlyContentProvider._contentMap.get');
        return readOnlyContent.content;
    }
}
