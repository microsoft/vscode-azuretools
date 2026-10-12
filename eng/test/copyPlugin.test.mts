/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as fs from 'node:fs/promises';
import { unlinkSync } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, it } from 'mocha';
import { build, context, type BuildOptions } from 'esbuild';
import { should as registerShould } from 'chai';
import { copyPlugin, extensionEsbuildConfig, type CopyAsset } from '@microsoft/vscode-azext-eng/esbuild';

const should = registerShould();
const fixtures: string[] = [];

afterEach(async () => {
    for (const root of fixtures.splice(0)) {
        await fs.rm(root, { recursive: true, force: true });
    }
});

async function fixture() {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'azext-copy-'));
    fixtures.push(root);
    async function write(relative: string, contents: string | Uint8Array) {
        const file = path.join(root, relative);
        await fs.mkdir(path.dirname(file), { recursive: true });
        await fs.writeFile(file, contents);
    }
    return { root, write };
}

function config(root: string, assets: CopyAsset[], overrides: BuildOptions = {}): BuildOptions {
    return {
        absWorkingDir: root,
        stdin: { contents: 'export const value = 1;', loader: 'js' },
        outdir: 'dist',
        logLevel: 'silent',
        plugins: [copyPlugin({ assets })],
        ...overrides,
    };
}

