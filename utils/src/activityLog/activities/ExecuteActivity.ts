/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import * as hTypes from '../../../hostapi';
import * as types from '../../../index';
import { localize } from "../../localize";
import { AzExtParentTreeItem } from "../../tree/AzExtParentTreeItem";
import { GenericTreeItem } from "../../tree/GenericTreeItem";
import { nonNullProp } from "../../utils/nonNull";
import { ActivityBase } from "../Activity";

export class ExecuteActivity<C extends types.ExecuteActivityContext = types.ExecuteActivityContext> extends ActivityBase<void> {

    public constructor(protected readonly context: C, task: types.ActivityTask<void>) {
        super(task);
    }

    public initialState(): hTypes.ActivityTreeItemOptions {
        return {
            label: this.label,
        }
    }

    public successState(): hTypes.ActivityTreeItemOptions {
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

    protected get label(): string {
        return this.context.activityTitle ?? localize('azureActivity', "Azure Activity");
    }
}
