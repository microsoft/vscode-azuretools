/**
 * An abstract interface for GenericResource
 */
export interface AppResource {
    readonly id: string;
    readonly name: string;
    readonly type: string;
    readonly kind?: string;
    readonly location?: string;
    /** Resource tags */
    readonly tags?: {
        [propertyName: string]: string;
    };
    /* add more properties from GenericResource if needed */
}
