# Standalone Node/Mocha Tests

For packages which do not require the VS Code extension host, share the Node/TypeScript
Mocha configuration through `.mocharc.cjs`:

```js
const { createNodeMochaConfig } = require('@microsoft/vscode-azext-eng/mocha/config');

module.exports = createNodeMochaConfig();
```

Run with `"test": "mocha"` in `package.json`. Use `.mocharc.cjs` even in ESM packages:
Mocha does not discover or load `.mocharc.mjs` as JavaScript configuration.

The factory defaults to BDD and discovers `**/*.test.{ts,mts,cts}` beneath the current
working directory, excluding `node_modules`. Override `spec` to restrict discovery,
or `ui` to select another test interface. It uses Node's
`experimental-transform-types` flag and the existing shared Mocha entry to register
extensionless TypeScript resolution, global `expect`, and chai-as-promised. Resolution
uses the existing asynchronous module hook for ESM imports and leaves CommonJS `require`
resolution unchanged. The package's Node.js minimum (22.17.0) applies. Additional
`node-option` entries are appended; other overrides replace defaults. Each call clones configuration arrays
and plain objects without cloning callbacks or reporter instances.

Test filtering, integration-test prerequisites, and test-specific timeouts remain
under the consumer's control. The shared config does not register Chai's `should`
interface or change `Object.prototype`.

[Back to Root](../../README.md)
