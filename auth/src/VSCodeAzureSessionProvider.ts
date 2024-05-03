import { type TenantIdDescription } from "@azure/arm-resources-subscriptions";
import { AuthenticationGetSessionOptions, AuthenticationSession, Event, EventEmitter, Disposable as VSCodeDisposable, authentication } from "vscode";
import { AzureAuthenticationSession, AzureSessionProvider, DefinedTenant, GetSessionBehavior, SignInStatus } from "./AzureSessionProvider";
import { NotSignedInError } from "./NotSignedInError";
import { getConfiguredAuthProviderId, getConfiguredAzureEnv } from "./utils/configuredAzureEnv";
import { getSubscriptionClient } from "./utils/resourceManagement";

enum AuthScenario {
    Initialization,
    SignIn,
    GetSessionSilent,
    GetSessionPrompt,
}

type TenantSignInStatus = {
    tenant: DefinedTenant;
    isSignedIn: boolean;
};

export class VSCodeAzureSessionProvider extends VSCodeDisposable implements AzureSessionProvider {
    private readonly initializePromise: Promise<void>;
    private handleSessionChanges: boolean = true;
    private tenantSignInStatuses: TenantSignInStatus[] = [];

    public readonly onSignInStatusChangeEmitter = new EventEmitter<SignInStatus>();
    public signInStatusValue: SignInStatus = "Initializing";

    public constructor() {
        const disposable = authentication.onDidChangeSessions(async (e) => {
            // Ignore events for non-microsoft providers
            if (e.provider.id !== getConfiguredAuthProviderId()) {
                return;
            }

            // Ignore events that we triggered.
            if (!this.handleSessionChanges) {
                return;
            }

            // Silently check authentication status and tenants
            await this.signInAndUpdateTenants(AuthScenario.Initialization);
        });

        super(() => {
            this.onSignInStatusChangeEmitter.dispose();
            disposable.dispose();
        });

        this.initializePromise = this.initialize();
    }

    public get signInStatus(): SignInStatus {
        return this.signInStatusValue;
    }

    public get signInStatusChangeEvent(): Event<SignInStatus> {
        return this.onSignInStatusChangeEmitter.event;
    }

    public get tenants(): DefinedTenant[] {
        return this.tenantSignInStatuses.map(s => s.tenant);
    }

    public isSignedInToTenant(tenantId: string): boolean {
        return this.tenantSignInStatuses.some(s => s.tenant.tenantId === tenantId && s.isSignedIn);
    }

    private async initialize(): Promise<void> {
        await this.signInAndUpdateTenants(AuthScenario.Initialization);
    }

    /**
     * Sign in to Azure interactively, i.e. prompt the user to sign in even if they have an active session.
     * This allows the user to choose a different account or tenant.
     */
    public async signIn(): Promise<void> {
        await this.initializePromise;

        const newSignInStatus = "SigningIn";
        if (newSignInStatus !== this.signInStatusValue) {
            this.signInStatusValue = newSignInStatus;
            this.onSignInStatusChangeEmitter.fire(this.signInStatusValue);
        }

        await this.signInAndUpdateTenants(AuthScenario.SignIn);
    }

    private async signInAndUpdateTenants(authScenario: AuthScenario): Promise<void> {
        // Initially, try to get a session using the 'organizations' tenant/authority:
        // https://learn.microsoft.com/en-us/entra/identity-platform/msal-client-application-configuration#authority
        // This allows the user to sign in to the Microsoft provider and list tenants,
        // but the resulting session will not allow tenant-level operations. For that,
        // we need to get a session for a specific tenant.
        const scopes = [getDefaultScope(getConfiguredAzureEnv().resourceManagerEndpointUrl)];
        const getSessionResult = await this.getArmSession("organizations", authScenario, scopes);
        if (getSessionResult === undefined) {
            if (this.tenantSignInStatuses.length > 0 || this.signInStatusValue !== "SignedOut") {
                this.tenantSignInStatuses = [];
                this.signInStatusValue = "SignedOut";
                this.onSignInStatusChangeEmitter.fire(this.signInStatusValue);
            }

            return;
        }

        // Get the tenants
        const allTenants = await getTenants(getSessionResult);

        const signInStatusesPromises = allTenants.map<Promise<TenantSignInStatus>>(async (t) => {
            const session = await this.getArmSession(t.tenantId, AuthScenario.Initialization, scopes);
            return {
                tenant: t,
                isSignedIn: session !== undefined,
            };
        });

        const newTenantSignInStatuses = await Promise.all(signInStatusesPromises);
        const tenantsChanged = !areStringCollectionsEqual(
            this.tenantSignInStatuses.map(s => s.tenant.tenantId),
            newTenantSignInStatuses.map(s => s.tenant.tenantId));

        // Get the overall sign-in status. If the user has access to any tenants they are signed in.
        const newSignInStatus = newTenantSignInStatuses.length > 0 ? "SignedIn" : "SignedOut";
        const signInStatusChanged = newSignInStatus !== this.signInStatusValue;

        // Update the state and fire event if anything has changed.
        this.tenantSignInStatuses = newTenantSignInStatuses;
        this.signInStatusValue = newSignInStatus;
        if (signInStatusChanged || tenantsChanged) {
            this.onSignInStatusChangeEmitter.fire(this.signInStatusValue);
        }
    }

