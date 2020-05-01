# VSCode Azure SDK for Node.js - UI Tools (Preview)

[![Build Status](https://dev.azure.com/ms-azuretools/AzCode/_apis/build/status/vscode-azuretools)](https://dev.azure.com/ms-azuretools/AzCode/_build/latest?definitionId=17)

This package provides common Azure UI elements for VS Code extensions:

- [Telemetry and Error Handling](#telemetry-and-error-handling): Displays error messages and adds telemetry to commands/events.
- [AzureTreeDataProvider](#azure-tree-data-provider): Displays an Azure Explorer with Azure Subscriptions and child nodes of your implementation.
- [AzureBaseEditor](#azure-base-editor): Displays a text editor with upload support to Azure.

> NOTE: This package throws a `UserCancelledError` if the user cancels an operation. If you do not use `registerCommand`, you must handle this exception in your extension.

## Telemetry and Error Handling

Use `registerCommand`, `registerEvent`, or `callWithTelemetryAndErrorHandling` to consistently display error messages and track commands with telemetry. You must call `registerUIExtensionVariables` first in your extension's `activate()` method. The first parameter of the function passed in will always be an `IActionContext`, which allows you to specify custom telemetry and describes the behavior of this command. The simplest example is to register a command (in this case, refreshing a node):

```typescript
registerUIExtensionVariables(...);
registerCommand('yourExtension.Refresh', (context: IActionContext, node: AzExtTreeItem) => {
    context.telemetry.properties.customProp = "example prop";
    context.telemetry.measurements.customMeas = 49;
    node.refresh();
});
```

Here are a few of the benefits this provides:

- Parses Azure errors of the form `{ "Code": "Conflict", "Message": "This is the actual message" }` and only displays the 'Message' property
- Displays single line errors normally and multi-line errors in the output window
- Tracks multiple properties in addition to the [common extension properties](https://github.com/Microsoft/vscode-extension-telemetry#common-properties):
  - result (Succeeded, Failed, or Canceled)
  - duration
  - error

You can also register events. By default, every event is tracked in telemetry. It is _highly recommended_ to leverage the IActionContext.telemetry.suppressIfSuccessful parameter to filter only the events that apply to your extension. For example, if your extension only handles `json` files in the `onDidSaveTextDocument`, it might look like this:

```typescript
registerEvent(
  "yourExtension.onDidSaveTextDocument",
  vscode.workspace.onDidSaveTextDocument,
  async (context: IActionContext, doc: vscode.TextDocument) => {
    context.telemetry.suppressIfSuccessful = true;
    if (doc.fileExtension === "json") {
      context.telemetry.suppressIfSuccessful = false;
      // custom logic here
    }
  }
);
```

## Azure Extension Tree Data Provider

![ExampleTree](resources/ExampleTree.png)

### Display Azure Resources

Follow these steps to create your basic Azure Tree:

1. Create an `AzureTreeItem` (or `AzureParentTreeItem`) describing the items to be displayed under your subscription:

   ```typescript
   export class WebAppTreeItem extends AzureTreeItem {
     public static contextValue: string = "azureWebApp";
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

1. Create a `SubscriptionTreeItemBase` that provides the tree items you just implemented. It must implement at least `hasMoreChildrenImpl` and `loadMoreChildrenImpl`:

   > NOTE: Methods suffixed with `Impl` should not be called directly - just implemented.

   ```typescript
   export class SubscriptionTreeItem extends SubscriptionTreeItemBase {
       private _nextLink: string | undefined;

       public hasMoreChildrenImpl(): boolean {
           return this._nextLink !== undefined;
       }

       public async loadMoreChildrenImpl(clearCache: boolean, _context: IActionContext): Promise<WebAppTreeItem[]> {
           if (clearCache) {
               this._nextLink = undefined;
           }

           const client: WebSiteManagementClient = createAzureClient(this.root, WebSiteManagementClient);
           const webAppCollection: WebAppCollection = this._nextLink === undefined ?
               await client.webApps.list() :
               await client.webApps.listNext(this._nextLink);
           this._nextLink = webAppCollection.nextLink;
           return webAppCollection.map((site: Site) => new WebAppTreeItem(this, site)));
       }
   }
   ```

1. Create an `AzureAccountTreeItemBase` that provides the subscriptions you just implemented. It must implement at least `createSubscriptionTreeItem`:
   ```typescript
   export class AzureAccountTreeItem extends AzureAccountTreeItemBase {
     public createSubscriptionTreeItem(root: ISubscriptionRoot): SubscriptionTreeItemBase {
       return new SubscriptionTreeItem(this, root);
     }
   }
   ```
1. Finally, set up the tree in your extension's `activate()` method. Instantiate an `AzureAccountTreeItem` and add it to `context.subscriptions` since it's a disposable. Then instantiate an `AzExtTreeDataProvider`, passing in your root tree item and the `loadMoreCommandId` (which maps the 'Load More...' node to the command registered by your extension).
   ```typescript
   const azureAccountTreeItem = new AzureAccountTreeItem();
   context.subscriptions.push(azureAccountTreeItem);
   const treeDataProvider = new AzExtTreeDataProvider(azureAccountTreeItem, "appService.loadMore");
   context.subscriptions.push(vscode.window.createTreeView("azureAppService", { treeDataProvider }));
   ```

### Advanced Scenarios

#### Non-Azure resources

If your tree displays non-Azure resources you can either provide a different root tree item in the constructor of `AzExtTreeDataProvider`, or override `loadMoreChildrenImpl` in `AzureAccountTreeItemBase` to add items at the same level as subscriptions. The non-Azure tree items can extend `AzExtTreeItem` and `AzExtParentTreeItem` (a tree item for an **Az**ure **Ext**ension) which are more generic than `AzureTreeItem` and `AzureParentTreeItem`.

#### Tree Item Picker

The above steps will display your Azure Resources, but that's just the beginning. Let's say you implemented a `browse` function on your `WebAppTreeItem` that opened the Web App in the browser. In order to make that command work from the VS Code command palette, use the `showTreeItemPicker` method:

```typescript
registerCommand('appService.Browse', async (context: IActionContext, treeItem?: WebAppTreeItem) => {
    if (!treeItem) {
        treeItem = await treeDataProvider.showTreeItemPicker(WebAppTreeItem.contextValue, context);
    }

    treeItem.browse();
}));
```

#### Create Child Item

For a more advanced scenario, you can also implement the `createChildImpl` method on your `AzExtParentTreeItem`. This will ensure the 'Create' option is displayed in the node picker and will automatically display a 'Creating...' item in the tree:

![CreateNodePicker](resources/CreateNodePicker.png) ![CreatingNode](resources/CreatingNode.png)

```typescript
export class WebAppProvider extends SubscriptionTreeItem {
  public async createChildImpl(context: ICreateChildImplContext): Promise<WebAppTreeItem> {
    const webAppName = await vscode.window.showInputBox({ prompt: "Enter the name of your new Web App" });
    context.showCreatingTreeItem(webAppName);
    const newSite: Site | undefined = await createWebApp(webAppName, this.root);
    return new WebAppTreeItem(newSite);
  }
}
```

### Debug telemetry

If the environment variable `DEBUGTELEMETRY` is set to a non-empty, non-zero value, then the telemetry reporter used internally by this package will not attempt to send any data.  If the value is 'verbose' or 'v', the telemetry will not be sent but will be displayed on the console window.

## Azure Base Editor

### Display file from Base editor

Follow these steps to implement VSCode's editor functionality.

1. First extend the BaseEditor and implement the BaseEditor Methods.
   The BaseEditor class will accept any type, for the sake of this example,
   we'll use an AzureTreeItem

```typescript
// In your ExampleEditor.ts file
export class ExampleEditor extends BaseEditor<AzureTreeItem> {
  constructor() {
    super("commandname.showSavePrompt");
  }

  public getSaveConfirmationText(context: AzureTreeItem) {
    return "Whatever text you want the user to see on confirming a save";
  }

  public getData(context: AzureTreeItem): Promise<string> {
    //   hypothetical request that returns a JSON
    const file = createAzureClient(context.root, this.client);
    //   The two will add an indentation of 2 for whitespace, used for formatting the stringified JSON
    const fileData = JSON.stringify(file, null, 2);

    return fileData;
  }

  public updateData(context: AzureTreeItem, data: string): Promise<string> {
    return this.getData(context);
  }

  public getFileName(context: AzureTreeItem): Promise<string> {
    const extension = "json";
    return `${context.root.subscriptionDisplayName}.${extension}`;
  }
}
```

2. Register 'commandName.showSavePrompt' from constructor in the package.json
   under configuration.

```json
{
  "contributes": {
    "configuration": {
      "commandName.showSavePrompt": {
        "type": "boolean",
        "default": true,
        "description": "Description for the command"
      }
    }
  }
}
```

3. Create a command in a separate file for extension.ts to register later on.

```typescript
export async function selectCommand(node: {}, editor: ExampleEditor) {
  await azureEditor.showEditor(node);
}
```

4. Register a command in your extension.ts under the activate function file and instantiate the ExampleEditor class.

```typescript
export function activate(context: vscode.ExtensionContext) {
  const exampleEditor = new ExampleEditor();
  context.subscriptions.push(exampleEditor);

  vscode.commands.registerCommand("commandName.selectFile", (node: AzureTreeItem) =>
    selectCommand(node, exampleEditor)
  );
}
```

5. For 'commandName.selectFile' to trigger, have a class that extends an AzureTreeItem and set a property for commandId and set it to 'commandName.selectFile'. Pulling from the DisplayAzureResources example, we have this class.
```typescript
export class WebAppTreeItem extends AzureTreeItem {
  public static contextValue: string = "azureWebApp";
  public readonly contextValue: string = WebAppTreeItem.contextValue;
  public readonly commandId: string = 'commandName.selectFile';
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

## License

[MIT](LICENSE.md)
