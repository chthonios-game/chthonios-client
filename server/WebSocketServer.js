
var WebSocket = require('ws');
var WebSocketServer = WebSocket.Server;
var wss = new WebSocketServer({port: 1357});

wss.on('connection', function (ws) {
    ws.on('message', function (message) {
        console.log('received: %s', message);
        ws.send(message);
    });

});
