export declare class ElasticCurveGrowStep2DError extends Error {
    code: any;
    constructor(code: any);
}
export declare function elasticCurveGrowStep2D(input: any): {
    state: {
        nodes: any;
        curves: {
            id: any;
            closed: any;
            nodeIds: any[];
            edgeIds: any[];
            restLengths: any[];
            restTurns: any[];
        }[];
        nextNodeId: any;
        nextEdgeId: any;
    };
    events: any[];
    acceptedMotionScale: any;
};
