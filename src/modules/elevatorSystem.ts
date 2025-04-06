import { v4 as uuidv4 } from 'uuid';
import { Elevator, Floor, Metrics, Request } from '../types';

class ElevatorSystem {
    public elevators: Elevator[] = [];
    public floors: Floor[] = [];
    public requests: Request[] = [];
    public metrics: Metrics = {
        waitTimes: [],
        travelTimes: [],
        elevatorUtilization: [],
        peakMode: false
    };

    private requestInterval?: NodeJS.Timeout;
    private isAutoGenerating = true;
    private peakConfig = {
        active: false,
        lobbyFloor: 0,
        requestPercentage: 0.7,
        direction: 'up' as 'up' | 'down'
    };

    constructor(
        public totalFloors: number = 10,
        public elevatorCount: number = 4,
        public requestFrequency: number = 0.3
    ) {
        this.initializeSystem();
        this.startRequestGeneration();
    }

    public initializeSystem() {
        this.elevators = Array.from({ length: this.elevatorCount }, (_, i) => ({
            id: i,
            currentFloor: 0,
            destinations: [],
            direction: 'idle',
            doorState: 'closed',
            passengers: 0,
            capacity: 8,
            internalRequests: {}
        }));

        this.floors = Array.from({ length: this.totalFloors }, () => ({
            upQueue: 0,
            downQueue: 0
        }));

        this.requests = [];
        this.metrics = {
            waitTimes: [],
            travelTimes: [],
            elevatorUtilization: [],
            peakMode: false
        };
    }

    private startRequestGeneration() {
        if (this.requestInterval) clearInterval(this.requestInterval);
        if (!this.isAutoGenerating) return;

        let cycleCount = 0; // Add a counter

        this.requestInterval = setInterval(() => {
            if (cycleCount >= 100) {
                clearInterval(this.requestInterval);
                this.requestInterval = null;
                this.isAutoGenerating = false; // Stop auto generation after 100 cycles
                return;
            }

            if (Math.random() < this.requestFrequency) {
                const { floor, direction, passengers } = this.generateAutoRequest();
                const destination = this.generateDestination(floor, direction);

                this.addExternalRequest(floor, direction, passengers);
                this.addInternalRequest(destination, passengers);
            }

            cycleCount++; // Increment the counter
        }, 1000);
    }

    private generateAutoRequest() {
        let floor, direction, passengers;

        if (this.peakConfig.active && Math.random() < this.peakConfig.requestPercentage) {
            floor = this.peakConfig.lobbyFloor;
            direction = this.peakConfig.direction;
            passengers = Math.min(5, Math.max(2, Math.floor(Math.random() * 4) + 2));
        } else {
            floor = Math.floor(Math.random() * this.totalFloors);
            direction = floor === 0 ? 'up' :
                floor === this.totalFloors - 1 ? 'down' :
                    Math.random() > 0.5 ? 'up' : 'down';
            passengers = Math.floor(Math.random() * 3) + 1;
        }

        return { floor, direction, passengers };
    }

    private generateDestination(origin: number, direction: 'up' | 'down'): number {
        if (this.peakConfig.active) {
            return direction === 'up' ? this.totalFloors - 1 : 0;
        }

        let destination = origin;
        while (destination === origin) {
            const max = direction === 'up' ? this.totalFloors - 1 : origin;
            const min = direction === 'down' ? 0 : origin;
            destination = Math.floor(Math.random() * (max - min + 1)) + min;
        }
        return destination;
    }

    public addExternalRequest(floor: number, direction: 'up' | 'down', passengers: number) {
        if (direction === 'up') {
            this.floors[floor].upQueue += passengers;
        } else {
            this.floors[floor].downQueue += passengers;
        }

        const request: Request = {
            id: uuidv4(),
            type: 'external',
            floor,
            direction,
            passengers,
            timestamp: Date.now(),
            status: 'waiting'
        };
        this.requests.push(request);
        this.assignRequest(request);
    }

    public addInternalRequest(floor: number, passengers: number) {
        const request: Request = {
            id: uuidv4(),
            type: 'internal',
            floor,
            timestamp: Date.now(),
            status: 'waiting'
        };
        this.requests.push(request);
        this.assignRequest(request);
    }

    private assignRequest(request: Request) {
        const bestElevator = this.findBestElevator(request);
        if (bestElevator) {
            bestElevator.destinations.push(request.floor);
            if (request.type === 'internal') {
                bestElevator.internalRequests[request.floor] =
                    (bestElevator.internalRequests[request.floor] || 0) +
                    (request.passengers || 1);
            }
            this.processElevatorPath(bestElevator);
            request.status = 'processing';
            request.elevatorId = bestElevator.id;
        }
    }

    private findBestElevator(request: Request): Elevator | undefined {
        return this.elevators.reduce((best, elevator) => {
            const score = this.calculateScore(elevator, request);
            return !best || score < best.score ? { elevator, score } : best;
        }, undefined as { elevator: Elevator; score: number } | undefined)?.elevator;
    }

