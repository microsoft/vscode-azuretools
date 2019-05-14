/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as types from '../../index';
import { openInPortal } from '../openInPortal';
import { nonNullProp } from '../utils/nonNull';
import { AzExtTreeItem } from './AzExtTreeItem';
import { IAzExtParentTreeItemInternal } from './InternalInterfaces';

export abstract class AzureTreeItem<TRoot extends types.ISubscriptionRoot = types.ISubscriptionRoot> extends AzExtTreeItem implements types.AzureTreeItem<TRoot> {
    public readonly parent: types.AzureParentTreeItem<TRoot> & IAzExtParentTreeItemInternal | undefined;

    public get root(): TRoot {
        return nonNullProp(this, 'parent').root;
    }

    public async openInPortal(options?: types.OpenInPortalOptions): Promise<void> {
        await openInPortal(this.root, this.fullId, options);
    }
}