describe('copyPlugin', () => {
    it('selects flat SVGs and preserves recursive paths and binary contents', async () => {
        const { root, write } = await fixture();
        const binary = Buffer.from([0, 255, 128, 13, 10]);
        await write('icons/root.svg', '<svg/>');
        await write('icons/ignored.txt', 'ignored');
        await write('icons/provider/nested.svg', '<svg>nested</svg>');
        await write('native/dist/bin/azcopy', binary);
        await write('native/package.json', '{}');
        const result = await build(config(root, [
            { from: 'icons', to: 'flat', include: '*.svg' },
            { from: 'icons', to: 'recursive', include: '**/*.svg' },
            { from: 'native', to: 'node_modules/native' },
        ]));
        result.warnings.should.have.lengthOf(0);
        (await fs.readFile(path.join(root, 'dist/flat/root.svg'), 'utf8')).should.equal('<svg/>');
        await fs.stat(path.join(root, 'dist/flat/provider/nested.svg')).should.be.rejected.and.eventually.have.property('code', 'ENOENT');
        await fs.stat(path.join(root, 'dist/recursive/ignored.txt')).should.be.rejected.and.eventually.have.property('code', 'ENOENT');
        (await fs.readFile(path.join(root, 'dist/recursive/provider/nested.svg'), 'utf8')).should.equal('<svg>nested</svg>');
        (await fs.readFile(path.join(root, 'dist/node_modules/native/dist/bin/azcopy'))).should.deep.equal(binary);
        (await fs.readFile(path.join(root, 'dist/node_modules/native/package.json'), 'utf8')).should.equal('{}');
    });

    it('resolves custom outdir, outfile, and absolute directories', async () => {
        const { root, write } = await fixture();
        await write('assets/icon.svg', 'icon');
        const assets = [{ from: path.join(root, 'assets'), to: 'icons', include: ['*.svg', '*.png'] }];
        await build(config(root, assets, { outdir: 'custom/output' }));
        (await fs.readFile(path.join(root, 'custom/output/icons/icon.svg'), 'utf8')).should.equal('icon');
        await build(config(root, assets, { outdir: undefined, outfile: 'single/bundle.js' }));
        (await fs.readFile(path.join(root, 'single/icons/icon.svg'), 'utf8')).should.equal('icon');
        await build(config(root, [{ from: 'assets', to: path.join(root, 'absolute') }], { outdir: undefined, write: false }));
        (await fs.readFile(path.join(root, 'absolute/icon.svg'), 'utf8')).should.equal('icon');
    });

    it('recopies changed and added assets on context rebuilds', async () => {
        const { root, write } = await fixture();
        await write('assets/icon.svg', 'first');
        const ctx = await context(config(root, [{ from: 'assets', to: 'icons' }]));
        try {
            await ctx.rebuild();
            await write('assets/icon.svg', 'updated');
            await write('assets/provider/new.svg', 'new');
            await ctx.rebuild();
            (await fs.readFile(path.join(root, 'dist/icons/icon.svg'), 'utf8')).should.equal('updated');
            (await fs.readFile(path.join(root, 'dist/icons/provider/new.svg'), 'utf8')).should.equal('new');
        } finally {
            await ctx.dispose();
        }
    });

    it('reports unmatched patterns and missing optional sources', async () => {
        const { root, write } = await fixture();
        await write('assets/ignored.txt', 'ignored');
        const result = await build(config(root, [
            { from: 'assets', to: 'icons', include: '*.svg' },
            { from: 'missing', to: 'missing' },
        ]));
        result.warnings.should.have.lengthOf(2);
        result.warnings.every(warning => warning.text.includes('No files matched')).should.equal(true);
    });

    it('surfaces filesystem failures and invalid destinations', async () => {
        const { root, write } = await fixture();
        await write('assets/icon.svg', 'icon');
        await write('dist/blocked', 'not a directory');
        await build(config(root, [{ from: 'assets', to: 'blocked' }])).should.be.rejected;
        await build(config(root, [{ from: 'assets', to: 'icons' }], { outdir: undefined })).should.be.rejectedWith(/requires outdir or outfile/);
        await build(config(root, [{ from: '', to: 'icons' }])).should.be.rejectedWith(/non-empty/);
    });

    it('rejects patterns escaping the source directory', async () => {
        const { root, write } = await fixture();
        await write('assets/icon.svg', 'icon');
        await write('outside.svg', 'outside');
        await build(config(root, [
            { from: 'assets', to: 'icons', include: '../*.svg' },
        ])).should.be.rejectedWith(/outside the source directory/);
    });

    it('copies from linked package directories', async () => {
        const { root, write } = await fixture();
        await write('package/resources/icon.svg', 'linked');
        await fs.symlink(path.join(root, 'package'), path.join(root, 'linked-package'), process.platform === 'win32' ? 'junction' : 'dir');
        await build(config(root, [{ from: 'linked-package/resources', to: 'icons' }]));
        (await fs.readFile(path.join(root, 'dist/icons/icon.svg'), 'utf8')).should.equal('linked');
    });

    it('snapshots matches before copying into a source subdirectory', async () => {
        const { root, write } = await fixture();
        await write('assets/icon.svg', 'icon');
        await build(config(root, [{ from: 'assets', to: path.join(root, 'assets/output') }]));
        (await fs.readFile(path.join(root, 'assets/output/icon.svg'), 'utf8')).should.equal('icon');
        await fs.stat(path.join(root, 'assets/output/output/icon.svg')).should.be.rejected.and.eventually.have.property('code', 'ENOENT');
    });

    it('rejects invalid exact permission modes', async () => {
        const { root, write } = await fixture();
        await write('assets/icon.svg', 'icon');
        for (const mode of [-1, 1.5, NaN, Infinity, 0o10000]) {
            await build(config(root, [{ from: 'assets', to: 'icons', mode }])).should.be.rejectedWith(/mode must be an integer between 0 and 0o7777/);
        }
    });

    it('sets exact destination permissions, including zero, without changing sources on POSIX', async function () {
        if (process.platform === 'win32') {
            this.skip();
        }
        const { root, write } = await fixture();
        await write('native/azcopy', 'executable');
        await fs.chmod(path.join(root, 'native/azcopy'), 0o640);
        await build(config(root, [
            { from: 'native', to: 'exact', mode: 0o750 },
            { from: 'native', to: 'none', mode: 0 },
        ]));
        ((await fs.stat(path.join(root, 'dist/exact/azcopy'))).mode & 0o7777).should.equal(0o750);
        ((await fs.stat(path.join(root, 'dist/none/azcopy'))).mode & 0o7777).should.equal(0);
        ((await fs.stat(path.join(root, 'native/azcopy'))).mode & 0o7777).should.equal(0o640);
    });

    it('transforms only matched destination permissions on every POSIX rebuild', async function () {
        if (process.platform === 'win32') {
            this.skip();
        }
        const { root, write } = await fixture();
        await write('native/dist/bin/azcopy', 'first');
        await write('native/package.json', '{}');
        await fs.chmod(path.join(root, 'native/dist/bin/azcopy'), 0o640);
        await fs.chmod(path.join(root, 'native/package.json'), 0o644);
        const currentModes: number[] = [];
        const ctx = await context(config(root, [
            { from: 'native', to: 'node_modules/native' },
            {
                from: 'native', to: 'node_modules/native', include: 'dist/bin/azcopy',
                mode: current => {
                    currentModes.push(current);
                    return current | 0o100;
                },
            },
        ]));
        try {
            await ctx.rebuild();
            ((await fs.stat(path.join(root, 'dist/node_modules/native/dist/bin/azcopy'))).mode & 0o7777).should.equal(0o740);
            ((await fs.stat(path.join(root, 'native/dist/bin/azcopy'))).mode & 0o7777).should.equal(0o640);
            await write('native/dist/bin/azcopy', 'updated');
            await fs.chmod(path.join(root, 'native/dist/bin/azcopy'), 0o604);
            await ctx.rebuild();
            ((await fs.stat(path.join(root, 'dist/node_modules/native/dist/bin/azcopy'))).mode & 0o7777).should.equal(0o704);
            ((await fs.stat(path.join(root, 'native/dist/bin/azcopy'))).mode & 0o7777).should.equal(0o604);
            ((await fs.stat(path.join(root, 'dist/node_modules/native/package.json'))).mode & 0o7777).should.equal(0o644);
            (await fs.readFile(path.join(root, 'dist/node_modules/native/dist/bin/azcopy'), 'utf8')).should.equal('updated');
            currentModes.should.deep.equal([0o640, 0o604]);
        } finally {
            await ctx.dispose();
        }
    });

    it('surfaces callback/chmod errors and refuses source aliases on POSIX', async function () {
        if (process.platform === 'win32') {
            this.skip();
        }
        const { root, write } = await fixture();
        await write('assets/icon.svg', 'icon');
        await fs.chmod(path.join(root, 'assets/icon.svg'), 0o640);
        await build(config(root, [{ from: 'assets', to: 'icons', mode: () => NaN }])).should.be.rejectedWith(/mode must be an integer/);
        await build(config(root, [{
            from: 'assets', to: 'icons', mode: () => { throw new Error('permission callback failed'); },
        }])).should.be.rejectedWith(/permission callback failed/);
        await build(config(root, [{
            from: 'assets', to: 'icons', mode: () => {
                unlinkSync(path.join(root, 'dist/icons/icon.svg'));
                return 0o755;
            },
        }])).should.be.rejectedWith(/ENOENT/);
        await build(config(root, [{
            from: 'assets', to: path.join(root, 'assets'), mode: 0o755,
        }])).should.be.rejectedWith(/source and destination refer to the same file/);
        await fs.mkdir(path.join(root, 'dist/linked'), { recursive: true });
        await fs.link(path.join(root, 'assets/icon.svg'), path.join(root, 'dist/linked/icon.svg'));
        await build(config(root, [{
            from: 'assets', to: 'linked', mode: 0o755,
        }])).should.be.rejectedWith(/source and destination refer to the same file/);
        ((await fs.stat(path.join(root, 'assets/icon.svg'))).mode & 0o7777).should.equal(0o640);
    });

    it('ignores permission overrides without warnings on Windows', async function () {
        if (process.platform !== 'win32') {
            this.skip();
        }
        const { root, write } = await fixture();
        await write('assets/icon.svg', 'icon');
        const result = await build(config(root, [
            { from: 'assets', to: 'exact', mode: 0o755 },
            { from: 'assets', to: 'callback', mode: () => { throw new Error('must not run on Windows'); } },
        ]));
        result.warnings.should.have.lengthOf(0);
        (await fs.readFile(path.join(root, 'dist/exact/icon.svg'), 'utf8')).should.equal('icon');
        (await fs.readFile(path.join(root, 'dist/callback/icon.svg'), 'utf8')).should.equal('icon');
    });
});

