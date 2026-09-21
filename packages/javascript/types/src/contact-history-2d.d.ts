export declare class ContactHistory2DError extends Error {
    code: any;
    constructor(code: any);
}
/** Advance sorted caller-ID contact history. Implements spatial.contact-history-2d 0.1.0. */
export declare function contactHistory2D(input: any): {
    contacts: {
        ids: any[];
        activeTicks: any;
        missingTicks: any;
    }[];
};
