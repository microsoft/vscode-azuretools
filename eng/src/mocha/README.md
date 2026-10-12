# Standalone Node/Mocha Tests

For packages which do not require the VS Code extension host, share the Node/TypeScript
Mocha configuration through `.mocharc.cjs`:

```js
const { createNodeMochaConfig } = require('@microsoft/vscode-azext-eng/mocha/config');

module.exports = createNodeMochaConfig({
    // Optional: override the default src/test/ layout.
    spec: ['test/**/*.test.{ts,mts,cts}'],
    ui: 'tdd',
});
```

Run with `"test": "mocha"` in `package.json`. ESM consumers can import the same factory
from a supported configuration-loading entry point or generate the CLI configuration
programmatically.

The factory defaults to BDD and `src/test/**/*.test.{ts,mts,cts}`. It uses Node's
`experimental-transform-types` flag and the existing shared Mocha entry to register
extensionless TypeScript resolution, global `expect`, and chai-as-promised. Resolution
uses Node's synchronous module hooks for ESM imports and leaves CommonJS `require`
resolution unchanged. The package's Node.js minimum (24) applies. Additional
`node-option` entries are appended; other overrides replace defaults. Each call clones configuration arrays
and plain objects without cloning callbacks or reporter instances.

Test filtering, integration-test prerequisites, and test-specific timeouts remain
under the consumer's control. The shared config does not register Chai's `should`
interface or change `Object.prototype`.

[Back to Root](../../README.md)
