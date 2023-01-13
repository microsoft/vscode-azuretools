# VS Code Azure Resources API

Born from a needed overhaul of the multi-Azure-extension user experience, this API allows any number of "client" extensions to contribute to and extend a set of unified resource views owned by a "host" extension.

## History

For \\\\Build 2022 we released our first version of what we call the App Centric or Unified redesign of the Azure extensions for VS Code. The redesign combines the Azure product views into a single view, called the Azure Resources view.

Below is a screenshot of the Azure panel before the redesign, with 5 product extensions installed. Each Azure product has its own view in the Azure panel, resulting in a congested and unproductive user experience. A primary goal of the redesign was to improve the user experience for users who use multiple Azure extensions simultaneously.

![Unifed view side-by-side comparison](media/unified-view-comparison.png)

> Left: Before the redesign. Right: After the redesign. Red highlights indicates where resources are now located in the unified Azure resources view.

## Overview

The Azure Resources extension for VS Code contributes the **Azure resources view** and the **Workspace resources view**. The Azure view lets users browse and work with supported resources in Azure. The Workspace resources view is home to development related resources like an emulated database, or a functions project detected in an open workspace folder.

In the past, each supported Azure resource had a dedicated view in the Azure view container. In the updated design, the Azure resources and Workspace resources views contain all resources.
To facilitate this design, each Azure **product extension** contributes to a single **host extension**.

The Azure Resources extension provides small generic features for all Azure resource types. Users can then install Azure product extensions to enable rich, product-specific features.

The Azure Resources extension exposes an API which enables any number of client extensions to contribute UI and functionality to the Azure and Workspace resources views.

## Capabilities

### Resource views

<!-- ![Resource views >](media/resource-views.png) -->
<img align="right" src="media/resource-views.png" width="50%" />


Allows multiple extensions to contribute rich features to unified resource tree views in the Azure view.

Consumers of the API can:

- Customize and extend the behavior of Azure resource tree items in the Azure resources tree view
- Contribute tree items to the Workspace resources tree view



- Getting your resources to show up in the Azure resources tree

  - Group display name
  - Adding an icon

- Contribution points
  - Azure and Workspace resources
  - Create Resource command
<br clear="right"/>

### Create Resource menu

<img align="right" src="media/create-resource.png" width="60%" />

<br/>
<br/>
Client extensions can add items to the Azure Resources "Create Resource..." command quick pick prompt.

<br clear="right"/>


## API Overview

### Branch data provider

The VS Code API provides a `TreeDataProvider` interface for controlling tree views. The host extension splits tree views into branches, where each branch is controlled by a branch data provider. Clients can register a `BranchDataProvider` which is then responsible for providing the tree items for a branch in the tree view. The `BranchDataProvider` interface is a small extension of VS Code's `TreeDataProvider`.

