/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import { TreeItemCollapsibleState } from "vscode";
import * as types from '../../../index';
import { AppResource } from "../../../unified";
import { AzExtParentTreeItem } from "../../tree/AzExtParentTreeItem";
import { GenericTreeItem } from "../../tree/GenericTreeItem";
import { nonNullProp } from "../../utils/nonNull";

import { ActivityBase, ActivityTask, ActivityTreeItemOptions } from "../Activity";

interface ExecuteActivityData<C extends types.IActionContext> {
    title: string;
    context: C;
}

export class ExecuteActivity<C extends types.IActionContext> extends ActivityBase {

    public constructor(private readonly data: ExecuteActivityData<C>, task: ActivityTask) {
        super(task);
    }

    public initialState(): ActivityTreeItemOptions {
        return {
            label: this.data.title,
            collapsibleState: TreeItemCollapsibleState.None,
        }
    }

    public successState(): ActivityTreeItemOptions {
        return {
            label: this.labelOnDone,
            collapsibleState: this.data.context['activityResult'] ? TreeItemCollapsibleState.Expanded : TreeItemCollapsibleState.None,
            children: (parent: AzExtParentTreeItem) => {
                if (this.data.context['activityResult']) {
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                    const result = this.data.context['activityResult'];
                    const appResource: AppResource = {
                        id: nonNullProp(result, 'id') as string,
                        name: nonNullProp(result, 'name') as string,
                        type: nonNullProp(result, 'type') as string,
                    }

                    const ti = new GenericTreeItem(parent, {
                        contextValue: 'executeResult',
                        label: "Click to view resource",
                        commandId: 'azureResourceGroups.revealResource',
                    });

                    ti.commandArgs = [appResource];

                    return [ti];
                }
                return [];
            }
        }
    }

    public errorState(error: types.IParsedError): ActivityTreeItemOptions {
        return {
            label: this.labelOnDone,
            collapsibleState: TreeItemCollapsibleState.Expanded,
            children: (parent: AzExtParentTreeItem) => {
                return [
                    new GenericTreeItem(parent, {
                        contextValue: 'executeError',
                        label: error.message
                    })
                ];
            }
        }
    }

    private get labelOnDone(): string {
        return this.data.title;
    }
}
