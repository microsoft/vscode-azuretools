/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Subscription } from 'azure-arm-resource/lib/subscription/models';
import { ServiceClientCredentials } from 'ms-rest';
import { AzureEnvironment } from 'ms-rest-azure';
import * as opn from 'opn';
import { AzureTreeDataProvider, IAzureNode, IAzureParentNode, IAzureTreeItem } from '../../index';
import { ArgumentError, NotImplementedError } from '../errors';

export class AzureNode<T extends IAzureTreeItem = IAzureTreeItem> implements IAzureNode<T> {
    public readonly treeItem: T;
    public readonly parent: IAzureParentNodeInternal | undefined;
    public constructor(parent: IAzureParentNodeInternal | undefined, treeItem: T) {
        this.parent = parent;
        this.treeItem = treeItem;
    }

    public get id(): string {
        let id: string = this.treeItem.id || this.treeItem.label;
        if (!id.startsWith('/')) {
            id = `/${id}`;
        }

        // For the sake of backwards compat, only add the parent's id if it's not already there
        if (this.parent && !id.startsWith(this.parent.id) && !this.parent.id.includes('deploymentSlots')) {
            // portal changed the path for individual slots to have the 'slots' path, but all when viewing all slots, it is 'deploymentSlots'
            id = `${this.parent.id}${id}`;
            }

        console.log(id);
        return id;
    }

    public get tenantId(): string {
        if (this.parent) {
            return this.parent.tenantId;
        } else {
            throw new ArgumentError(this);
        }
    }

    public get userId(): string {
        if (this.parent) {
            return this.parent.userId;
        } else {
            throw new ArgumentError(this);
        }
    }

    public get subscription(): Subscription {
        if (this.parent) {
            return this.parent.subscription;
        } else {
            throw new ArgumentError(this);
        }
    }

    public get credentials(): ServiceClientCredentials {
        if (this.parent) {
            return this.parent.credentials;
        } else {
            throw new ArgumentError(this);
        }
    }

    public get environment(): AzureEnvironment {
        if (this.parent) {
            return this.parent.environment;
        } else {
            throw new ArgumentError(this);
        }
    }

    public get treeDataProvider(): AzureTreeDataProvider {
        if (this.parent) {
            return this.parent.treeDataProvider;
        } else {
            throw new ArgumentError(this);
        }
    }

    public async refresh(): Promise<void> {
        if (this.treeItem.refreshLabel) {
            await this.treeItem.refreshLabel(this);
        }

        await this.treeDataProvider.refresh(this);
    }

    public openInPortal(): void {
        (<(s: string) => void>opn)(`${this.environment.portalUrl}/${this.tenantId}/#resource${this.id}`);
    }

    public includeInNodePicker(expectedContextValues: string[]): boolean {
        return expectedContextValues.some((val: string) => {
            return this.treeItem.contextValue === val ||
                !this.treeItem.isAncestorOf ||
                this.treeItem.isAncestorOf(val);
        });
    }

    public async deleteNode(): Promise<void> {
        if (this.treeItem.deleteTreeItem) {
            await this.treeItem.deleteTreeItem(this);
            if (this.parent) {
                await this.parent.removeNodeFromCache(this);
            }
        } else {
            throw new NotImplementedError('deleteTreeItem', this.treeItem);
        }
    }
}

export interface IAzureParentNodeInternal extends IAzureParentNode {
    removeNodeFromCache(node: AzureNode): Promise<void>;
}