it('default extension config copies Azure utils root and azureIcons SVGs into the build output', async () => {
    const { root, write } = await fixture();
    const resources = 'node_modules/@microsoft/vscode-azext-azureutils/resources';
    await write(`${resources}/root.svg`, 'root');
    await write(`${resources}/azureIcons/nested.svg`, 'nested');
    await write(`${resources}/ignored.txt`, 'ignored');
    const copy = extensionEsbuildConfig.plugins?.[0];
    should.exist(copy);
    await build({
        ...extensionEsbuildConfig,
        absWorkingDir: root,
        entryPoints: undefined,
        stdin: { contents: 'module.exports = {};', loader: 'js' },
        alias: undefined,
        plugins: [copy!],
        logLevel: 'silent',
    });
    (await fs.readFile(path.join(root, 'dist', resources, 'root.svg'), 'utf8')).should.equal('root');
    (await fs.readFile(path.join(root, 'dist', resources, 'azureIcons/nested.svg'), 'utf8')).should.equal('nested');
    await fs.stat(path.join(root, 'dist', resources, 'ignored.txt')).should.be.rejected.and.eventually.have.property('code', 'ENOENT');
});

it('copies executable permissions on POSIX', async function () {
    if (process.platform === 'win32') {
        this.skip();
    }
    const { root, write } = await fixture();
    await write('native/azcopy', 'executable');
    await fs.chmod(path.join(root, 'native/azcopy'), 0o755);
    await build(config(root, [{ from: 'native', to: 'native' }]));
    ((await fs.stat(path.join(root, 'dist/native/azcopy'))).mode & 0o777).should.equal(0o755);
});
