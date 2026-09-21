export declare const pathsBSettings: {
    "stitched-contours": {
        defaults: {
            lines: number;
            weight: number;
            waves: number;
        };
        structuralEdit: {
            waves: number;
        };
    };
    "fragmented-lines": {
        defaults: {
            lines: number;
            weight: number;
            gaps: number;
        };
        structuralEdit: {
            gaps: number;
        };
    };
    "blue-noise-stipple": {
        defaults: {
            radius: number;
            size: number;
            attempts: number;
        };
        structuralEdit: {
            radius: number;
        };
    };
    "spaced-symbols": {
        defaults: {
            radius: number;
            size: number;
            attempts: number;
        };
        structuralEdit: {
            size: number;
        };
    };
    "relaxed-stones": {
        defaults: {
            sites: number;
            iterations: number;
            inset: number;
        };
        structuralEdit: {
            iterations: number;
        };
    };
    "centroid-trails": {
        defaults: {
            sites: number;
            iterations: number;
            weight: number;
        };
        structuralEdit: {
            iterations: number;
        };
    };
    "packed-posters": {
        defaults: {
            count: number;
            scale: number;
            outline: number;
        };
        structuralEdit: {
            count: number;
        };
    };
    "aspect-tiles": {
        defaults: {
            count: number;
            scale: number;
            outline: number;
        };
        structuralEdit: {
            scale: number;
        };
    };
    "obstacle-roads": {
        defaults: {
            columns: number;
            rows: number;
            weight: number;
        };
        structuralEdit: {
            columns: number;
        };
    };
    "arrival-contours": {
        defaults: {
            columns: number;
            rows: number;
            weight: number;
        };
        structuralEdit: {
            rows: number;
        };
    };
};
export declare function drawStitchedContours(p: any, l: any): void;
export declare function drawFragmentedLines(p: any, l: any): void;
export declare function drawBlueNoiseStipple(p: any, l: any): void;
export declare function drawSpacedSymbols(p: any, l: any): void;
export declare function drawRelaxedStones(p: any, l: any): void;
export declare function drawCentroidTrails(p: any, l: any): void;
export declare function drawPackedPosters(p: any, l: any): void;
export declare function drawAspectTiles(p: any, l: any): void;
export declare function drawObstacleRoads(p: any, l: any): void;
export declare function drawArrivalContours(p: any, l: any): void;
