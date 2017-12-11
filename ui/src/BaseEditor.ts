/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as fse from 'fs-extra';
import * as path from 'path';
import * as vscode from 'vscode';
import { TemporaryFile } from './utils/temporaryFile';
import { UserCancelledError } from './errors';
import { localize } from "./localize";

class DialogResponses {
    static readonly OK: string = localize('OK', "OK");
    static readonly DontShowAgain: string = localize('dontShow', "Don't Show Again");
}

export abstract class BaseEditor<ContextT> implements vscode.Disposable {
    private fileMap: { [key: string]: [vscode.TextDocument, ContextT] } = {};
    private ignoreSave: boolean = false;

    abstract getData(context: ContextT): Promise<string>;
    abstract updateData(context: ContextT, data: string): Promise<string>;
    abstract getFilename(context: ContextT): Promise<string>;
    abstract getSize(context: ContextT): Promise<number>;
    abstract getSaveConfirmationText(context: ContextT): Promise<string>;

    constructor(readonly showSavePromptKey: string, readonly outputChanel?: vscode.OutputChannel) {
    }

    public async showEditor(context: ContextT): Promise<void> {
        var size = await this.getSize(context);
        var fileName = await this.getFilename(context);
        var splitFileName = fileName.split(".");
        var extension = splitFileName[splitFileName.length - 1];

        this.appendToOutput(localize('opening', 'Opening "{0}" ...', fileName));
        if (size > 50 /*Megabytes*/) {
            let message = localize('tooLargeError', '"{0}" is too large to download.', fileName);

            await vscode.window.showWarningMessage(message, DialogResponses.OK);
            this.appendLineToOutput(localize('failed', "Failed."));
            this.appendLineToOutput(localize('errorDetails', 'Error Details: {0}', message));
        } else if (extension === "exe" || extension === "img" || extension === "zip") {
            let message = localize('unsupportedError', '"{0}" has an unsupported file extension.', fileName);

            await vscode.window.showWarningMessage(message, DialogResponses.OK);
            this.appendLineToOutput(localize('failed', " Failed."));
            this.appendLineToOutput(localize('errorDetails', 'Error Details: {0}', message));
        } else {
            try {
                const localFilePath = await TemporaryFile.create(fileName)
                const document = await vscode.workspace.openTextDocument(localFilePath);
                this.fileMap[localFilePath] = [document, context];
                var data = await this.getData(context);
                const textEditor = await vscode.window.showTextDocument(document);
                await this.updateEditor(data, textEditor);
                this.appendLineToOutput(` Done.`);
            } catch (error) {
                var details: string;

                if (!!error.message) {
                    details = error.message;
                } else {
                    details = JSON.stringify(error);
                }

                this.appendLineToOutput(localize('failed', " Failed."));
                this.appendLineToOutput(localize('errorDetails', 'Error Details: {0}', details));

                await vscode.window.showWarningMessage(localize('downloadError', 'Unable to download "{0}". Please check Output for more information.', fileName), DialogResponses.OK);
            }

        }
    }

    public async updateMatchingcontext(doc): Promise<void> {
        const filePath = Object.keys(this.fileMap).find((filePath) => path.relative(doc.fsPath, filePath) === '');
        if (filePath) {
            var [textDocument, context] = this.fileMap[filePath];
            await this.updateRemote(context, textDocument);
        }
    }

    public async dispose(): Promise<void> {
        Object.keys(this.fileMap).forEach(async (key) => await fse.remove(path.dirname(key)));
    }

    private async updateRemote(context: ContextT, doc: vscode.TextDocument): Promise<void> {
        var filename = await this.getFilename(context);
        this.appendToOutput(localize('updating', 'Updating "{0}" ...', filename));
        try {
            const updatedData: string = await this.updateData(context, doc.getText());
            this.appendLineToOutput(localize('done', ' Done.'));
            await this.updateEditor(updatedData, vscode.window.activeTextEditor);
        } catch (error) {
            this.appendLineToOutput(localize('failed', " Failed."));
            this.appendLineToOutput(localize('errorDetails', 'Error Details: {0}', error));
        }
    }

    protected appendToOutput(value: string) {
        if (!!this.outputChanel) {
            this.outputChanel.append(value);
            this.outputChanel.show(true);
        }
    }

    protected appendLineToOutput(value: string) {
        if (!!this.outputChanel) {
            this.outputChanel.appendLine(value);
            this.outputChanel.show(true);
        }
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

    public async onDidSaveTextDocument(globalState: vscode.Memento, doc: vscode.TextDocument): Promise<void> {
        const filePath = Object.keys(this.fileMap).find((filePath) => path.relative(doc.uri.fsPath, filePath) === '');
        if (!this.ignoreSave && filePath) {
            const context: ContextT = this.fileMap[filePath][1];
            const showSaveWarning: boolean | undefined = vscode.workspace.getConfiguration().get(this.showSavePromptKey);
            if (showSaveWarning) {

                const message: string = await this.getSaveConfirmationText(context);
                const result: string | undefined = await vscode.window.showWarningMessage(message, DialogResponses.OK, DialogResponses.DontShowAgain);

                if (!result) {
                    throw new UserCancelledError();
                } else if (result === DialogResponses.DontShowAgain) {
                    await vscode.workspace.getConfiguration().update(this.showSavePromptKey, false, vscode.ConfigurationTarget.Global);
                    await globalState.update(this.showSavePromptKey, true);
                }
            }

            await this.updateRemote(context, doc);
        }
    }

    private static async writeToEditor(editor: vscode.TextEditor, data: string): Promise<void> {
        await editor.edit((editBuilder: vscode.TextEditorEdit) => {
            if (editor.document.lineCount > 0) {
                const lastLine = editor.document.lineAt(editor.document.lineCount - 1);
                editBuilder.delete(new vscode.Range(new vscode.Position(0, 0), new vscode.Position(lastLine.range.start.line, lastLine.range.end.character)));
            }

            editBuilder.insert(new vscode.Position(0, 0), data);
        });
    }
}
