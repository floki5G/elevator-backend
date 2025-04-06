export interface Floor {
    upQueue: number;
    downQueue: number;
}

export interface Elevator {
    id: number;
    currentFloor: number;
    destinations: number[];
    direction: 'up' | 'down' | 'idle';
    doorState: 'open' | 'closed';
    passengers: number;
    capacity: number;
    internalRequests: { [floor: number]: number };
}

export interface Request {
    id: string;
    type: 'external' | 'internal';
    floor: number;
    direction?: 'up' | 'down';
    elevatorId?: number;
    passengers?: number;
    timestamp: number;
    status: 'waiting' | 'processing' | 'completed';
}

export interface Metrics {
    waitTimes: number[];
    travelTimes: number[];
    elevatorUtilization: number[];
    peakMode: boolean;
}
