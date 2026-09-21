export declare class GeometryAError extends Error {
    code: any;
    constructor(code: any);
}
export declare function fail(code: any): void;
export declare function finite(value: any): boolean;
export declare function inputNumber(value: any): any;
export declare function computed(value: any): any;
export declare function passiveRecord(value: any, keys: any): void;
export declare function valueAt(value: any, key: any): any;
export declare function passiveArray(value: any, length?: undefined): void;
export declare function readPoints(value: any, minimum: any): any[];
export declare function safeWork(value: any): any;
export declare function checkedProduct(a: any, b: any): number;
export declare function checkedSum(a: any, b: any): any;
export declare function point(x: any, y: any): any[];
export declare function cross(a: any, b: any, c: any): any;
