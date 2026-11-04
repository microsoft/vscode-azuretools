# VSCode Azure SDK for Node.js - App Service Tools (Preview)

This package provides common Azure App Service elements for VS Code extensions.

All functionality for this package is built around the `SiteClient`, a wrapper of a `WebSiteManagementClient` for use with a specific Site. It reduces the number of arguments needed for every call and automatically ensures the 'slot' method is called when appropriate. Support for all methods on the `WebSiteManagementClient` are being added on an as-needed basis.

On top of that, this package provides functionality specifically designed for use in VS Code, including but not limited to:
* createFunctionApp/createWebApp: Guides the user through creation of a Function App or Web App.
* deploy: Automatically detects a site's deployment source and deploys based on that.
* startStreamingLogs: Creates a stream of the Site's logs to the outputChannel in VS Code.

> NOTE: This package throws a `UserCancelledError` if the user cancels an operation. This error should be handled appropriately by your extension.

## Site lifecycle

Use `await siteClient.restart()` to invoke Azure's native restart operation. Like `stop()` and `start()`, it automatically targets the production site or the deployment slot represented by the client. It awaits the ARM request and propagates failures; it does not stop and then start the app or wait for application health.

To try an unpublished change in a consumer, run `npm ci`, `npm run build`, and `npm run package` in this package. In a clean consumer checkout, run `npm ci` followed by `npm install --no-save <path-to-generated-tgz>` (leave the lockfile enabled), then build the consumer. Do not commit the tarball or local paths to its dependency manifests; use a published package version for the final dependency update.

## Remote file content

Use `getFileBytes(context, site, url)` for virtual file systems and other byte-preserving downloads. It returns `{ data: Uint8Array, etag: string }`, streams the response through the existing authenticated ARM or Kudu client, and does not decode content based on its MIME type. Keep the returned ETag for conditional saves with `putFile`; byte uploads are sent without text conversion. The existing `getFile` helper continues to return text.

`FileTreeItem.openReadOnly` still uses the existing text helper. Switching it to byte-preserving read-only previews is a follow-up after the utils package publishes `openReadOnlyFile` and this package updates its minimum utils dependency to that release.

## Deployment telemetry
Deployment uses published utils `^5.1.0` for bounded, correlated stages; upload acceptance is not Azure completion, and deployment status is independent of command outcome.
For caller-owned retries, `tryRunPreDeployTask(context, path, scmType, { isRetry: true })` counts actual `executeTask` invocations (including throws), not missing, skipped or active tasks; do not double-count. Consumers need appservice `6.1.0` published before using this additive API.

## License
[MIT](LICENSE.md)
