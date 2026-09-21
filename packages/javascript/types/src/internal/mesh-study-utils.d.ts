export declare class MeshError extends Error {
    code: any;
    constructor(code: any);
}
export declare const fail: (c: any) => never;
export declare const fin: (v: any) => boolean;
export declare const num: (v: any) => any;
export declare const calc: (v: any) => any;
export declare function rec(v: any, ks: any): void;
export declare const get: (v: any, k: any) => any;
export declare function arr(v: any, n: any): void;
export declare const integer: (v: any, a: any, b: any) => any;
export declare const work: (v: any) => any;
export declare const charge: (v: any, max: any) => void;
export declare function points(v: any, n: any, d: any): any;
