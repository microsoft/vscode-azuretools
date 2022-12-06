import * as vscode from 'vscode';
import type { Extension } from 'vscode';

export async function getExtensionExports<T>(extensionId: string): Promise<T | undefined> {
    const extension: Extension<T> | undefined = vscode.extensions.getExtension(extensionId);
    if (extension) {
        if (!extension.isActive) {
            await extension.activate();
        }

        return extension.exports;
    }

    return undefined;
}
