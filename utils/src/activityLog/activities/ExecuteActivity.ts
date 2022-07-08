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
import { ActivityOptionsFactory } from "../Activity";

export class ExecuteActivityOptions<C extends types.ExecuteActivityContext> implements ActivityOptionsFactory {

    constructor(private readonly data: ExecuteActivityData<C>) { }

    public getOptions(activity: hTypes.Activity): hTypes.ActivityTreeItemOptions {
        switch (activity.status) {
            case types.ActivityStatus.Failed:
                return this.errorState(nonNullProp(activity, 'error'));
            case types.ActivityStatus.Succeeded:
                return this.successState();
            default:
                return this.initialState();
        }
    }

    private initialState(): hTypes.ActivityTreeItemOptions {
        return {
            label: this.label,
        }
    }

    private successState(): hTypes.ActivityTreeItemOptions {
        const activityResult = this.data.context.activityResult;
        return {
            label: this.label,
            getChildren: activityResult ? ((parent: AzExtParentTreeItem) => {
                const appResource: hTypes.AppResource = {
                    id: nonNullProp(activityResult, 'id'),
                    name: nonNullProp(activityResult, 'name'),
                    type: nonNullProp(activityResult, 'type'),
                }

                const ti = new GenericTreeItem(parent, {
                    contextValue: 'executeResult',
                    label: localize("clickToView", "Click to view resource"),
                    commandId: 'azureResourceGroups.revealResource',
                });

                ti.commandArgs = [appResource];

                return [ti];

            }) : undefined
        }
    }

    private errorState(error: types.IParsedError): hTypes.ActivityTreeItemOptions {
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

interface ExecuteActivityData<C extends types.ExecuteActivityContext> {
    context: C;
}
