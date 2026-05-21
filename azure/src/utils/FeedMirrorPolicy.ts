/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { Pipeline, PipelinePolicy, PipelineRequest, PipelineResponse, SendRequest } from '@azure/core-rest-pipeline';
import { redirectPolicy, redirectPolicyName } from '@azure/core-rest-pipeline';
import { createClientLogger, type AzureLogger } from '@azure/logger';

/**
 * Pipeline policy that rewrites external package feed URLs to an AzDO feed mirror
 * and manages auth (Bearer for the feed host, stripped on cross-origin redirect).
 *
 * Rewrites:
 * - `www.nuget.org/api/v2/package/{id}/{ver}`          -> `{base}/nuget/v3/flat2/{id}/{ver}/{id}.{ver}.nupkg`
 * - `api.nuget.org/v3-flatcontainer/{id}/{ver}/{file}` -> `{base}/nuget/v3/flat2/{id}/{ver}/{file}`
 * - `www.powershellgallery.com/api/v2/...`             -> `{base}/nuget/v2/...`
 *
 * Because the policy is placed after the built-in `redirectPolicy`, it re-runs on
 * each redirect iteration. On the initial request it rewrites the URL and adds auth;
 * after a 303 redirect to e.g. blob storage (different host) it strips auth so the
 * SAS-authenticated URL can succeed.
 *
 * Env vars:
 * - FEED_BASE_URL - e.g. https://devdiv.pkgs.visualstudio.com/DevDiv/_packaging/azcode
 * - FEED_PAT      - Bearer token (System.AccessToken)
 */
export class FeedMirrorPolicy implements PipelinePolicy {
    public readonly name = 'feedMirrorPolicy';

    private readonly nugetV2Re = /^https:\/\/www\.nuget\.org\/api\/v2\/package\/(?<id>[^/]+)\/(?<version>.+?)\/?$/;
    private readonly nugetV3Re = /^https:\/\/api\.nuget\.org\/v3-flatcontainer\/(?<id>[^/]+)\/(?<version>[^/]+)\/(?<file>.+\.nupkg)$/;
    private readonly psgalleryPrefix = 'https://www.powershellgallery.com/api/v2';

    private constructor(
        private readonly feedBaseUrl: string,
        private readonly feedPat: string,
        private readonly feedHost: string,
        private readonly log: AzureLogger
    ) { }

    /**
     * If running in a test environment with a feed mirror configured, creates the
     * policy and adds it to the client's pipeline. No-ops otherwise.
     */
    public static addIfNeeded(clientPipeline: Pipeline, logger?: AzureLogger): void {
        if (!process.env.VSCODE_RUNNING_TESTS) {
            return;
        }

        const feedBaseUrl = process.env.FEED_BASE_URL?.replace(/\/+$/, '');
        const feedPat = process.env.FEED_PAT;
        if (!feedBaseUrl || !feedPat) {
            return;
        }

        let feedHost: string;
        try {
            feedHost = new URL(feedBaseUrl).host;
        } catch {
            return;
        }

        // The AzDO feed responds with a 303 redirect to blob storage (*.blob.core.windows.net).
        // The default redirectPolicy has allowCrossOriginRedirects: false and refuses to follow it,
        // causing StatusCodePolicy to throw "Unexpected status code: 303". Replace it with one
        // that allows cross-origin redirects. afterPhase: 'Retry' matches the original positioning
        // from createPipelineFromOptions.
        clientPipeline.removePolicy({ name: redirectPolicyName });
        clientPipeline.addPolicy(redirectPolicy({ allowCrossOriginRedirects: true }), { afterPhase: 'Retry' });

        const policy = new FeedMirrorPolicy(feedBaseUrl, feedPat, feedHost, logger ?? createClientLogger('feedMirror'));
        clientPipeline.addPolicy(policy, { afterPolicies: [redirectPolicyName] });
    }

    public async sendRequest(request: PipelineRequest, next: SendRequest): Promise<PipelineResponse> {
        // NuGet v2 URL rewrite: nuget.org/api/v2/package/{id}/{ver} → mirror v3 flat container
        const nugetV2Match = this.nugetV2Re.exec(request.url);
        if (nugetV2Match?.groups) {
            const id = nugetV2Match.groups.id.toLowerCase();
            const version = nugetV2Match.groups.version;
            request.url = `${this.feedBaseUrl}/nuget/v3/flat2/${id}/${version}/${id}.${version}.nupkg`;
            this.log.info(`NuGet v2 rewrite → ${request.url}`);
        }

        // NuGet v3 URL rewrite: api.nuget.org/v3-flatcontainer/{id}/{ver}/{file} → mirror
        const nugetV3Match = nugetV2Match ? null : this.nugetV3Re.exec(request.url);
        if (nugetV3Match?.groups) {
            const id = nugetV3Match.groups.id.toLowerCase();
            const version = nugetV3Match.groups.version;
            const file = nugetV3Match.groups.file;
            request.url = `${this.feedBaseUrl}/nuget/v3/flat2/${id}/${version}/${file}`;
            this.log.info(`NuGet v3 rewrite → ${request.url}`);
        }

        // PSGallery URL rewrite: powershellgallery.com/api/v2/... → mirror/nuget/v2/...
        // (aka.ms/PwshPackageInfo redirects here first via the built-in redirectPolicy)
        if (request.url.startsWith(this.psgalleryPrefix)) {
            request.url = request.url.replace(this.psgalleryPrefix, `${this.feedBaseUrl}/nuget/v2`);
            this.log.info(`PSGallery rewrite → ${request.url}`);
        }

        // Auth: add Bearer for the feed host, strip after redirect away from it
        try {
            const requestHost = new URL(request.url).host;
            const header = `Bearer ${this.feedPat}`;
            if (requestHost === this.feedHost) {
                request.headers.set('Authorization', header);
            } else if (request.headers.get('Authorization') === header) {
                // Only remove auth we added -- don't touch auth set by others
                request.headers.delete('Authorization');
            }
        } catch { /* invalid URL */ }

        const response = await next(request);

        // The built-in redirectPolicy only follows 303 for POST requests (per HTTP spec),
        // but the AzDO feed returns 303 for GET requests to redirect to blob storage.
        // Follow 303 redirects manually, stripping auth since the target is a different host.
        const location = response.headers.get('location');
        if (response.status === 303 && location) {
            request.url = location;
            request.headers.delete('Authorization');
            return next(request);
        }

        return response;
    }
}