    /**
     * Get the current Azure session, silently if possible.
     * @returns The current Azure session, if available. If the user is not signed in, or there are no tenants,
     * an error is thrown.
     */
    public async getAuthSession(tenantId: string, behavior: GetSessionBehavior, scopes?: string[]): Promise<AzureAuthenticationSession | undefined> {
        await this.initializePromise;
        if (this.signInStatusValue !== "SignedIn") {
            throw new NotSignedInError();
        }

        const tenantSignInStatus = this.tenantSignInStatuses.find(s => s.tenant.tenantId === tenantId);
        if (!tenantSignInStatus) {
            throw new Error(`User does not have access to tenant ${tenantId}`);
        }

        // Get a session for a specific tenant.
        scopes = scopes || [getDefaultScope(getConfiguredAzureEnv().resourceManagerEndpointUrl)];
        const behaviourScenarios: Record<GetSessionBehavior, AuthScenario> = {
            [GetSessionBehavior.Silent]: AuthScenario.GetSessionSilent,
            [GetSessionBehavior.PromptIfRequired]: AuthScenario.GetSessionPrompt,
        };

        const session = await this.getArmSession(tenantId, behaviourScenarios[behavior], scopes);
        tenantSignInStatus.isSignedIn = session !== undefined;

        return session;
    }

    private async getArmSession(
        tenantId: string,
        authScenario: AuthScenario,
        scopes: string[],
    ): Promise<AzureAuthenticationSession | undefined> {
        this.handleSessionChanges = false;
        try {
            scopes = addTenantIdScope(scopes, tenantId);

            let options: AuthenticationGetSessionOptions;
            let silentFirst = false;
            switch (authScenario) {
                case AuthScenario.Initialization:
                case AuthScenario.GetSessionSilent:
                    options = { createIfNone: false, clearSessionPreference: false, silent: true };
                    break;
                case AuthScenario.SignIn:
                    options = { createIfNone: true, clearSessionPreference: true, silent: false };
                    break;
                case AuthScenario.GetSessionPrompt:
                    // the 'createIfNone' option cannot be used with 'silent', but really we want both
                    // flags here (i.e. create a session silently, but do create one if it doesn't exist).
                    // To allow this, we first try to get a session silently.
                    silentFirst = true;
                    options = { createIfNone: true, clearSessionPreference: false, silent: false };
                    break;
            }

            let session: AuthenticationSession | undefined;
            if (silentFirst) {
                // The 'silent' option is incompatible with most other options, so we completely replace the options object here.
                session = await authentication.getSession(getConfiguredAuthProviderId(), scopes, { silent: true });
            }

            if (!session) {
                session = await authentication.getSession(getConfiguredAuthProviderId(), scopes, options);
            }

            if (!session) {
                return undefined;
            }

            return Object.assign(session, { tenantId });
        } finally {
            this.handleSessionChanges = true;
        }
    }
}

function getDefaultScope(endpointUrl: string): string {
    // Endpoint URL is that of the audience, e.g. for ARM in the public cloud
    // it would be "https://management.azure.com".
    return endpointUrl.endsWith("/") ? `${endpointUrl}.default` : `${endpointUrl}/.default`;
}

async function getTenants(session: AuthenticationSession): Promise<DefinedTenant[]> {
    const { client } = await getSubscriptionClient(session);

    const results: TenantIdDescription[] = [];
    for await (const tenant of client.tenants.list()) {
        results.push(tenant);
    }

    return results.filter(isDefinedTenant);
}

function isDefinedTenant(tenant: TenantIdDescription): tenant is DefinedTenant {
    return tenant.tenantId !== undefined && tenant.displayName !== undefined;
}

function areStringCollectionsEqual(values1: string[], values2: string[]): boolean {
    return values1.sort().join(",") === values2.sort().join(",");
}

function addTenantIdScope(scopes: string[], tenantId: string): string[] {
    const scopeSet = new Set<string>(scopes);
    scopeSet.add(`VSCODE_TENANT:${tenantId}`);
    return Array.from(scopeSet);
}
