/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AzExtParentTreeItem, AzExtTreeItem, createContextValue, GenericTreeItem, IActionContext, parseError } from '@microsoft/vscode-azext-utils';
import { l10n, ThemeIcon } from 'vscode';
import { ext } from '../extensionVariables';
import { ParsedSite } from '../SiteClient';
import { FolderTreeItem } from './FolderTreeItem';
import { createSiteFilesHref } from '../siteFiles';

interface LogFilesTreeItemOptions {
    site: ParsedSite;
    contextValuesToAdd?: string[];
}

/**
 * NOTE: This leverages a command with id `ext.prefix + '.startStreamingLogs'` that should be registered by each extension
 */
export class LogFilesTreeItem extends FolderTreeItem {
    public static contextValue: string = 'logFiles';
    public suppressMaskLabel: boolean = true;
    public readonly contextValuesToAdd: string[];

    protected readonly _isRoot: boolean = true;

    constructor(parent: AzExtParentTreeItem, options: LogFilesTreeItemOptions) {
        super(parent, {
            site: options.site,
            label: l10n.t('Logs'),
            href: createSiteFilesHref(options.site, 'LogFiles/'),
            isReadOnly: true,
            contextValuesToAdd: options.contextValuesToAdd || []
        });
    }

    public get contextValue(): string {
        return createContextValue([LogFilesTreeItem.contextValue, ...this.contextValuesToAdd]);
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
                label: l10n.t('Error: {0}', message),
                contextValue: 'logFilesError'
            })];
        }

        if (clearCache) {
            const ti: AzExtTreeItem = new GenericTreeItem(this, {
                contextValue: 'logStream',
                commandId: ext.prefix + '.startStreamingLogs',
                iconPath: new ThemeIcon('play'),
                label: l10n.t('Connect to Log Stream...')
            });
            ti.commandArgs = [this.parent]; // should be the slot tree item
            children.push(ti);
        }
        return children;
    }
}