    private calculateScore(elevator: Elevator, request: Request): number {
        const currentPath = [...elevator.destinations];
        const currentFloor = elevator.currentFloor;

        // Calculate distance score
        let distance = Math.abs(currentFloor - request.floor);
        if (elevator.direction === 'up' && request.floor > currentFloor) {
            distance = request.floor - currentFloor;
        }
        if (elevator.direction === 'down' && request.floor < currentFloor) {
            distance = currentFloor - request.floor;
        }

        // Direction compatibility
        let directionScore = 0;
        if (elevator.direction === 'idle') directionScore = 0;
        else if (elevator.direction === request.direction) directionScore = -50;
        else directionScore = 1000;

        // Capacity factor
        const capacityScore = (elevator.passengers / elevator.capacity) * 100;

        return distance + directionScore + capacityScore;
    }

    private processElevatorPath(elevator: Elevator) {
        const allDestinations = Array.from(new Set([
            ...elevator.destinations,
            ...Object.keys(elevator.internalRequests).map(Number)
        ])).sort((a, b) =>
            elevator.direction === 'up' ? a - b : b - a
        );

        if (this.peakConfig.active && allDestinations.length === 0) {
            allDestinations.push(this.peakConfig.lobbyFloor);
        }

        elevator.destinations = allDestinations;
        elevator.direction = allDestinations.length > 0 ?
            (allDestinations[0] > elevator.currentFloor ? 'up' : 'down') : 'idle';
    }

    public updateElevators() {
        this.elevators.forEach(elevator => {
            if (elevator.doorState === 'open') return;

            if (elevator.destinations.length > 0) {
                const nextFloor = elevator.destinations[0];
                if (elevator.currentFloor === nextFloor) {
                    this.handleArrival(elevator);
                } else {
                    elevator.currentFloor += elevator.direction === 'up' ? 1 : -1;
                }
            }
        });
    }

    private handleArrival(elevator: Elevator) {
        const currentFloor = elevator.currentFloor;

        // Handle passengers exiting
        const exiting = elevator.internalRequests[currentFloor] || 0;
        elevator.passengers = Math.max(0, elevator.passengers - exiting);
        delete elevator.internalRequests[currentFloor];

        // Handle passengers entering
        const queue = this.getProperQueue(elevator, currentFloor);
        const availableSpace = elevator.capacity - elevator.passengers;
        const entering = Math.min(queue, availableSpace);

        elevator.passengers += entering;
        this.updateQueue(elevator, currentFloor, entering);

        // Update destinations and door state
        elevator.destinations = elevator.destinations.filter(f => f !== currentFloor);
        elevator.doorState = 'open';

        // Update metrics
        const completedRequest = this.requests.find(r =>
            r.status === 'processing' && r.elevatorId === elevator.id && r.floor === currentFloor
        );

        if (completedRequest) {
            const waitTime = Date.now() - completedRequest.timestamp;
            const travelTime = Date.now() - (completedRequest.timestamp + waitTime);

            this.metrics.waitTimes.push(waitTime);
            this.metrics.travelTimes.push(travelTime);
            this.metrics.elevatorUtilization.push(elevator.passengers / elevator.capacity);

            [this.metrics.waitTimes, this.metrics.travelTimes, this.metrics.elevatorUtilization].forEach(arr => {
                if (arr.length > 100) arr.shift();
            });

            completedRequest.status = 'completed';
        }

        setTimeout(() => {
            elevator.doorState = 'closed';
            this.processElevatorPath(elevator);
        }, 3000);
    }

    private getProperQueue(elevator: Elevator, currentFloor: number): number {
        if (elevator.direction === 'down') return this.floors[currentFloor].downQueue;
        if (elevator.direction === 'up') return this.floors[currentFloor].upQueue;
        return Math.max(
            this.floors[currentFloor].upQueue,
            this.floors[currentFloor].downQueue
        );
    }

    private updateQueue(elevator: Elevator, currentFloor: number, entering: number) {
        if (elevator.direction === 'down') {
            this.floors[currentFloor].downQueue = Math.max(0, this.floors[currentFloor].downQueue - entering);
        } else if (elevator.direction === 'up') {
            this.floors[currentFloor].upQueue = Math.max(0, this.floors[currentFloor].upQueue - entering);
        } else {
            if (this.floors[currentFloor].downQueue > 0) {
                this.floors[currentFloor].downQueue = Math.max(0, this.floors[currentFloor].downQueue - entering);
            } else {
                this.floors[currentFloor].upQueue = Math.max(0, this.floors[currentFloor].upQueue - entering);
            }
        }
    }

    public toggleAutoGeneration() {
        this.isAutoGenerating = !this.isAutoGenerating;
        if (this.isAutoGenerating) {
            this.startRequestGeneration();
        } else {
            if (this.requestInterval) clearInterval(this.requestInterval);
        }
    }

    public setPeakScenario(config: Partial<typeof this.peakConfig>) {
        this.peakConfig = {
            ...this.peakConfig,
            ...config,
            active: config.active !== undefined ? config.active : true
        };
        this.metrics.peakMode = this.peakConfig.active;

        if (this.peakConfig.active) {
            this.elevators.forEach(elevator => {
                if (elevator.direction === 'idle' && !elevator.destinations.includes(this.peakConfig.lobbyFloor)) {
                    elevator.destinations.push(this.peakConfig.lobbyFloor);
                    this.processElevatorPath(elevator);
                }
            });
        }
    }

    public getSystemStatus() {
        return {
            elevators: this.elevators,
            floors: this.floors,
            metrics: this.metrics,
            isAutoGenerating: this.isAutoGenerating
        };
    }
}

export default ElevatorSystem;