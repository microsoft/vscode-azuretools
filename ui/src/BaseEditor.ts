/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as fse from 'fs-extra';
import * as path from 'path';
import * as vscode from 'vscode';
import { UserCancelledError } from './errors';
import { localize } from "./localize";
import { TemporaryFile } from './utils/TemporaryFile';

// tslint:disable-next-line:typedef
const dialogResponses = {
    OK: localize('OK', "OK"),
    DontShowAgain: localize('dontShow', "Don't Show Again")
};

// tslint:disable-next-line:no-unsafe-any
export abstract class BaseEditor<ContextT> implements vscode.Disposable {
    private fileMap: { [key: string]: [vscode.TextDocument, ContextT] } = {};
    private ignoreSave: boolean = false;

    constructor(readonly showSavePromptKey: string, readonly outputChanel?: vscode.OutputChannel) {
    }

    public abstract getData(context: ContextT): Promise<string>;
    public abstract updateData(context: ContextT, data: string): Promise<string>;
    public abstract getFilename(context: ContextT): Promise<string>;
    public abstract getSize(context: ContextT): Promise<number>;
    public abstract getSaveConfirmationText(context: ContextT): Promise<string>;

    public async showEditor(context: ContextT): Promise<void> {
        const size: number = await this.getSize(context);
        const fileName: string = await this.getFilename(context);
        const splitFileName: string[] = fileName.split('.');
        const extension: string = splitFileName[splitFileName.length - 1];

        this.appendToOutput(localize('opening', 'Opening "{0}" ...', fileName));
        if (size > 50 /*Megabytes*/) {
            const message: string = localize('tooLargeError', '"{0}" is too large to download.', fileName);

            await vscode.window.showWarningMessage(message, dialogResponses.OK);
            this.appendLineToOutput(localize('failed', "Failed."));
            this.appendLineToOutput(localize('errorDetails', 'Error Details: {0}', message));
        } else if (extension === 'exe' || extension === 'img' || extension === 'zip') {
            const message: string = localize('unsupportedError', '"{0}" has an unsupported file extension.', fileName);

            await vscode.window.showWarningMessage(message, dialogResponses.OK);
            this.appendLineToOutput(localize('failed', " Failed."));
            this.appendLineToOutput(localize('errorDetails', 'Error Details: {0}', message));
        } else {
            try {
                // tslint:disable-next-line:no-unsafe-any
                const localFilePath: string = await TemporaryFile.create(fileName);
                const document: vscode.TextDocument = await vscode.workspace.openTextDocument(localFilePath);
                this.fileMap[localFilePath] = [document, context];
                const data: string = await this.getData(context);
                const textEditor: vscode.TextEditor = await vscode.window.showTextDocument(document);
                await this.updateEditor(data, textEditor);
                this.appendLineToOutput(' Done.');
            } catch (error) {
                let details: string;

                // tslint:disable-next-line:no-unsafe-any
                if (!!error.message) {
                    // tslint:disable-next-line:no-unsafe-any
                    details = error.message;
                } else {
                    details = JSON.stringify(error);
                }

                this.appendLineToOutput(localize('failed', " Failed."));
                this.appendLineToOutput(localize('errorDetails', 'Error Details: {0}', details));

                await vscode.window.showWarningMessage(localize('downloadError', 'Unable to download "{0}". Please check Output for more information.', fileName), dialogResponses.OK);
            }

        }
    }

    public async updateMatchingcontext(doc: vscode.Uri): Promise<void> {
        const filePath: string | undefined = Object.keys(this.fileMap).find((fsPath: string) => path.relative(doc.fsPath, fsPath) === '');
        if (filePath) {
            const [textDocument, context]: [vscode.TextDocument, ContextT] = this.fileMap[filePath];
            await this.updateRemote(context, textDocument);
        }
    }

    public async dispose(): Promise<void> {
        // tslint:disable-next-line:no-unsafe-any
        Object.keys(this.fileMap).forEach(async (key: string) => await fse.remove(path.dirname(key)));
    }

    public async onDidSaveTextDocument(globalState: vscode.Memento, doc: vscode.TextDocument): Promise<void> {
        const filePath: string | undefined = Object.keys(this.fileMap).find((fsPath: string) => path.relative(doc.uri.fsPath, fsPath) === '');
        if (!this.ignoreSave && filePath) {
            const context: ContextT = this.fileMap[filePath][1];
            const showSaveWarning: boolean | undefined = vscode.workspace.getConfiguration().get(this.showSavePromptKey);
            if (showSaveWarning) {

                const message: string = await this.getSaveConfirmationText(context);
                const result: string | undefined = await vscode.window.showWarningMessage(message, dialogResponses.OK, dialogResponses.DontShowAgain);

                if (!result) {
                    throw new UserCancelledError();
                } else if (result === dialogResponses.DontShowAgain) {
                    await vscode.workspace.getConfiguration().update(this.showSavePromptKey, false, vscode.ConfigurationTarget.Global);
                    await globalState.update(this.showSavePromptKey, true);
                }
            }

            await this.updateRemote(context, doc);
        }
    }

    protected appendToOutput(value: string): void {
        if (!!this.outputChanel) {
            this.outputChanel.append(value);
            this.outputChanel.show(true);
        }
    }

    protected appendLineToOutput(value: string): void {
        if (!!this.outputChanel) {
            this.outputChanel.appendLine(value);
            this.outputChanel.show(true);
        }
    }

    private async updateRemote(context: ContextT, doc: vscode.TextDocument): Promise<void> {
        const filename: string = await this.getFilename(context);
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
