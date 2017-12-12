/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as fse from 'fs-extra';
import * as path from 'path';
import * as vscode from 'vscode';
import { DialogResponses } from './DialogResponses' ;
import { UserCancelledError } from './errors';
import { localize } from "./localize";
import { createTemporaryFile } from './utils/createTemporaryFile';

// tslint:disable-next-line:no-unsafe-any
export abstract class BaseEditor<ContextT> implements vscode.Disposable {
    private fileMap: { [key: string]: [vscode.TextDocument, ContextT] } = {};
    private ignoreSave: boolean = false;

    constructor(private readonly showSavePromptKey: string, private readonly outputChannel?: vscode.OutputChannel) {
    }

    public abstract getData(context: ContextT): Promise<string>;
    public abstract updateData(context: ContextT, data: string): Promise<string>;
    public abstract getFilename(context: ContextT): Promise<string>;
    public abstract getSize(context: ContextT): Promise<number>;
    public abstract getSaveConfirmationText(context: ContextT): Promise<string>;

    public async showEditor(context: ContextT, sizeLimit?: number /* in Megabytes */): Promise<void> {
        const fileName: string = await this.getFilename(context);

        this.appendLineToOutput(localize('opening', 'Opening "{0}"...', fileName));
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
        Object.keys(this.fileMap).forEach(async (key: string) => await fse.remove(path.dirname(key)));
    }

    public async onDidSaveTextDocument(globalState: vscode.Memento, doc: vscode.TextDocument): Promise<void> {
        const filePath: string | undefined = Object.keys(this.fileMap).find((fsPath: string) => path.relative(doc.uri.fsPath, fsPath) === '');
        if (!this.ignoreSave && filePath) {
            const context: ContextT = this.fileMap[filePath][1];
            const showSaveWarning: boolean | undefined = vscode.workspace.getConfiguration().get(this.showSavePromptKey);

            if (showSaveWarning) {
                const message: string = await this.getSaveConfirmationText(context);
                const result: vscode.MessageItem | undefined = await vscode.window.showWarningMessage(message, DialogResponses.upload, DialogResponses.dontWarn, DialogResponses.dontUpload);
                if (result === DialogResponses.dontWarn) {
                    await vscode.workspace.getConfiguration().update(this.showSavePromptKey, false, vscode.ConfigurationTarget.Global);
                    await globalState.update(this.showSavePromptKey, true);
                } else if (result === DialogResponses.dontUpload) {
                    throw new UserCancelledError();
                }
            }
            await this.updateRemote(context, doc);
        }
    }

    protected appendToOutput(value: string): void {
        if (!!this.outputChannel) {
            this.outputChannel.append(value);
            this.outputChannel.show(true);
        }
    }

    protected appendLineToOutput(value: string): void {
        if (!!this.outputChannel) {
            this.outputChannel.appendLine(value);
            this.outputChannel.show(true);
        }
    }

    private async updateRemote(context: ContextT, doc: vscode.TextDocument): Promise<void> {
        const filename: string = await this.getFilename(context);
        this.appendLineToOutput(localize('updating', 'Updating "{0}" ...', filename));
        const updatedData: string = await this.updateData(context, doc.getText());
        this.appendLineToOutput(localize('done', ' Updated "{0}"', filename));
        await this.updateEditor(updatedData, vscode.window.activeTextEditor);
    }

    private async updateEditor(data: string, textEditor?: vscode.TextEditor): Promise<void> {
        if (!!textEditor) {
            await BaseEditor.writeToEditor(textEditor, data);
            this.ignoreSave = true;
            try {
                await textEditor.document.save();
            } finally {
                this.ignoreSave = false;
            }
        }
    }
    // tslint:disable-next-line:member-ordering
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
