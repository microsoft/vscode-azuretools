/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import * as os from 'node:os';
import * as path from 'node:path';
import { test, type TestContext } from 'node:test';
import { build, context, type BuildOptions } from 'esbuild';
import { copyPlugin as esmCopyPlugin, extensionEsbuildConfig, type CopyAsset } from '../esbuild/esbuildConfigs.js';

const { copyPlugin: cjsCopyPlugin } = createRequire(import.meta.url)('../../cjs/esbuild/esbuildConfigs.js') as typeof import('../esbuild/esbuildConfigs.js');

async function fixture(t: TestContext) {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'azext-copy-'));
    t.after(() => fs.rm(root, { recursive: true, force: true }));
    async function write(relative: string, contents: string | Uint8Array) {
        const file = path.join(root, relative);
        await fs.mkdir(path.dirname(file), { recursive: true });
        await fs.writeFile(file, contents);
    }
    return { root, write };
}

function config(root: string, copyPlugin: typeof esmCopyPlugin, assets: CopyAsset[], overrides: BuildOptions = {}): BuildOptions {
    return {
        absWorkingDir: root,
        stdin: { contents: 'export const value = 1;', loader: 'js' },
        outdir: 'dist',
        logLevel: 'silent',
        plugins: [copyPlugin({ assets })],
        ...overrides,
    };
}

for (const [format, copyPlugin] of [['ESM', esmCopyPlugin], ['CJS', cjsCopyPlugin]] as const) {
    await test(`${format}: selects flat SVGs and preserves recursive paths and binary contents`, async t => {
        const { root, write } = await fixture(t);
        const binary = Buffer.from([0, 255, 128, 13, 10]);
        await write('icons/root.svg', '<svg/>');
        await write('icons/ignored.txt', 'ignored');
        await write('icons/provider/nested.svg', '<svg>nested</svg>');
        await write('native/dist/bin/azcopy', binary);
        await write('native/package.json', '{}');
        const result = await build(config(root, copyPlugin, [
            { from: 'icons', to: 'flat', include: '*.svg' },
            { from: 'icons', to: 'recursive', include: '**/*.svg' },
            { from: 'native', to: 'node_modules/native' },
        ]));
        assert.equal(result.warnings.length, 0);
        assert.equal(await fs.readFile(path.join(root, 'dist/flat/root.svg'), 'utf8'), '<svg/>');
        await assert.rejects(fs.stat(path.join(root, 'dist/flat/provider/nested.svg')), { code: 'ENOENT' });
        await assert.rejects(fs.stat(path.join(root, 'dist/recursive/ignored.txt')), { code: 'ENOENT' });
        assert.equal(await fs.readFile(path.join(root, 'dist/recursive/provider/nested.svg'), 'utf8'), '<svg>nested</svg>');
        assert.deepEqual(await fs.readFile(path.join(root, 'dist/node_modules/native/dist/bin/azcopy')), binary);
        assert.equal(await fs.readFile(path.join(root, 'dist/node_modules/native/package.json'), 'utf8'), '{}');
    });

    await test(`${format}: resolves custom outdir, outfile, and absolute directories`, async t => {
        const { root, write } = await fixture(t);
        await write('assets/icon.svg', 'icon');
        const assets = [{ from: path.join(root, 'assets'), to: 'icons', include: ['*.svg', '*.png'] }];
        await build(config(root, copyPlugin, assets, { outdir: 'custom/output' }));
        assert.equal(await fs.readFile(path.join(root, 'custom/output/icons/icon.svg'), 'utf8'), 'icon');
        await build(config(root, copyPlugin, assets, { outdir: undefined, outfile: 'single/bundle.js' }));
        assert.equal(await fs.readFile(path.join(root, 'single/icons/icon.svg'), 'utf8'), 'icon');
        await build(config(root, copyPlugin, [{ from: 'assets', to: path.join(root, 'absolute') }], { outdir: undefined, write: false }));
        assert.equal(await fs.readFile(path.join(root, 'absolute/icon.svg'), 'utf8'), 'icon');
    });

    await test(`${format}: recopies changed and added assets on context rebuilds`, async t => {
        const { root, write } = await fixture(t);
        await write('assets/icon.svg', 'first');
        const ctx = await context(config(root, copyPlugin, [{ from: 'assets', to: 'icons' }]));
        try {
            await ctx.rebuild();
            await write('assets/icon.svg', 'updated');
            await write('assets/provider/new.svg', 'new');
            await ctx.rebuild();
            assert.equal(await fs.readFile(path.join(root, 'dist/icons/icon.svg'), 'utf8'), 'updated');
            assert.equal(await fs.readFile(path.join(root, 'dist/icons/provider/new.svg'), 'utf8'), 'new');
        } finally {
            await ctx.dispose();
        }
    });

    await test(`${format}: reports unmatched patterns and missing optional sources`, async t => {
        const { root, write } = await fixture(t);
        await write('assets/ignored.txt', 'ignored');
        const result = await build(config(root, copyPlugin, [
            { from: 'assets', to: 'icons', include: '*.svg' },
            { from: 'missing', to: 'missing' },
        ]));
        assert.equal(result.warnings.length, 2);
        assert.ok(result.warnings.every(warning => warning.text.includes('No files matched')));
    });

    await test(`${format}: surfaces filesystem failures and invalid destinations`, async t => {
        const { root, write } = await fixture(t);
        await write('assets/icon.svg', 'icon');
        await write('dist/blocked', 'not a directory');
        await assert.rejects(build(config(root, copyPlugin, [{ from: 'assets', to: 'blocked' }])));
        await assert.rejects(build(config(root, copyPlugin, [{ from: 'assets', to: 'icons' }], { outdir: undefined })), /requires outdir or outfile/);
        await assert.rejects(build(config(root, copyPlugin, [{ from: '', to: 'icons' }])), /non-empty/);
    });

    await test(`${format}: rejects patterns escaping the source directory`, async t => {
        const { root, write } = await fixture(t);
        await write('assets/icon.svg', 'icon');
        await write('outside.svg', 'outside');
        await assert.rejects(build(config(root, copyPlugin, [
            { from: 'assets', to: 'icons', include: '../*.svg' },
        ])), /outside the source directory/);
    });

    await test(`${format}: copies from linked package directories`, async t => {
        const { root, write } = await fixture(t);
        await write('package/resources/icon.svg', 'linked');
        await fs.symlink(path.join(root, 'package'), path.join(root, 'linked-package'), process.platform === 'win32' ? 'junction' : 'dir');
        await build(config(root, copyPlugin, [{ from: 'linked-package/resources', to: 'icons' }]));
        assert.equal(await fs.readFile(path.join(root, 'dist/icons/icon.svg'), 'utf8'), 'linked');
    });

    await test(`${format}: snapshots matches before copying into a source subdirectory`, async t => {
        const { root, write } = await fixture(t);
        await write('assets/icon.svg', 'icon');
        await build(config(root, copyPlugin, [{ from: 'assets', to: path.join(root, 'assets/output') }]));
        assert.equal(await fs.readFile(path.join(root, 'assets/output/icon.svg'), 'utf8'), 'icon');
        await assert.rejects(fs.stat(path.join(root, 'assets/output/output/icon.svg')), { code: 'ENOENT' });
    });
}

