import * as vscode from 'vscode';
import * as types from './index';
import { AzExtTreeItem } from './src/tree/AzExtTreeItem';

interface TreeNodeConfiguration {
    readonly label: string;
    readonly description?: string;
    readonly icon?: vscode.ThemeIcon;
    readonly contextValue?: string;
}

interface ApplicationResource extends TreeNodeConfiguration {
    getChildren?(): vscode.ProviderResult<AzExtTreeItem[]>;
    resolve?(): Thenable<void>;

    resolveTooltip?(): Thenable<string | vscode.MarkdownString>;
}

export interface GroupableApplicationResource extends ApplicationResource {
    readonly rootGroupConfig: TreeNodeConfiguration;
    readonly subGroupConfig: {
        readonly resourceGroup: TreeNodeConfiguration;
        readonly resourceType: TreeNodeConfiguration;
        readonly [label: string]: TreeNodeConfiguration; // Don't need to support right off the bat but we can put it in the interface
    }
}

export type LocalResource = types.AzExtTreeItem;

export interface ApplicationResourceProvider {
    provideResources(): vscode.ProviderResult<GroupableApplicationResource[] | undefined>;
}

export interface LocalResourceProvider {
    provideResources(): vscode.ProviderResult<LocalResource[] | undefined>;
}

export declare function registerApplicationResourceProvider(
    resourceType: string,
    provider: ApplicationResourceProvider
): vscode.Disposable;

export declare function registerLocalResourceProvider(
    resourceType: string,
    provider: LocalResourceProvider
): vscode.Disposable;
