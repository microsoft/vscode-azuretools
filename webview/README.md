# VSCode Azure SDK for Node.js - Web View Tools (Preview)

This package provides common Web View elements for VS Code extensions.

## Template Gallery external tabs

Set `TemplateGalleryConfig.externalTabs` to add tabs that open an extension-owned
experience. Each tab has an `id`, a `label`, and optional `icon` (a codicon name
without the `codicon-` prefix) and `useCases` filter values.

Override `TemplateGalleryController.onExternalTabSelected(tabId, source, filters)`
to handle selection. The source is `tab` or `filter`; filters include the selected
use case when a claimed filter is clicked. Selection leaves the current gallery
tab and filters unchanged. Use-case matching is case-insensitive, and `all` is
never claimed. Empty, duplicate, and built-in (`browse`, `ai`) tab IDs are ignored.
Omitting `externalTabs` preserves the default gallery behavior.

## License
[MIT](LICENSE.md)
