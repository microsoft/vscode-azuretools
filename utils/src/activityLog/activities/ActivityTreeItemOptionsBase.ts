/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import * as types from '../../../index';
import * as hTypes from '../../../hostapi';
import { localize } from "../../localize";
import { AzExtParentTreeItem } from "../../tree/AzExtParentTreeItem";
import { GenericTreeItem } from "../../tree/GenericTreeItem";
import { nonNullProp } from "../../utils/nonNull";
import { ActivityBase } from "../Activity";

export class ActivityTreeItemOptionsBase<C extends types.ActivityContext> implements types.ActivityTreeItemOptionsFactory {

    constructor(protected readonly context: C) { }

    public getOptions(activity: ActivityBase<unknown>): hTypes.ActivityTreeItemOptions {
        switch (activity.status) {
            case types.ActivityStatus.Failed:
                return this.errorState(nonNullProp(activity, 'error'));
            case types.ActivityStatus.Succeeded:
                return this.successState();
            default:
                return this.initialState();
        }
    }

    protected initialState(): hTypes.ActivityTreeItemOptions {
        return {
            label: this.label,
        }
    }

    protected successState(): hTypes.ActivityTreeItemOptions {
        return {
            label: this.label,
        }
    }

    protected errorState(error: types.IParsedError): hTypes.ActivityTreeItemOptions {
        return {
            label: this.label,
            getChildren: (parent: AzExtParentTreeItem) => {
                return [
                    new GenericTreeItem(parent, {
                        contextValue: 'activityError',
                        label: error.message
                    })
                ];
            }
        }
    }

    protected get label(): string {
        return this.context.activityTitle ?? localize('azureActivity', "Azure Activity");
    }
}
