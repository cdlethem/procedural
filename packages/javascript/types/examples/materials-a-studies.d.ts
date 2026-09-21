export declare const materialsASettings: {
    "diffusion-engraving": {
        defaults: {
            scale: number;
            threshold: number;
        };
        structuralEdit: {
            scale: number;
        };
    };
    "dithered-ribbons": {
        defaults: {
            scale: number;
            threshold: number;
        };
        structuralEdit: {
            threshold: number;
        };
    };
    "ordered-halftone": {
        defaults: {
            scale: number;
            order: number;
        };
        structuralEdit: {
            order: number;
        };
    };
    "bayer-weave": {
        defaults: {
            scale: number;
            order: number;
        };
        structuralEdit: {
            scale: number;
        };
    };
    "embossed-field": {
        defaults: {
            scale: number;
            gain: number;
            source: string;
            axis: string;
            treatment: string;
        };
        structuralEdit: {
            source: string;
            axis: string;
            treatment: string;
            gain: number;
        };
    };
    "signed-edge-print": {
        defaults: {
            scale: number;
            cutoff: number;
            source: string;
            axis: string;
            treatment: string;
        };
        structuralEdit: {
            source: string;
            axis: string;
            treatment: string;
            cutoff: number;
        };
    };
    "distance-halos": {
        defaults: {
            scale: number;
            radius: number;
            weight: number;
        };
        structuralEdit: {
            radius: number;
        };
    };
    "nearest-feature-mosaic": {
        defaults: {
            scale: number;
            features: number;
            display: string;
            boundaryWidth: number;
            showSites: boolean;
            siteSize: number;
        };
        structuralEdit: {
            display: string;
            showSites: boolean;
        };
    };
    "eroded-lace": {
        defaults: {
            scale: number;
            passes: number;
        };
        structuralEdit: {
            passes: number;
        };
    };
    "dilated-stamps": {
        defaults: {
            scale: number;
            passes: number;
        };
        structuralEdit: {
            passes: number;
        };
    };
    "perceptual-bands": {
        defaults: {
            bands: number;
            phase: number;
            bandCoverage: number;
        };
        structuralEdit: {
            bands: number;
            bandCoverage: number;
        };
    };
    "oklab-orbits": {
        defaults: {
            orbits: number;
            phase: number;
            weight: number;
        };
        structuralEdit: {
            orbits: number;
        };
    };
    "reduced-mosaic": {
        defaults: {
            scale: number;
            count: number;
            fieldMask: string;
            maskThreshold: number;
        };
        structuralEdit: {
            fieldMask: string;
        };
    };
    "quantized-stripes": {
        defaults: {
            stripes: number;
            count: number;
            bandCoverage: number;
        };
        structuralEdit: {
            stripes: number;
            bandCoverage: number;
        };
    };
};
export declare function drawDiffusionEngraving(p: any, l: any): void;
export declare function drawDitheredRibbons(p: any, l: any): void;
export declare function drawOrderedHalftone(p: any, l: any): void;
export declare function drawBayerWeave(p: any, l: any): void;
export declare function drawEmbossedField(p: any, l: any): void;
export declare function drawSignedEdgePrint(p: any, l: any): void;
export declare function drawDistanceHalos(p: any, l: any): void;
export declare function drawNearestFeatureMosaic(p: any, l: any): void;
export declare function drawErodedLace(p: any, l: any): void;
export declare function drawDilatedStamps(p: any, l: any): void;
export declare function drawPerceptualBands(p: any, l: any): void;
export declare function drawOklabOrbits(p: any, l: any): void;
export declare function drawReducedMosaic(p: any, l: any): void;
export declare function drawQuantizedStripes(p: any, l: any): void;
