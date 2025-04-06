import { WebSocketServer, WebSocket } from 'ws';
import ElevatorSystem from '../modules/elevatorSystem';

export default function initWebSocketServer(port: number, elevatorSystem: ElevatorSystem) {
    const wss = new WebSocketServer({ port });

    wss.on('connection', (ws) => {
        const sendFullState = () => {
            ws.send(JSON.stringify({
                ...elevatorSystem.getSystemStatus(),
                requests: elevatorSystem.requests
            }));
        };

        ws.on('message', (data) => {
            const message = JSON.parse(data.toString());

            switch (message.type) {
                case 'config':
                    elevatorSystem = new ElevatorSystem(
                        message.floors,
                        message.elevators,
                        message.frequency
                    );
                    break;
                case 'external':
                    if (message.passengers) {
                        elevatorSystem.addExternalRequest(message.floor, message.direction, message.passengers);
                    }
                    break;
                case 'internal':
                    if (message.passengersOut) {
                        elevatorSystem.addInternalRequest(message.floor, message.passengersOut);
                    }
                    break;
                case 'toggle-auto':
                    elevatorSystem.toggleAutoGeneration();
                    break;
                case 'set-peak':
                    elevatorSystem.setPeakScenario(message.config);
                    break;
                case 'reset':
                    elevatorSystem.initializeSystem();
                    break;
            }
            sendFullState();
        });

        const interval = setInterval(() => {
            elevatorSystem.updateElevators();
            sendFullState();
        }, 1000);

        ws.on('close', () => clearInterval(interval));
    });

    console.log(`WebSocket server running on ws://localhost:${port}`);
}
