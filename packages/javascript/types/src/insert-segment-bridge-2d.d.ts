export declare class InsertSegmentBridge2DError extends Error {
    code: any;
    constructor(code: any);
}
export declare function insertSegmentBridge2D(input: any): {
    graph: {
        nodes: any;
        edges: any;
        nextNodeId: any;
        nextEdgeId: any;
    };
    events: never[];
    inserted: boolean;
    reason: string;
} | {
    graph: {
        nodes: any;
        edges: any;
        nextNodeId: any;
        nextEdgeId: any;
    };
    events: ({
        type: string;
        parentEdgeId: any;
        nodeId: any;
        childEdgeIds: number[];
        parentT: any;
        edgeId?: undefined;
        nodeIds?: undefined;
    } | {
        parentEdgeId?: undefined;
        nodeId?: undefined;
        childEdgeIds?: undefined;
        parentT?: undefined;
        type: string;
        edgeId: number;
        nodeIds: any[];
    })[];
    inserted: boolean;
    reason: null;
};
