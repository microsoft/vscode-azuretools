/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { parse as parseQuery, ParsedUrlQuery, stringify as stringifyQuery } from "querystring";
import { Disposable, Event, EventEmitter, FileChangeEvent, FileStat, FileSystemError, FileSystemProvider, FileType, TextDocumentShowOptions, Uri, window } from "vscode";
import * as types from '../index';
import { callWithTelemetryAndErrorHandling } from "./callWithTelemetryAndErrorHandling";
import { localize } from "./localize";
import { AzExtTreeDataProvider } from "./treeDataProvider/AzExtTreeDataProvider";
import { AzExtTreeItem } from "./treeDataProvider/AzExtTreeItem";
import { nonNullProp } from "./utils/nonNull";

const unsupportedError: Error = new Error(localize('notSupported', 'This operation is not supported.'));

export abstract class AzExtTreeFileSystem<TItem extends AzExtTreeItem> implements FileSystemProvider {
    public abstract scheme: string;

    private readonly _emitter: EventEmitter<FileChangeEvent[]> = new EventEmitter<FileChangeEvent[]>();
    private readonly _bufferedEvents: FileChangeEvent[] = [];
    private _fireSoonHandle?: NodeJS.Timer;

    private _tree: AzExtTreeDataProvider;

    public constructor(tree: AzExtTreeDataProvider) {
        this._tree = tree;
    }

    public get onDidChangeFile(): Event<FileChangeEvent[]> {
        return this._emitter.event;
    }

    public abstract statImpl(context: types.IActionContext, item: TItem, originalUri: Uri): Promise<FileStat>;
    public abstract readFileImpl(context: types.IActionContext, item: TItem, originalUri: Uri): Promise<Uint8Array>;
    public abstract writeFileImpl(context: types.IActionContext, item: TItem, content: Uint8Array, originalUri: Uri): Promise<void>;
    public abstract getFilePath(item: TItem): string;

    public async showTextDocument(item: TItem, options?: TextDocumentShowOptions): Promise<void> {
        await window.showTextDocument(this.getUriFromItem(item), options);
    }

    public watch(): Disposable {
        return new Disposable((): void => {
            // Since we're not actually watching "in Azure" (i.e. polling for changes), there's no need to selectively watch based on the Uri passed in here. Thus there's nothing to dispose
        });
    }

    public async stat(uri: Uri): Promise<FileStat> {
        return await callWithTelemetryAndErrorHandling('stat', async (context) => {
            context.telemetry.suppressIfSuccessful = true;

            const item: TItem = await this.lookup(context, uri);
            return await this.statImpl(context, item, uri);
            // tslint:disable-next-line: strict-boolean-expressions
        }) || { type: FileType.Unknown, ctime: 0, mtime: 0, size: 0 };
    }

    public async readFile(uri: Uri): Promise<Uint8Array> {
        return await callWithTelemetryAndErrorHandling('readFile', async (context) => {
            context.errorHandling.rethrow = true;
            context.errorHandling.suppressDisplay = true;

            const item: TItem = await this.lookup(context, uri);
            return await this.readFileImpl(context, item, uri);
            // tslint:disable-next-line: strict-boolean-expressions
        }) || Buffer.from('');
    }

    public async writeFile(uri: Uri, content: Uint8Array): Promise<void> {
        await callWithTelemetryAndErrorHandling('writeFile', async (context) => {
            const item: TItem = await this.lookup(context, uri);
            await this.writeFileImpl(context, item, content, uri);
            await item.refresh();
        });
    }

    public async readDirectory(_uri: Uri): Promise<[string, FileType][]> {
        throw unsupportedError;
    }

    public async createDirectory(_uri: Uri): Promise<void> {
        throw unsupportedError;
    }

    // tslint:disable-next-line: no-reserved-keywords
    public async delete(_uri: Uri): Promise<void> {
        throw unsupportedError;
    }

    public async rename(_uri: Uri): Promise<void> {
        throw unsupportedError;
    }

    /**
     * Uses a simple buffer to group events that occur within a few milliseconds of each other
     * Adapted from https://github.com/microsoft/vscode-extension-samples/blob/master/fsprovider-sample/src/fileSystemProvider.ts
     */
    // tslint:disable-next-line: no-reserved-keywords
    public fireSoon(...events: types.AzExtItemChangeEvent<TItem>[]): void {
        this._bufferedEvents.push(...events.map(e => {
            return {
                type: e.type,
                uri: this.getUriFromItem(e.item)
            };
        }));

        if (this._fireSoonHandle) {
            clearTimeout(this._fireSoonHandle);
        }

        this._fireSoonHandle = setTimeout(
            () => {
                this._emitter.fire(this._bufferedEvents);
                this._bufferedEvents.length = 0; // clear buffer
            },
            5
        );
    }

    protected getUriParts(item: TItem): types.AzExtItemUriParts {
        return {
            filePath: this.getFilePath(item),
            query: {
                id: item.fullId
            }
        };
    }

    protected async findItem(context: types.IActionContext, query: types.AzExtItemQuery): Promise<TItem | undefined> {
        return await this._tree.findTreeItem(query.id, context);
    }

    private getUriFromItem(item: TItem): Uri {
        const data: types.AzExtItemUriParts = this.getUriParts(item);
        const query: string = stringifyQuery(data.query);
        return Uri.parse(`${this.scheme}:///${data.filePath}?${query}`);
    }

    private async lookup(context: types.IActionContext, uri: Uri): Promise<TItem> {
        const item: TItem | undefined = await this.findItem(context, this.getQueryFromUri(uri));
        if (!item) {
            context.telemetry.suppressAll = true;
            context.errorHandling.rethrow = true;
            context.errorHandling.suppressDisplay = true;
            throw FileSystemError.FileNotFound(uri);
        } else {
            return item;
        }
    }

    private getQueryFromUri(uri: Uri): types.AzExtItemQuery {
        const query: ParsedUrlQuery = parseQuery(uri.query);
        const id: string | string[] = nonNullProp(query, 'id');
        if (typeof id === 'string') {
            return Object.assign(query, { id }); // Not technically necessary to use `Object.assign`, but it's better than casting which would lose type validation
        } else {
            throw new Error('Internal Error: Expected "id" to be type string.');
        }
    }
}