await test('default extension config copies Azure utils root and azureIcons SVGs into the build output', async t => {
    const { root, write } = await fixture(t);
    const resources = 'node_modules/@microsoft/vscode-azext-azureutils/resources';
    await write(`${resources}/root.svg`, 'root');
    await write(`${resources}/azureIcons/nested.svg`, 'nested');
    await write(`${resources}/ignored.txt`, 'ignored');
    const copy = extensionEsbuildConfig.plugins?.[0];
    assert.ok(copy);
    await build({
        ...extensionEsbuildConfig,
        absWorkingDir: root,
        entryPoints: undefined,
        stdin: { contents: 'module.exports = {};', loader: 'js' },
        alias: undefined,
        plugins: [copy],
        logLevel: 'silent',
    });
    assert.equal(await fs.readFile(path.join(root, 'dist', resources, 'root.svg'), 'utf8'), 'root');
    assert.equal(await fs.readFile(path.join(root, 'dist', resources, 'azureIcons/nested.svg'), 'utf8'), 'nested');
    await assert.rejects(fs.stat(path.join(root, 'dist', resources, 'ignored.txt')), { code: 'ENOENT' });
});

await test('copies executable permissions on POSIX', { skip: process.platform === 'win32' }, async t => {
    const { root, write } = await fixture(t);
    await write('native/azcopy', 'executable');
    await fs.chmod(path.join(root, 'native/azcopy'), 0o755);
    await build(config(root, esmCopyPlugin, [{ from: 'native', to: 'native' }]));
    assert.equal((await fs.stat(path.join(root, 'dist/native/azcopy'))).mode & 0o777, 0o755);
});
