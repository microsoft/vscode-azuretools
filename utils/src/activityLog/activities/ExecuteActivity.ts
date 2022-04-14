/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import { TreeItemCollapsibleState } from "vscode";
import * as types from '../../../index';
import { AppResource } from "../../../unified";
import { localize } from "../../localize";
import { AzExtParentTreeItem } from "../../tree/AzExtParentTreeItem";
import { GenericTreeItem } from "../../tree/GenericTreeItem";
import { nonNullProp } from "../../utils/nonNull";
import { ActivityBase } from "../Activity";

interface ExecuteActivityData<C extends types.ExecuteActivityContext> {
    context: C;
}

export class ExecuteActivity<C extends types.ExecuteActivityContext> extends ActivityBase<void> {

    public constructor(private readonly data: ExecuteActivityData<C>, task: types.ActivityTask<void>) {
        super(task);
    }

    public initialState(): types.ActivityTreeItemOptions {
        return {
            label: this.label,
            collapsibleState: TreeItemCollapsibleState.None,
        }
    }

    public successState(): types.ActivityTreeItemOptions {
        const activityResult = this.data.context.activityResult;
        return {
            label: this.label,
            collapsibleState: activityResult ? TreeItemCollapsibleState.Expanded : TreeItemCollapsibleState.None,
            getChildren: activityResult ? ((parent: AzExtParentTreeItem) => {
                const appResource: AppResource = {
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

    public errorState(error: types.IParsedError): types.ActivityTreeItemOptions {
        return {
            label: this.label,
            collapsibleState: TreeItemCollapsibleState.Expanded,
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
