export declare const materialsBSettings: {
    "extruded-seals": {
        defaults: {
            pitch: number;
            faceMode: string;
            weight: number;
            legacy: boolean;
            footprint: string;
            footprintWidth: number;
            footprintDepth: number;
            inset: number;
            stepDepth: number;
            shoulder: number;
            height: number;
            rotation: number;
            zoom: number;
        };
        structuralEdit: {
            footprint: string;
            stepDepth: number;
            height: number;
        };
    };
    "stepped-blocks": {
        defaults: {
            pitch: number;
            faceMode: string;
            weight: number;
            legacy: boolean;
            footprint: string;
            footprintWidth: number;
            footprintDepth: number;
            inset: number;
            stepDepth: number;
            shoulder: number;
            height: number;
            rotation: number;
            zoom: number;
        };
        structuralEdit: {
            footprint: string;
            inset: number;
            height: number;
        };
    };
    "transported-ribbons": {
        defaults: {
            pitch: number;
            faceMode: string;
            legacy: boolean;
            segments: number;
            width: number;
            endWidth: number;
            widthPulse: number;
            verticalAmplitude: number;
            verticalCycles: number;
            depthAmplitude: number;
            depthCycles: number;
            rotation: number;
            zoom: number;
            weight: number;
        };
        structuralEdit: {
            verticalCycles: number;
            endWidth: number;
            segments: number;
        };
    };
    "twisting-streamers": {
        defaults: {
            pitch: number;
            faceMode: string;
            legacy: boolean;
            segments: number;
            width: number;
            endWidth: number;
            widthPulse: number;
            verticalAmplitude: number;
            verticalCycles: number;
            depthAmplitude: number;
            depthCycles: number;
            rotation: number;
            zoom: number;
            weight: number;
        };
        structuralEdit: {
            verticalCycles: number;
            endWidth: number;
            widthPulse: number;
        };
    };
    "rounded-polyhedra": {
        defaults: {
            pitch: number;
            faceMode: string;
            weight: number;
            legacy: boolean;
            levels: number;
            base: string;
            axisX: number;
            axisY: number;
            axisZ: number;
            cornerLift: number;
            rotation: number;
            zoom: number;
        };
        structuralEdit: {
            base: string;
            cornerLift: number;
            levels: number;
        };
    };
    "subdivided-shells": {
        defaults: {
            pitch: number;
            faceMode: string;
            weight: number;
            legacy: boolean;
            levels: number;
            base: string;
            axisX: number;
            axisY: number;
            axisZ: number;
            cornerLift: number;
            rotation: number;
            zoom: number;
        };
        structuralEdit: {
            base: string;
            axisY: number;
            levels: number;
        };
    };
};
export declare function drawExtrudedSeals(p: any, l: any): void;
export declare function drawSteppedBlocks(p: any, l: any): void;
export declare function drawTransportedRibbons(p: any, l: any): void;
export declare function drawTwistingStreamers(p: any, l: any): void;
export declare function drawRoundedPolyhedra(p: any, l: any): void;
export declare function drawSubdividedShells(p: any, l: any): void;
