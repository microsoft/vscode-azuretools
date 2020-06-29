/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { isNumber } from "util";
import { CancellationToken, Event, EventEmitter, TextDocument, TextDocumentContentProvider, TextDocumentShowOptions, Uri, ViewColumn, window, workspace, WorkspaceConfiguration } from "vscode";
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

export async function openReadOnlyContent(node: { label: string, fullId: string }, content: string, fileExtension: string, appendDelimiter?: string, openInNewViewColumn?: boolean): Promise<void> {
    if (!contentProvider) {
        contentProvider = new ReadOnlyContentProvider();
        ext.context.subscriptions.push(workspace.registerTextDocumentContentProvider(scheme, contentProvider));
    }

    await contentProvider.openReadOnlyContent(node, content, fileExtension, appendDelimiter, openInNewViewColumn);
}

class ReadOnlyContentProvider implements TextDocumentContentProvider {
    private _onDidChangeEmitter: EventEmitter<Uri> = new EventEmitter<Uri>();
    private _contentMap: Map<string, string> = new Map<string, string>();

    public get onDidChange(): Event<Uri> {
        return this._onDidChangeEmitter.event;
    }

    public async openReadOnlyContent(node: { label: string, fullId: string }, content: string, fileExtension: string, appendDelimiter?: string, openInNewViewColumn?: boolean): Promise<void> {
        const idHash: string = randomUtils.getPseudononymousStringHash(node.fullId, 'hex');
        // in a URI, # means fragment and ? means query and is parsed in that way, so they should be removed to not break the path
        const uri: Uri = Uri.parse(`${scheme}:///${idHash}/${node.label.replace(/\#|\?/g, '_')}${fileExtension}`);
        const showOptions: TextDocumentShowOptions = {};
        let shouldShowTextDocument: boolean = true;

        if (appendDelimiter) {
            const existingContent: string | undefined = this._contentMap.get(uri.toString());
            content = `${existingContent ? existingContent + appendDelimiter : ''}${content}`;
        }

        if (openInNewViewColumn) {
            const document: TextDocument | undefined = workspace.textDocuments.find(doc => { return doc.uri.fsPath === uri.fsPath; });
            if (!document) {
                const viewColumn: ViewColumn | undefined = window.activeTextEditor?.viewColumn;
                // tslint:disable-next-line: strict-boolean-expressions
                showOptions.viewColumn = viewColumn ? viewColumn + 1 : undefined;
            } else {
                // The document is already open
                shouldShowTextDocument = false;
            }
        }

        this._contentMap.set(uri.toString(), content);
        if (shouldShowTextDocument) {
            await window.showTextDocument(uri, showOptions);
        }
        this._onDidChangeEmitter.fire(uri);
    }

    public async provideTextDocumentContent(uri: Uri, _token: CancellationToken): Promise<string> {
        return nonNullValue(this._contentMap.get(uri.toString()), 'ReadOnlyContentProvider._contentMap.get');
    }
}
