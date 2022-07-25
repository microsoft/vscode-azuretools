/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import * as types from '../../../index';
import * as hTypes from '../../../hostapi';
import { localize } from "../../localize";
import { AzExtParentTreeItem } from "../../tree/AzExtParentTreeItem";
import { GenericTreeItem } from "../../tree/GenericTreeItem";
import { ActivityBase } from "../Activity";
import { RevealResourceTreeItem } from './RevealResourceTreeItem';

interface ExecuteActivityData<C extends types.ExecuteActivityContext> {
    context: C;
}

export class ExecuteActivity<C extends types.ExecuteActivityContext> extends ActivityBase<void> {

    public constructor(private readonly data: ExecuteActivityData<C>, task: types.ActivityTask<void>) {
        super(task);
    }

    public initialState(): hTypes.ActivityTreeItemOptions {
        return {
            label: this.label,
        }
    }

    public successState(): hTypes.ActivityTreeItemOptions {
        const activityResult = this.data.context.activityResult;
        const resourceId: string | undefined = typeof activityResult === 'string' ? activityResult : activityResult?.id;
        return {
            label: this.label,
            getChildren: resourceId ? ((parent: AzExtParentTreeItem) => [new RevealResourceTreeItem(parent, resourceId)]) : undefined
        }
    }

    public errorState(error: types.IParsedError): hTypes.ActivityTreeItemOptions {
        return {
            label: this.label,
            getChildren: (parent: AzExtParentTreeItem) => {
                return [
                    new GenericTreeItem(parent, {
                        contextValue: 'executeError',
                        label: error.message
                    })
                ];
            }
        }
    }

    private get label(): string {
        return this.data.context.activityTitle ?? localize('azureActivity', "Azure Activity");
    }
}