`BranchDataProvider` is an extension of [VS Code's `TreeDataProvider`](https://code.visualstudio.com/api/references/vscode-api#TreeDataProvider).

> Note: clients registering resource providers must declare that they do so in their extension manifest. See [Extension Manifest](#extension-manifest)

```ts
/**
 * The base interface for visualizers of Azure and workspace resources.
 */
export interface BranchDataProvider<TResource extends ResourceBase, TModel extends ResourceModelBase> extends vscode.TreeDataProvider<TModel> {
    /**
     * Get the children of `element`.
     *
     * @param element The element from which the provider gets children. Unlike a traditional tree data provider, this will never be `undefined`.
     *
     * @return Children of `element`.
     */
    getChildren(element: TModel): vscode.ProviderResult<TModel[]>;

    /**
     * Called to get the provider's model element for a specific resource.
     *
     * @remarks getChildren() assumes that the provider passes a known (TModel) model item, or undefined when getting the "root" children.
     *          However, branch data providers have no "root" so this function is called for each matching resource to obtain a starting branch item.
     *
     * @returns The provider's model element for `resource`.
     */
    getResourceItem(element: TResource): TModel | Thenable<TModel>;
}
```

Clients can register branch data providers for each resource view.

### Resource provider

Clients register resource providers to add resources to a view. Currently the API is limited to registering Workspace resource providers because a default Azure resource provider is built into the Azure Resources extension.

> Note: clients registering resource providers must declare that they do so in their extension manifest. See [Extension Manifest](#extension-manifest)

```ts
/**
 * The base interface for providers of Azure and workspace resources.
 */
export interface ResourceProvider<TResourceSource, TResource extends ResourceBase> {
    /**
     * Fired when the provider's resources have changed.
     */
    readonly onDidChangeResource?: vscode.Event<TResource | undefined>;

    /**
     * Called to supply the resources used as the basis for the resource views.
     *
     * @param source The source from which resources should be generated.
     *
     * @returns The resources to be displayed in the resource view.
     */
    getResources(source: TResourceSource): vscode.ProviderResult<TResource[]>;
}
```


## Extension manifest

Client extensions define an `x-azResources` object on inside of `contributes` in the extension manifest `package.json` file.

This object informs the host extension when to activate the client extension and what contributions the client extension makes to the shared views.

```ts
    azure?: {
        /**
         * List of Azure resource types this extension registers a BranchDataProvider for.
         */
        branches: {
            /**
             * The resource type the BranchDataProvider is registered for.
             */
            type: AzExtResourceType
        }[];
    };

    /**
     * List of Workspace resource types this extension registers a BranchDataProvider for.
     */
    workspace?: {
        branches: {
            /**
             * The resource type the BranchDataProvider is registered for.
             */
            type: string;
        }[];

        /**
         * Whether this extension registers a WorkspaceResourceProvider.
         */
        resources?: boolean;
    };

    /**
     * Commands to add to the "Create Resource..." quick pick prompt.
     */
    commands?: {
        command: string;
        title: string;
        detail: string;
    }[];
}
```

> [View defintion of `AzExtResourceType`](https://github.com/microsoft/vscode-azuretools/blob/main/utils/src/AzExtResourceType.ts)

The contribution object from the Azure Functions extension is shown below as an example.

This extension declares that it registers a BranchDataProvider for the `FunctionApp` resource type in the Azure resources view, and a BranchDataProvider for the `func` resource type in the Workspace resources view. It also registers a WorkspaceResourceProvider. Finally, it contributes a command to the "Create Resource..." quick pick prompt for creating a Funciton App.


```jsonc
{
    "contributes": {
        "x-azResources": {
            "azure": {
                "branches": [
                    // extension registers a BranchDataProvider for Function Apps
                    {
                        "type": "FunctionApp"
                    }
                ]
            },
            "workspace": {
                "branches": [
                    // extension registers a BranchDataProvider for workspace resources of type "func"
                    {
                        "type": "func"
                    }
                ],
                // extension registers a WorkspaceResourceProvider
                "resources": true
            },
            "commands": [
                // extension contributes a command to the "Create Resource..." quick pick prompt
                {
                    "command": "azureFunctions.createFunctionApp",
                    "title": "%azureFunctions.createFunctionApp%",
                    "detail": "%azureFunctions.createFunctionAppDetail%"
                }
            ],
        },
        // other extension contributions
    }
}
```

> <details>
> <summary>Example without comments (good for copying 😄)</summary>
>
>
> ```json
> "x-azResources": {
>     "azure": {
>         "branches": [
>             {
>                 "type": "FunctionApp"
>             }
>         ]
>     },
>     "workspace": {
>         "branches": [
>             {
>                 "type": "func"
>             }
>         ],
>         "resources": true
>     },
>     "commands": [
>         {
>             "command": "azureFunctions.createFunctionApp",
>             "title": "%azureFunctions.createFunctionApp%",
>             "detail": "%azureFunctions.createFunctionAppDetail%"
>         }
>     ]
> }
> ```
> </details>

## Getting started

On activation, client extensions can fetch an instance of the Host API by accessing the `exports` property of the Azure Resources extension.

```ts
import { AzureResourcesApi } from '@microsoft/vscode-azext-utils';

const extension = vscode.extensions.getExtension('ms-azuretools.vscode-azureresourcegroups');

if (extension) {
    if (!extension.isActive) {
        await extension.activate();
    }
    const apiProvider: AzureExtensionApiProvider = extension.exports;

    const hostApi = apiProvider.getApi<AzureResourcesApi>('2.0.0', {
        extensionId: 'client-extension-id'
    });

    const azureResourcesApi = hostApi.resources;
    // ...register providers
}
```


## Contribute to the Azure resources view

todo

## Contribute to the Workspace resources view

- register workspace resource provider for `type`
- register workspace resource branch data provider for `type`

## Extension dependencies

<img align="right" src="media/extension-dependency-graphic.png" alt="Extension dependency graphic" width="50%" />

Client extensions must declare the Azure Resources extension as an extension dependency in their extension manifest `package.json` file.

```json
"extensionDependencies": [
    "ms-azuretools.vscode-azureresources"
]
```

<br clear="right"/>

## API Reference

See [hostapi.v2.d.ts](../hostapi.v2.d.ts) for the full API definition.

## Terms

terms:
* **Host extension**: Azure Resources extension which exposes the Azure Resources API
* **Client extension**: Extension which consumes the Azure Resources API
* **Azure resources view**: Unified view of Azure resources contributed owned by the Azure Resources extension
* **Workspace resources view**: Unified view of workspace resources contributed by client extensions
* **Azure resource**: Any resource that can be represented in the Azure resources view
* **Workspace resource**: Any resource that is located on the local machine, or in the opened workspace.
* **Host API**: Azure Resources API exposed by the host extension

## Document todo list

big todo:
* Add overall architecture section
* FAQ

small todo:
* Don't forget to add the Azure Resources extension as a dependency in your extension's package.json
* how to pick a tree item
* add a create resource command
* portalUrl and viewProperties features
* Adding a product icon and display name

Utils

- Add value to the `AzExtResourceType` enum in utils
- Update `AzExtResourceType` type in index.d.ts
- Modify `getAzExtResourceType` to return the new `AzExtResourceType` accurately

Azure Resources

- Add icon in `resources/azureIcons` folder. File name should follow `[AzExtResourceType].svg`
- Add display info in src/utils/azureUtils.ts
- Add extension to src/azureExtensions.ts

