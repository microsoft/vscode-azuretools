/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ThemeIcon } from 'vscode';
import { AzExtParentTreeItem, AzExtTreeItem, GenericTreeItem, IActionContext, parseError } from 'vscode-azureextensionui';
import { ext } from '../extensionVariables';
import { localize } from '../localize';
import { ParsedSite } from '../SiteClient';
import { FolderTreeItem } from './FolderTreeItem';

/**
 * NOTE: This leverages a command with id `ext.prefix + '.startStreamingLogs'` that should be registered by each extension
 */
export class LogFilesTreeItem extends FolderTreeItem {
    public static contextValue: string = 'logFiles';
    public readonly contextValue: string = LogFilesTreeItem.contextValue;
    public suppressMaskLabel: boolean = true;

    protected readonly _isRoot: boolean = true;

    constructor(parent: AzExtParentTreeItem, site: ParsedSite) {
        super(parent, site, localize('logFiles', 'Logs'), '/LogFiles', true);
    }

    public async loadMoreChildrenImpl(clearCache: boolean, context: IActionContext): Promise<AzExtTreeItem[]> {
        let children: AzExtTreeItem[];
        try {
            children = await super.loadMoreChildrenImpl(clearCache, context);
        } catch (error) {
            // We want to show the log stream tree item in all cases, so handle errors here
            const message: string = parseError(error).message;
            context.telemetry.properties.logFilesError = message;
            children = [new GenericTreeItem(this, {
                label: localize('errorTreeItem', 'Error: {0}', message),
                contextValue: 'logFilesError'
            })];
        }

        if (clearCache) {
            const ti: AzExtTreeItem = new GenericTreeItem(this, {
                contextValue: 'logStream',
                commandId: ext.prefix + '.startStreamingLogs',
                iconPath: new ThemeIcon('play'),
                label: localize('connectLogStream', 'Connect to Log Stream...')
            });
            ti.commandArgs = [this.parent]; // should be the slot tree item
            children.push(ti);
        }
        return children;
    }
}
