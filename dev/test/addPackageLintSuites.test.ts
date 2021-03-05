/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { addPackageLintSuites } from '../src';

const packageJson: {} = {
	"name": "vscode-azurestorage",
	"displayName": "Azure Storage",
	"description": "Manage your Azure Storage accounts including Blob Containers, File Shares, Tables and Queues",
	"version": "0.4.2",
	"publisher": "ms-azuretools",
	"aiKey": "AIF-d9b70cd4-b9f9-4d70-929b-a071c400b217",
	"engines": {
		"vscode": "^1.23.0"
	},
	"repository": {
		"type": "git",
		"url": "https://github.com/Microsoft/vscode-azurestorage"
	},
	"galleryBanner": {
		"color": "#0072c6",
		"theme": "dark"
	},
	"homepage": "https://github.com/Microsoft/vscode-azurestorage/blob/main/README.md",
	"license": "SEE LICENSE IN LICENSE.md",
	"categories": [
		"Azure"
	],
	"keywords": [
		"Azure",
		"Blob Containers",
		"File Share",
		"Storage Account"
	],
	"preview": true,
	"activationEvents": [
		"onView:azureStorage",
		"onCommand:azureStorage.refresh"

	],
	"main": "./out/src/extension",
	"icon": "media/azureStorageIcon.png",
	"contributes": {
		"viewsContainers": {
			"activitybar": [
				{
					"id": "azure",
					"title": "Azure",
					"icon": "resources/azure.svg"
				}
			]
		},
		"views": {
			"azure": [
				{
					"id": "azureStorage",
					"name": "Storage",
					"when": "config.azureStorage.showExplorer == true"
				}
			]
		},
		"commands": [
			{
				"command": "azureStorage.refresh",
				"title": "Refresh",
				"icon": {
					"light": "resources/light/refresh.svg",
					"dark": "resources/dark/refresh.svg"
				}
			}
		],
		"menus": {
			"view/title": [
				{
					"command": "azureStorage.refresh",
					"when": "view == azureStorage",
					"group": "navigation@99"
				}
			],
			"explorer/context": [
				{
					"command": "azureStorage.azureStorage.refresh",
					"when": "explorerResourceIsFolder == true",
					"group": "zzz_staticwebsites"
				}
			],
			"view/item/context": [
				{
					"command": "azureStorage.refresh",
					"when": "view == azureStorage && viewItem == azureextensionui.azureSubscription",
					"group": "9_refresh"
				}
			],
			"commandPalette": [
				{
					"command": "azureStorage.refresh",
					"when": "never"
				}
			]
		},
		"configuration": {
			"title": "Azure Storage Accounts",
			"properties": {
				"azureStorage.showExplorer": {
					"type": "boolean",
					"default": true,
					"description": "Show or hide the Azure Storage Explorer"
				}
			}
		}
	},
	"scripts": {
		"vscode:prepublish": "npm run build"
	},
	"devDependencies": {
		"@types/copy-paste": "^1.1.30"
	},
	"extensionDependencies": [
		"ms-vscode.azure-account"
	],
	"dependencies": {
		"azure-arm-resource": "^3.1.1-preview"
	}
}
	;

async function fakeGetCommands(): Promise<string[]> {
	return [
		'azureStorage.refresh'
	];
}

suite('addPackageLintSuites', () => {
	suite('Simple passing', () => {
		addPackageLintSuites(() => new Object(), fakeGetCommands, packageJson, {});
	});
});
