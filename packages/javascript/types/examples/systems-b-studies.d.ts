export declare const systemsBSettings: {
    "ripple-interference": {
        defaults: {
            passes: number;
            scale: number;
            weight: number;
        };
        structuralEdit: {
            passes: number;
        };
    };
    "pinned-waves": {
        defaults: {
            passes: number;
            scale: number;
            weight: number;
        };
        structuralEdit: {
            scale: number;
        };
    };
    "branching-sentences": {
        defaults: {
            iterations: number;
            step: number;
            angle: number;
        };
        structuralEdit: {
            iterations: number;
        };
    };
    "woven-grammar": {
        defaults: {
            iterations: number;
            step: number;
            angle: number;
        };
        structuralEdit: {
            angle: number;
        };
    };
    "turtle-canopies": {
        defaults: {
            depth: number;
            step: number;
            angle: number;
        };
        structuralEdit: {
            depth: number;
        };
    };
    "recursive-tiles": {
        defaults: {
            depth: number;
            step: number;
            angle: number;
        };
        structuralEdit: {
            depth: number;
        };
    };
    "compatible-mosaics": {
        defaults: {
            columns: number;
            rows: number;
            size: number;
        };
        structuralEdit: {
            columns: number;
        };
    };
    "tiled-circuits": {
        defaults: {
            columns: number;
            rows: number;
            size: number;
        };
        structuralEdit: {
            rows: number;
        };
    };
    "maze-gardens": {
        defaults: {
            columns: number;
            rows: number;
            weight: number;
        };
        structuralEdit: {
            columns: number;
        };
    };
    "branching-networks": {
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
export declare function drawRippleInterference(p: any, l: any): void;
export declare function drawPinnedWaves(p: any, l: any): void;
export declare function drawBranchingSentences(p: any, l: any): void;
export declare function drawWovenGrammar(p: any, l: any): void;
export declare function drawTurtleCanopies(p: any, l: any): void;
export declare function drawRecursiveTiles(p: any, l: any): void;
export declare function drawCompatibleMosaics(p: any, l: any): void;
export declare function drawTiledCircuits(p: any, l: any): void;
export declare function drawMazeGardens(p: any, l: any): void;
export declare function drawBranchingNetworks(p: any, l: any): void;
