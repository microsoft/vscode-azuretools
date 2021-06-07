/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'path';
import * as vscode from 'vscode';
import { IActionContext } from '..';
import { DialogResponses } from './DialogResponses';
import { UserCancelledError } from './errors';
import { ext } from './extensionVariables';
import { localize } from "./localize";
import { createTemporaryFile } from './utils/createTemporaryFile';

export abstract class BaseEditor<ContextT> implements vscode.Disposable {
    private fileMap: { [key: string]: [vscode.TextDocument, ContextT] } = {};
    private ignoreSave: boolean = false;

    constructor(private readonly showSavePromptKey: string) {
    }

    public abstract getData(context: ContextT): Promise<string>;
    public abstract updateData(context: ContextT, data: string): Promise<string>;
    public abstract getFilename(context: ContextT): Promise<string>;
    public abstract getResourceName(context: ContextT): Promise<string>;
    public abstract getSaveConfirmationText(context: ContextT): Promise<string>;
    public abstract getSize(context: ContextT): Promise<number>;

    public async showEditor(context: ContextT, sizeLimit?: number /* in Megabytes */): Promise<void> {
        const fileName: string = await this.getFilename(context);
        const resourceName: string = await this.getResourceName(context);
        this.appendLineToOutput(localize('opening', 'Opening "{0}"...', fileName), { resourceName: resourceName });
        if (sizeLimit !== undefined) {
            const size: number = await this.getSize(context);
            if (size > sizeLimit) {
                const message: string = localize('tooLargeError', '"{0}" is too large to download.', fileName);
                throw new Error(message);
            }
        }

        const localFilePath: string = await createTemporaryFile(fileName);
        const document: vscode.TextDocument = await vscode.workspace.openTextDocument(localFilePath);
        this.fileMap[localFilePath] = [document, context];
        const data: string = await this.getData(context);
        const textEditor: vscode.TextEditor = await vscode.window.showTextDocument(document);
        await this.updateEditor(data, textEditor);
    }

    public async updateMatchingContext(doc: vscode.Uri): Promise<void> {
        const filePath: string | undefined = Object.keys(this.fileMap).find((fsPath: string) => path.relative(doc.fsPath, fsPath) === '');
        if (filePath) {
            const [textDocument, context]: [vscode.TextDocument, ContextT] = this.fileMap[filePath];
            await this.updateRemote(context, textDocument);
        }
    }

    public async dispose(): Promise<void> {
        // eslint-disable-next-line @typescript-eslint/no-misused-promises
        Object.keys(this.fileMap).forEach(async key => await vscode.workspace.fs.delete(this.fileMap[key][0].uri));
    }

    public async onDidSaveTextDocument(actionContext: IActionContext, globalState: vscode.Memento, doc: vscode.TextDocument): Promise<void> {
        actionContext.telemetry.suppressIfSuccessful = true;
        const filePath: string | undefined = Object.keys(this.fileMap).find((fsPath: string) => path.relative(doc.uri.fsPath, fsPath) === '');
        if (!this.ignoreSave && filePath) {
            actionContext.telemetry.suppressIfSuccessful = false;
            const context: ContextT = this.fileMap[filePath][1];
            const showSaveWarning: boolean | undefined = vscode.workspace.getConfiguration().get(this.showSavePromptKey);

            if (showSaveWarning) {
                const message: string = await this.getSaveConfirmationText(context);
                const result: vscode.MessageItem | undefined = await vscode.window.showWarningMessage(message, DialogResponses.upload, DialogResponses.alwaysUpload, DialogResponses.dontUpload);
                if (result === DialogResponses.alwaysUpload) {
                    await vscode.workspace.getConfiguration().update(this.showSavePromptKey, false, vscode.ConfigurationTarget.Global);
                    await globalState.update(this.showSavePromptKey, true);
                } else if (result === DialogResponses.dontUpload) {
                    throw new UserCancelledError();
                }
            }
            await this.updateRemote(context, doc);
        }
    }

    protected appendLineToOutput(value: string, options?: { resourceName?: string, date?: Date }): void {
        ext.outputChannel.appendLog(value, options);
        ext.outputChannel.show(true);
    }

    private async updateRemote(context: ContextT, doc: vscode.TextDocument): Promise<void> {
        const filename: string = await this.getFilename(context);
        const resourceName: string = await this.getResourceName(context);
        this.appendLineToOutput(localize('updating', 'Updating "{0}" ...', filename), { resourceName: resourceName });
        const updatedData: string = await this.updateData(context, doc.getText());
        this.appendLineToOutput(localize('done', 'Updated "{0}".', filename), { resourceName: resourceName });
        if (doc.isClosed !== true) {
            const visibleDocument: vscode.TextEditor | undefined = vscode.window.visibleTextEditors.find((ed) => ed.document === doc);
            if (visibleDocument) {
                await this.updateEditor(updatedData, visibleDocument);
            }
        }
    }

    private async updateEditor(data: string, textEditor?: vscode.TextEditor): Promise<void> {
        if (textEditor) {
            await BaseEditor.writeToEditor(textEditor, data);
            this.ignoreSave = true;
            try {
                await textEditor.document.save();
            } finally {
                this.ignoreSave = false;
            }
        }
    }

    private static async writeToEditor(editor: vscode.TextEditor, data: string): Promise<void> {
        await editor.edit((editBuilder: vscode.TextEditorEdit) => {
            if (editor.document.lineCount > 0) {
                const lastLine: vscode.TextLine = editor.document.lineAt(editor.document.lineCount - 1);
                editBuilder.delete(new vscode.Range(new vscode.Position(0, 0), new vscode.Position(lastLine.range.start.line, lastLine.range.end.character)));
            }
            editBuilder.insert(new vscode.Position(0, 0), data);
        });
    }
}
