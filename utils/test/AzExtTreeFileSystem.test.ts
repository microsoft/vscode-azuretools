/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { TestUserInput } from "@microsoft/vscode-azext-dev";
import * as vscode from 'vscode';
import { IActionContext } from "..";
import { AzExtTreeFileSystem } from "../src";
import assert = require("assert");

type MockItemType = { id: string };

const mockFilePath = "mock_file_path";

class MockAzExtTreeFileSystem extends AzExtTreeFileSystem<MockItemType> {
    public override scheme = "mockAzExtTreeFileSystem";

    public override async statImpl(_context: IActionContext, _item: MockItemType, _originalUri): Promise<vscode.FileStat> {
        throw Error("not implemented");
    }

    public override async readFileImpl(_context: IActionContext, _item: MockItemType, _originalUri): Promise<Uint8Array> {
        throw Error("not implemented");
    }

    public override async writeFileImpl(_context: IActionContext, _item: MockItemType) {
        return;
    }

    public override getFilePath(_item: MockItemType): string {
        return mockFilePath;
    }

    public async lookupPublic(context: IActionContext, uri: vscode.Uri) {
        return this.lookup(context, uri);
    }
}

suite("AzExtTreeFileSystem", function () {
    const mockContext: IActionContext = { errorHandling: { issueProperties: {} }, telemetry: { measurements: {}, properties: {} }, ui: new TestUserInput(vscode), valuesToMask: [] };
    test("lookup doesn't find item not shown", async function () {
        const mockAzExtTreeFileSystem = new MockAzExtTreeFileSystem();
        const id = "non_existent";
        const uri: vscode.Uri = vscode.Uri.parse(`${mockAzExtTreeFileSystem.scheme}://mock_file_path?id=${id}`);
        try {
            await mockAzExtTreeFileSystem.lookupPublic(mockContext, uri);
            assert(false, "should have thrown entry not found error");
        } catch (error) {
            assert.equal(error.name, "EntryNotFound (FileSystemError)");
        }
    });

    test("lookup finds shown item whose id is a valid query parameter", async function () {
        const mockAzExtTreeFileSystem = new MockAzExtTreeFileSystem();
        const id = "mock_id";
        try {
            await mockAzExtTreeFileSystem.showTextDocument({ id: id });
        } catch (error) {
            // Ignore error. Only used showTextDocument to add the document to itemsCache.
        }
        const uri: vscode.Uri = vscode.Uri.parse(`${mockAzExtTreeFileSystem.scheme}://mock_file_path?id=${id}`);
        const item = await mockAzExtTreeFileSystem.lookupPublic(mockContext, uri);
        assert.equal(item?.id, id);
    });

    test("lookup finds shown item whose id contains ?", async function () {
        const mockAzExtTreeFileSystem = new MockAzExtTreeFileSystem();
        const id = "ZTA?AMGB????oaUBAAAAAAAAAA???";
        try {
            await mockAzExtTreeFileSystem.showTextDocument({ id: id });
        } catch (error) {
            // Ignore error. Only used showTextDocument to add the document to itemsCache.
        }
        const uri: vscode.Uri = vscode.Uri.parse(`${mockAzExtTreeFileSystem.scheme}://mock_file_path?id=${id}`);
        const item = await mockAzExtTreeFileSystem.lookupPublic(mockContext, uri);
        assert.equal(item?.id, id);
    });

    test("lookup finds shown item whose id contains =", async function () {
        const mockAzExtTreeFileSystem = new MockAzExtTreeFileSystem();
        const id = "ZTA=AMGBoaUB===AAAAAAAAAA==";
        try {
            await mockAzExtTreeFileSystem.showTextDocument({ id: id });
        } catch (error) {
            // Ignore error. Only used showTextDocument to add the document to itemsCache.
        }
        const uri: vscode.Uri = vscode.Uri.parse(`${mockAzExtTreeFileSystem.scheme}://mock_file_path?id=${id}`);
        const item = await mockAzExtTreeFileSystem.lookupPublic(mockContext, uri);
        assert.equal(item?.id, id);
    });
});
