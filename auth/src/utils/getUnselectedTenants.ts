import * as vscode from 'vscode';

export function getUnselectedTenants(): string[] {
    const value = vscode.workspace.getConfiguration('azureResourceGroups')
        .get<string[]>('unselectedTenants', []);

    if (!value || !Array.isArray(value)) {
        return [];
    }

    // remove any duplicates
    return Array.from(new Set(value));
}
