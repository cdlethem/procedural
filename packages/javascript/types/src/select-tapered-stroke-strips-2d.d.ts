export declare class SelectTaperedStrokeStrips2DError extends Error {
    code: any;
    constructor(code: any);
}
/** Ordered, conservative selection of valid strips against strict exclusions and peers. */
export declare function selectTaperedStrokeStrips2D(configuration: any): {
    accepted: {
        id: any;
        visible: any;
        centerline: any;
        resolvedJoins: any;
        witness: {
            kind: string;
            aRing: number;
            aEdge: number;
            bRing: number;
            bEdge: number;
            vertex: number;
            againstKind: string;
            againstIndex: number;
        };
    }[];
    rejected: {
        reason: string;
        witness: any;
        id: any;
    }[];
};
