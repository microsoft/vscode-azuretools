# VSCode Azure SDK for Node.js - App Service Tools (Preview)

This package provides common Azure App Service elements for VS Code extensions.

All functionality for this package is built around the `SiteClient`, a wrapper of a `WebSiteManagementClient` for use with a specific Site. It reduces the number of arguments needed for every call and automatically ensures the 'slot' method is called when appropriate. Support for all methods on the `WebSiteManagementClient` are being added on an as-needed basis.

On top of that, this package provides functionality specifically designed for use in VS Code, including but not limited to:
* createFunctionApp/createWebApp: Guides the user through creation of a Function App or Web App.
* deploy: Automatically detects a site's deployment source and deploys based on that.
* startStreamingLogs: Creates a stream of the Site's logs to the outputChannel in VS Code.

> NOTE: This package throws a `UserCancelledError` if the user cancels an operation. This error should be handled appropriately by your extension.

## Deployment telemetry (unreleased)

Deployment joins the [utils workflow schema](../utils/README.md#workflow-telemetry-unreleased)
when the command initializes it; the shared `deploy` entry also initializes it for
existing callers. Stable `deploy.*` wizard identities are registered independently of
runtime UUIDs. Shared upload/request acceptance, Kudu polling/completion, predeploy
tasks, postdeploy task launch and trigger sync emit correlated child stages without
changing retry limits, polling behavior, confirmation UX or legacy result handling.

Zip, war, Flex, storage, Local Git and GitHub mechanisms are finite labels.
HTTP response categories and structured network codes are bounded. Upload/HTTP
acceptance is not completed deployment. Kudu status maps to running, succeeded,
failed, canceled, partial or unknown; an unknown/partial status and a canceled poll
must not become normalized completed success merely because the legacy method returns.
An observed successful Azure status does not force overall command success: later
trigger-discovery/task work can still fail the command.

Storage upload plus app-setting update observes acceptance, not app readiness;
normalized outcome stays unknown unless completion is independently observed.
GitHub-connected deployment remains blocked by the existing error, not a fabricated
successful handoff. Trigger sync and Kudu callbacks report only retries actually
invoked by the existing loops, not their configured maximum or normal poll iterations.
Local Git's internal cancellation of a concurrent poller is not a terminal user
cancellation; its existing force-push retry is counted only when push is invoked.
SDK-internal retries, acceptance latency separate from request latency, notification
think time, and server signals not returned to the extension remain unavailable.
Existing legacy diagnostics are unchanged; new child payloads do not copy deployment
IDs, resource names/IDs, paths, URLs, response bodies, log lines or exception messages.

Failed predeploy task stages are separate from the final decision. Deploy Anyway
does not prematurely fail the workflow, and a real retry followed by success is
distinguished from continuation. Aborting after a known failed task retains legacy
`Canceled` control flow but normalized `failed` / `preDeployTaskFailed`, not ordinary
user dismissal. Missing tasks are `blocked` / `preDeployTaskMissing`.
Only visible extension-owned dialogs are measured as user wait.

For an existing caller-owned task retry decision, pass
`tryRunPreDeployTask(context, path, scmType, { isRetry: true })` instead of recording a
retry before task lookup. This additive `IPreDeployTaskOptions` parameter records at
the actual `executeTask` launch-invocation seam (including a launch call that throws),
not a confirmed task-process-start event. Missing, skipped or already-active tasks
do not fabricate another invocation, and no deferred intent can attach to unrelated
work. Do not also call `recordWorkflowRetry` or use an attempt-numbered wrapper for
that same task retry.

### Source integration and release dependency

**Do not publish this appservice source against an API-incompatible utils version.**
The manifest currently retains its existing versions and range; that is not a claim
that registry utils `5.0.0` contains the unreleased workflow API. A human release must
publish utils first and update appservice's minimum utils dependency to the actual
released compatible version, along with release versions/lockfiles, before appservice
publication. Review/CI completion is not package-release readiness.

For local verification, from the repository root, build and pack utils, then install
that exact artifact into an already restored appservice dependency tree:

```powershell
npm ci --prefix utils
npm run build --prefix utils
npm pack .\utils --pack-destination <artifact-directory>
npm ci --prefix appservice
npm install --prefix appservice --no-save <exact-utils-tarball>
npm run lint --prefix appservice
npm run build --prefix appservice
npm test --prefix appservice
npm pack .\appservice --pack-destination <artifact-directory>
git diff --exit-code -- appservice/package.json appservice/package-lock.json
```

Keep the lockfile enabled: `--no-save` installs the artifact without writing manifests
or locks; `--package-lock=false` can unnecessarily re-resolve other dependencies.
Record the exact source SHA and artifact hashes; retained tarball versions alone do
not identify source. Consumers install both exact tarballs locally without committing
file references. The repository's appservice CI builds/installs sibling utils from the
same checkout before lint/build/tests, fails explicitly on integration errors, and
does not change external consumers of the reusable workflow. This proves integrated
source compatibility, not availability of the API in currently published packages.

The dependent consumer is
[microsoft/vscode-azurefunctions#5266](https://github.com/microsoft/vscode-azurefunctions/pull/5266).
Its exact-artifact acceptance and the human-owned release dependency are separate
from this source package's CI result.

## License
[MIT](LICENSE.md)
