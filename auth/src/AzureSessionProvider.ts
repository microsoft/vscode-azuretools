import { TenantIdDescription } from "@azure/arm-resources-subscriptions";
import { AuthenticationSession, Event } from "vscode";

export type SignInStatus = "Initializing" | "SigningIn" | "SignedIn" | "SignedOut";

export type AzureAuthenticationSession = AuthenticationSession & {
    tenantId: string;
};

export type DefinedTenant = TenantIdDescription & Required<Pick<TenantIdDescription, "tenantId" | "displayName">>;

export enum GetSessionBehavior {
    Silent,
    PromptIfRequired,
}

export type AzureSessionProvider = {
    signIn(): Promise<void>;
    signInStatus: SignInStatus;
    tenants: DefinedTenant[];
    isSignedInToTenant(tenantId: string): boolean;
    signInStatusChangeEvent: Event<SignInStatus>;
    getAuthSession(tenantId: string, behavior: GetSessionBehavior, scopes?: string[]): Promise<AzureAuthenticationSession | undefined>;
    dispose(): void;
};
