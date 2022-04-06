/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import { TreeItemCollapsibleState } from "vscode";
import * as types from '../../../index';
import { AzExtParentTreeItem } from "../../tree/AzExtParentTreeItem";
import { GenericTreeItem } from "../../tree/GenericTreeItem";

import { ActivityBase, ActivityTask, ActivityTreeItemOptions } from "../Activity";

interface ExecuteActivityData<C extends types.IActionContext> {
    title: string;
    context: C;
}

export class ExecuteActivity<C extends types.IActionContext> extends ActivityBase {

    public constructor(private readonly data: ExecuteActivityData<C>, task: ActivityTask) {
        super(task);
    }

    public inital(): ActivityTreeItemOptions {
        return {
            label: this.data.title,
            collapsibleState: this.progress.length ? TreeItemCollapsibleState.Expanded : TreeItemCollapsibleState.None,
            children: (parent: AzExtParentTreeItem) => {
                return this.progress.map((step) => {
                    const ti = new GenericTreeItem(parent, {
                        contextValue: 'executeStep',
                        label: step.message ?? ''
                    });
                    return ti;
                });
            }
        }
    }

    public onSuccess(): ActivityTreeItemOptions {
        return {
            label: this.labelOnDone,
            collapsibleState: this.progress.length ? TreeItemCollapsibleState.Expanded : TreeItemCollapsibleState.None,
            children: (parent: AzExtParentTreeItem) => {
                return this.progress.map((step) => {
                    const ti = new GenericTreeItem(parent, {
                        contextValue: 'executeStep',
                        label: step.message ?? ''
                    });
                    return ti;
                });
            }
        }
    }

    public onError(error: types.IParsedError): ActivityTreeItemOptions {
        return {
            label: this.labelOnDone,
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
