/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Uri, workspace, WorkspaceConfiguration } from "vscode";
import { azToolsPrefix } from "../constants";

export namespace settingUtils {
    export function getWorkspaceSetting<T>(key: string, fsPath?: string, prefix: string = azToolsPrefix): T | undefined {
        const projectConfiguration: WorkspaceConfiguration = workspace.getConfiguration(prefix, fsPath ? Uri.file(fsPath) : undefined);
        return projectConfiguration.get<T>(key);
    }
}
