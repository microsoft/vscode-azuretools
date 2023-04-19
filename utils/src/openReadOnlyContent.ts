/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { isNumber } from "util";
import { CancellationToken, Event, EventEmitter, TextDocumentContentProvider, TextDocumentShowOptions, Uri, window, workspace, WorkspaceConfiguration } from "vscode";
import { ext } from "./extensionVariables";
import { nonNullValue } from "./utils/nonNull";
import { randomUtils } from "./utils/randomUtils";


let _cachedScheme: string | undefined;
function getScheme(): string {
    if (!_cachedScheme) {
        // Generate a unique scheme so that multiple extensions using this same code don't conflict with each other
        _cachedScheme = `azuretools${randomUtils.getRandomHexString(6)}`;
    }
    return _cachedScheme;
}

let _cachedContentProvider: ReadOnlyContentProvider | undefined;
function getContentProvider(): ReadOnlyContentProvider {
    if (!_cachedContentProvider) {
        _cachedContentProvider = new ReadOnlyContentProvider();
        ext.context.subscriptions.push(workspace.registerTextDocumentContentProvider(getScheme(), _cachedContentProvider));
    }
    return _cachedContentProvider;
}

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
    const contentProvider = getContentProvider();
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
}

class ReadOnlyContentProvider implements TextDocumentContentProvider {
    private _onDidChangeEmitter: EventEmitter<Uri> = new EventEmitter<Uri>();
    private _contentMap: Map<string, ReadOnlyContent> = new Map<string, ReadOnlyContent>();

    public get onDidChange(): Event<Uri> {
        return this._onDidChangeEmitter.event;
    }

    public async openReadOnlyContent(node: { label: string, fullId: string }, content: string, fileExtension: string, options?: TextDocumentShowOptions): Promise<ReadOnlyContent> {
        const scheme = getScheme();
        const idHash: string = await randomUtils.getPseudononymousStringHash(node.fullId);
        // Remove special characters which may prove troublesome when parsing the uri. We'll allow the same set as `encodeUriComponent`
        const fileName = node.label.replace(/[^a-z0-9\-\_\.\!\~\*\'\(\)]/gi, '_');
        const uri: Uri = Uri.parse(`${scheme}:///${idHash}/${fileName}${fileExtension}`);
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
