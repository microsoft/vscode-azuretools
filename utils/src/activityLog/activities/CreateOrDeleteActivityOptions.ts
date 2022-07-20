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
import { ActivityOptionsFactoryBase } from './ActivityOptionsFactoryBase';

// This class takes the place of the old ExecuteActivity
export class CreateOrDeleteActivityOptions extends ActivityOptionsFactoryBase<types.ExecuteActivityContext> {

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

    protected override successState(): hTypes.ActivityTreeItemOptions {
        const activityResult = this.context.activityResult;
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

    protected override errorState(error: types.IParsedError): hTypes.ActivityTreeItemOptions {
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
}
