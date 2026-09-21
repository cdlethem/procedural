export declare class SensorMotorStep2DError extends Error {
    code: any;
    constructor(code: any);
}
/** Synchronously sample an explicit scalar grid with paired old-state probes. */
export declare function sensorMotorStep2D(inputValue: any): {
    agents: any[];
    probes: any[];
    samples: any[];
};
