# VSCode Azure SDK for Node.js - UI Tools (Preview)

[![Build Status](https://dev.azure.com/ms-azuretools/AzCode/_apis/build/status/vscode-azuretools)](https://dev.azure.com/ms-azuretools/AzCode/_build/latest?definitionId=17)

This package provides common Azure UI elements for VS Code extensions:
* [Telemetry and Error Handling](#telemetry-and-error-handling): Displays error messages and adds telemetry to commands/events.
* [AzureTreeDataProvider](#azure-tree-data-provider): Displays an Azure Explorer with Azure Subscriptions and child nodes of your implementation.
* [AzureBaseEditor](#azure-base-editor): Displays a text editor with upload support to Azure.

> NOTE: This package throws a `UserCancelledError` if the user cancels an operation. If you do not use `registerCommand`, you must handle this exception in your extension.

## Telemetry and Error Handling

Use `registerCommand`, `registerEvent`, or ` callWithTelemetryAndErrorHandling` to consistently display error messages and track commands with telemetry. You must call `registerUIExtensionVariables` first in your extension's `activate()` method. The simplest example is to register a command (in this case, refreshing a node):
```typescript
registerUIExtensionVariables(...);
registerCommand('yourExtension.Refresh', (node: AzureTreeItem) => { node.refresh(); });
```
Here are a few of the benefits this provides:
* Parses Azure errors of the form `{ "Code": "Conflict", "Message": "This is the actual message" }` and only displays the 'Message' property
* Displays single line errors normally and multi-line errors in the output window
* Tracks multiple properties in addition to the [common extension properties](https://github.com/Microsoft/vscode-extension-telemetry#common-properties):
  * result (Succeeded, Failed, or Canceled)
  * duration
  * error

If you want to add custom telemetry proprties, use the action's context and add your own properties or measurements:
```typescript
registerCommand('yourExtension.Refresh', function (this: IActionContext): void {
    this.properties.customProp = "example prop";
    this.measurements.customMeas = 49;
});
```

Finally, you can also register events. By default, every event is tracked in telemetry. It is *highly recommended* to leverage the IActionContext.suppressTelemetry parameter to filter only the events that apply to your extension. For example, if your extension only handles `json` files in the `onDidSaveTextDocument`, it might look like this:
```typescript
registerEvent('yourExtension.onDidSaveTextDocument', vscode.workspace.onDidSaveTextDocument, async function (this: IActionContext, doc: vscode.TextDocument): Promise<void> {
    this.suppressTelemetry = true;
    if (doc.fileExtension === 'json') {
        this.suppressTelemetry = false;
        // custom logic here
    }
});
```

## Azure Tree Data Provider
![ExampleTree](resources/ExampleTree.png)

### Display Azure Resources
Follow these steps to create your basic Azure Tree:
1. Implement an `AzureTreeItem` (or `AzureParentTreeItem`) describing the items to be displayed under your subscription:
    ```typescript
    export class WebAppTreeItem extends AzureTreeItem {
        public static contextValue: string = 'azureWebApp';
        public readonly contextValue: string = WebAppTreeItem.contextValue;
        private readonly _site: Site;
        constructor(parent: AzureParentTreeItem, site: Site) {
            super(parent);
            this._site = site;
        }

        public get id(): string {
            return this._site.id;
        }

        public get label(): string {
            return this._site.name;
        }
    }
    ```
1. Create a `SubscriptionTreeItem` that provides the tree items you just implemented. It must implement at least `hasMoreChildrenImpl` and `loadMoreChildrenImpl`:
    > NOTE: Methods suffixed with `Impl` should not be called directly - just implemented.
    ```typescript
    export class WebAppProvider extends SubscriptionTreeItem {
        private _nextLink: string | undefined;

        public hasMoreChildrenImpl(): boolean {
            return this._nextLink !== undefined;
        }

        public async loadMoreChildrenImpl(): Promise<WebAppTreeItem[]> {
            const client: WebSiteManagementClient = createAzureClient(this.root, WebSiteManagementClient);
            const webAppCollection: WebAppCollection = this._nextLink === undefined ?
                await client.webApps.list() :
                await client.webApps.listNext(this._nextLink);
            this._nextLink = webAppCollection.nextLink;
            return webAppCollection.map((site: Site) => new WebAppTreeItem(this, site)));
        }
    }
    ```
1. Instantiate a new instance of `AzureTreeDataProvider` in your extension's `activate()` method, passing the `SubscriptionTreeItem` type and `loadMoreCommandId`. The `loadMoreCommandId` maps the 'Load More...' node to the command registered by your extension.
    ```typescript
    const treeDataProvider = new AzureTreeDataProvider(WebAppProvider, 'appService.LoadMore');
    context.subscriptions.push(treeDataProvider);
    context.subscriptions.push(vscode.window.registerTreeDataProvider('azureAppService', treeDataProvider));
    ```

### Advanced Scenarios
The above steps will display your Azure Resources, but that's just the beginning. Let's say you implemented a `browse` function on your `WebAppTreeItem` that opened the Web App in the browser. In order to make that command work from the VS Code command palette, use the `showTreeItemPicker` method:
```typescript
registerCommand('appService.Browse', async (treeItem?: WebAppTreeItem) => {
    if (!treeItem) {
        treeItem = <WebAppTreeItem>await treeDataProvider.showTreeItemPicker(WebAppTreeItem.contextValue);
    }

    treeItem.browse();
}));
```

For a more advanced scenario, you can also implement the `createChildImpl` method on your `AzureParentTreeItem`. This will ensure the 'Create' option is displayed in the node picker and will automatically display a 'Creating...' item in the tree:

![CreateNodePicker](resources/CreateNodePicker.png) ![CreatingNode](resources/CreatingNode.png)
```typescript
export class WebAppProvider extends SubscriptionTreeItem {
    public async createChildImpl(showCreatingTreeItem: (label: string) => void, _userOptions?: any): Promise<WebAppTreeItem> {
        const webAppName = await vscode.window.showInputBox({ prompt: 'Enter the name of your new Web App' });
        showCreatingTreeItem(webAppName);
        const newSite: Site | undefined = await createWebApp(webAppName, this.root);
        return new WebAppTreeItem(newSite);
    }
}
```

## Telemetry

To create a telemetry reporter for your extension's use, use the following code:

```typescript
import { createTelemetryReporter } from 'vscode-azureextensionui';

export async function activate(ctx: vscode.ExtensionContext): Promise<void> {
    let reporter = createTelemetryReporter(ctx);
    reporter.sendTelemetryEvent(<args>);
}
```

### Debug telemetry

If the environment variable `DEBUGTELEMETRY` is set to a non-empty, non-zero value, then the telemetry reporter created by `createTelemetryReporter()` will display to the console window only, and will not attempt to send any data.

## Azure Base Editor

Documentation coming soon...

## License
[MIT](LICENSE.md)
