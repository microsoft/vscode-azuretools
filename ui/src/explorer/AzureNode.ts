/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Subscription } from 'azure-arm-resource/lib/subscription/models';
import { ServiceClientCredentials } from 'ms-rest';
import { AzureEnvironment } from 'ms-rest-azure';
import * as opn from 'opn';
import { AzureExplorer, IAzureNode, IAzureParentNode, IAzureTreeItem } from '../../index';
import { ArgumentError, NotImplementedError } from '../errors';

export class AzureNode<T extends IAzureTreeItem = IAzureTreeItem> implements IAzureNode<T> {
    public readonly treeItem: T;
    public readonly parent: IAzureParentNodeInternal | undefined;
    public constructor(parent: IAzureParentNodeInternal | undefined, treeItem: T) {
        this.parent = parent;
        this.treeItem = treeItem;
    }

    public get tenantId(): string {
        if (this.parent) {
            return this.parent.tenantId;
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

    public get explorer(): AzureExplorer {
        if (this.parent) {
            return this.parent.explorer;
        } else {
            throw new ArgumentError(this);
        }
    }

    public refresh(): void {
        this.explorer.refresh(this.parent, false);
    }

    public openInPortal(): void {
        (<(s: string) => void>opn)(`${this.environment.portalUrl}/${this.tenantId}/#resource${this.treeItem.id}`);
    }

    public async deleteNode(): Promise<AzureNode> {
        if (this.treeItem.deleteTreeItem) {
            await this.treeItem.deleteTreeItem(this);
            if (this.parent) {
                this.parent.removeNodeFromCache(this);
            }

            return this;
        } else {
            throw new NotImplementedError('deleteTreeItem', this.treeItem);
        }
    }
}

export interface IAzureParentNodeInternal extends IAzureParentNode {
    removeNodeFromCache(node: AzureNode): void;
}
