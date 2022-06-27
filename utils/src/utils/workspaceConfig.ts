import { workspace, WorkspaceConfiguration } from "vscode";

const settings: WorkspaceConfiguration = workspace.getConfiguration();

export function getWorkspaceSetting(field: string): number | string | null | undefined {
    return settings.get(field);
}