/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import { OutputChannel } from "vscode";

export class AzureOutputChannel implements OutputChannel {
	public readonly name: string;
	public outputChannel: OutputChannel;
	constructor(name: string, outputChannel: OutputChannel) {
		this.name = name;
		this.outputChannel = outputChannel;
	}

	public append(value: string): void {
		this.outputChannel.append(value);
	}

	public appendLine(value: string): void {
		this.outputChannel.appendLine(`${new Date().toLocaleTimeString()}: ${value}`);
	}

	public clear(): void {
		this.outputChannel.clear();
	}

	public show(): void {
		this.outputChannel.show();
	}

	public hide(): void {
		this.outputChannel.hide();
	}

	public dispose(): void {
		this.outputChannel.dispose();
		this.dispose();
	}

}
