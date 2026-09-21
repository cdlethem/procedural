import { ExactRational } from "./exact-rational.js";
export declare const MAX_SAFE: number;
export declare function fail(ErrorType: any, code: any): void;
export declare function zero(n: any): any;
export declare function finite(n: any, ErrorType: any): any;
export declare function integer(n: any, ErrorType: any): any;
export declare function plainRecord(value: any, keys: any, ErrorType: any): any;
export declare function denseArray(value: any, ErrorType: any): any;
export declare function pointArray(value: any, ErrorType: any): any[];
export declare function exactPoint(p: any): {
    x: ExactRational;
    y: ExactRational;
};
export declare function sub(a: any, b: any): {
    x: any;
    y: any;
};
export declare function add(a: any, b: any): {
    x: any;
    y: any;
};
export declare function scale(a: any, t: any): {
    x: any;
    y: any;
};
export declare function cross(a: any, b: any): any;
export declare function dot(a: any, b: any): any;
export declare function same(a: any, b: any): any;
export declare function at(a: any, d: any, t: any): {
    x: any;
    y: any;
};
export declare function inUnit(t: any): boolean;
export declare function witness(kind?: string, aRing?: number, aEdge?: number, bRing?: number, bEdge?: number, vertex?: number): {
    kind: string;
    aRing: number;
    aEdge: number;
    bRing: number;
    bEdge: number;
    vertex: number;
};
export declare function onSegment(a: any, b: any, p: any): any;
export declare function segmentContact(a: any, b: any, c: any, d: any): {
    crossing: boolean;
    t: any;
    u: any;
} | null;
export declare function locationInRing(ring: any, p: any): -1 | 0 | 1;
export declare function captureRegion(value: any, ErrorType: any): {
    outer: any;
    holes: any;
    rings: any[];
    edges: any;
};
export declare function firstRegionIssue(region: any): {
    edge: number;
    vertex: number;
    ring: number;
} | null;
export declare function validateRegion(region: any, ErrorType: any): any;
export declare function inputRegion(value: any, ErrorType: any): any;
export declare function filledLocation(region: any, p: any): -1 | 1;
export declare function validationWork(region: any): bigint;
export declare function regionWork(a: any, b: any): bigint;
export declare function compareRegionsDetailed(a: any, b: any): {
    relation: string;
    minimumDistance: null;
    witness: {
        kind: string;
        aRing: number;
        aEdge: number;
        bRing: number;
        bEdge: number;
        vertex: number;
    };
    squared?: undefined;
} | {
    relation: string;
    minimumDistance: any;
    witness: {
        kind: string;
        aRing: number;
        aEdge: number;
        bRing: number;
        bEdge: number;
        vertex: number;
    };
    squared: any;
};
export declare function compareRegions(a: any, b: any): {
    relation: string;
    minimumDistance: any;
    witness: {
        kind: string;
        aRing: number;
        aEdge: number;
        bRing: number;
        bEdge: number;
        vertex: number;
    };
};
export declare function asNumberPoint(p: any): any[];
export declare function normalizeRing(points: any): any;
export declare function normalizeHole(points: any): any;
export declare function ringValidPoints(points: any): boolean;
export declare function ringIssuePoints(points: any): {
    edge: number;
    vertex: number;
} | null;
