export declare class SystemsAError extends Error {
    code: any;
    constructor(code: any);
}
export declare const fail: (code: any) => never;
export declare function finite(value: any): boolean;
export declare function number(value: any): any;
export declare function computed(value: any): any;
export declare function record(value: any, keys: any): void;
export declare function get(value: any, key: any): any;
export declare function array(value: any, length: any): void;
export declare function integer(value: any, lo: any, hi: any): any;
export declare function work(value: any): any;
export declare function product(a: any, b: any, code?: string): number;
export declare function charge(value: any, max: any): void;
export declare function scalarArray(value: any, length: any): any[];
export declare function pair(value: any, positive?: boolean): any[];
