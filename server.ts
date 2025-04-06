import express from 'express';
import ElevatorSystem from './src/modules/elevatorSystem';
import initWebSocketServer from './src/websocket/socketServer';




const app = express();
const port = 3001;
initWebSocketServer(port, new ElevatorSystem(10, 3, 1));


app.listen(port, () => console.log(`Backend running on http://localhost:${port}`));