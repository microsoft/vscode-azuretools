import { ServiceClientCredentials } from 'ms-rest';
import { AzureEnvironment } from 'ms-rest-azure';
import { ThemeIcon, Uri } from 'vscode';
import {
    AzExtParentTreeItem, AzExtTreeDataProvider, AzExtTreeItem, AzureParentTreeItem, IActionContext, ILoadingTreeContext, ISubscriptionContext, OpenInPortalOptions
} from 'vscode-azureextensionui';

export class AttachedAccountRoot implements AzureParentTreeItem<ISubscriptionContext> {

    public get credentials(): ServiceClientCredentials {
        throw this._error;
    }

    public get subscriptionDisplayName(): string {
        throw this._error;
    }

    public get subscriptionId(): string {
        throw this._error;
    }

    public get subscriptionPath(): string {
        throw this._error;
    }

    public get tenantId(): string {
        throw this._error;
    }

    public get userId(): string {
        throw this._error;
    }

    public get environment(): AzureEnvironment {
        throw this._error;
    }
    public root: ISubscriptionContext;
    public childTypeLabel?: string | undefined;
    public autoSelectInTreeItemPicker?: boolean | undefined;
    public supportsAdvancedCreation?: boolean | undefined;
    public createNewLabel?: string | undefined;
    public id?: string | undefined;
    public label: string;
    public description?: string | undefined;
    public iconPath?: string | Uri | { light: string | Uri; dark: string | Uri; } | ThemeIcon | undefined;
    public commandId?: string | undefined;
    public commandArgs?: unknown[] | undefined;
    public contextValue: string;
    public fullId: string;
    public parent?: AzExtParentTreeItem | undefined;
    public treeDataProvider: AzExtTreeDataProvider;
    private _error: Error = new Error('Cannot retrieve Azure subscription information for an attached account.');
    public async openInPortal(_options?: OpenInPortalOptions | undefined): Promise<void> {
        throw new Error('Method not implemented.');
    }
    public async loadMoreChildrenImpl(_clearCache: boolean, _context: IActionContext): Promise<AzExtTreeItem[]> {
        throw new Error('Method not implemented.');
    }
    public hasMoreChildrenImpl(): boolean {
        throw new Error('Method not implemented.');
    }
    public compareChildrenImpl(_item1: AzExtTreeItem, _item2: AzExtTreeItem): number {
        throw new Error('Method not implemented.');
    }
    public async createTreeItemsWithErrorHandling<TSource>(_sourceArray: TSource[] | null | undefined, _invalidContextValue: string, _createTreeItem: (source: TSource) => AzExtTreeItem | Promise<AzExtTreeItem | undefined> | undefined, _getLabelOnError: (source: TSource) => string | Promise<string | undefined> | undefined): Promise<AzExtTreeItem[]> {
        throw new Error('Method not implemented.');
    }
    public async createChild<T extends AzExtTreeItem>(_context: IActionContext): Promise<T> {
        throw new Error('Method not implemented.');
    }
    public async getCachedChildren(_context: IActionContext): Promise<AzExtTreeItem[]> {
        throw new Error('Method not implemented.');
    }
    public async loadAllChildren(_context: ILoadingTreeContext): Promise<AzExtTreeItem[]> {
        throw new Error('Method not implemented.');
    }
    public async refresh(): Promise<void> {
        throw new Error('Method not implemented.');
    }
    public async deleteTreeItem(_context: IActionContext): Promise<void> {
        throw new Error('Method not implemented.');
    }
    public async runWithTemporaryDescription(_description: string, _callback: () => Promise<void>): Promise<void> {
        throw new Error('Method not implemented.');
    }
}
