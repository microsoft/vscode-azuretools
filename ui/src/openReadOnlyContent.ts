/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { isNumber } from "util";
import { CancellationToken, Event, EventEmitter, TextDocumentContentProvider, TextDocumentShowOptions, Uri, window, workspace, WorkspaceConfiguration } from "vscode";
import { ext } from "./extensionVariables";
import { nonNullValue } from "./utils/nonNull";
import { randomUtils } from "./utils/randomUtils";

let contentProvider: ReadOnlyContentProvider | undefined;
const scheme: string = 'azureextensionuiReadonly';
interface INode {
    label: string;
    fullId: string;
}

export async function openReadOnlyJson(node: INode, data: {}): Promise<void> {
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

export async function openReadOnlyContent(node: INode, content: string, fileExtension: string, options?: TextDocumentShowOptions): Promise<ReadOnlyContent> {
    if (!contentProvider) {
        contentProvider = new ReadOnlyContentProvider();
        ext.context.subscriptions.push(workspace.registerTextDocumentContentProvider(scheme, contentProvider));
    }

    return await contentProvider.openReadOnlyContent(node, content, fileExtension, options);
}

export class ReadOnlyContent {
    private _contentProvider: ReadOnlyContentProvider;
    private _node: INode;
    private _fileExtension: string;

    constructor(_contentProvider: ReadOnlyContentProvider, node: INode, fileExtension: string) {
        this._contentProvider = _contentProvider;
        this._node = node;
        this._fileExtension = fileExtension;
    }

    public async append(content: string, options?: TextDocumentShowOptions): Promise<void> {
        await this._contentProvider.openReadOnlyContent(this._node, content, this._fileExtension, { append: true, ...options });
    }

    public clear(): void {
        this._contentProvider.clearContent(this._node, this._fileExtension);
    }
}

class ReadOnlyContentProvider implements TextDocumentContentProvider {
    private _onDidChangeEmitter: EventEmitter<Uri> = new EventEmitter<Uri>();
    private _contentMap: Map<string, string> = new Map<string, string>();

    public get onDidChange(): Event<Uri> {
        return this._onDidChangeEmitter.event;
    }

    public async openReadOnlyContent(node: INode, content: string, fileExtension: string, options?: { append?: boolean } & TextDocumentShowOptions): Promise<ReadOnlyContent> {
        const uri: Uri = this.getUri(node, fileExtension);

        if (options?.append) {
            const existingContent: string | undefined = this._contentMap.get(uri.toString());
            content = `${existingContent}${content}`;
        }

        this._contentMap.set(uri.toString(), content);
        await window.showTextDocument(uri, options);
        this._onDidChangeEmitter.fire(uri);
        return new ReadOnlyContent(this, node, fileExtension);
    }

    public async provideTextDocumentContent(uri: Uri, _token: CancellationToken): Promise<string> {
        return nonNullValue(this._contentMap.get(uri.toString()), 'ReadOnlyContentProvider._contentMap.get');
    }

    public clearContent(node: INode, fileExtension: string): void {
        const uri: Uri = this.getUri(node, fileExtension);
        this._contentMap.set(uri.toString(), '');
    }

    private getUri(node: INode, fileExtension: string): Uri {
        const idHash: string = randomUtils.getPseudononymousStringHash(node.fullId, 'hex');
        // in a URI, # means fragment and ? means query and is parsed in that way, so they should be removed to not break the path
        return Uri.parse(`${scheme}:///${idHash}/${node.label.replace(/\#|\?/g, '_')}${fileExtension}`);
    }
}
