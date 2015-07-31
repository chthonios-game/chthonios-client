
var WebSocket = require('ws');
var WebSocketServer = WebSocket.Server;
var wss = new WebSocketServer({port: 1357});
var CLIENTS = JSON.parse('{}');

wss.on('connection', function (ws) {
    ws.on('message', function (message) {
        //console.log('received: %s', message);
        var msg = JSON.parse(message);
        if ("uuid" in msg) {
            if (!(msg.uuid in CLIENTS)) {
                CLIENTS[msg.uuid] = {x: 0, y: 0, input: {click: [], key: []}};
            }
            if ("click" in msg) {
                CLIENTS[msg.uuid]['input']['click'].push(msg.click);
            }
            if ("key" in msg) {
                CLIENTS[msg.uuid]['input']['key'].push(msg.key);
            }
        }
        ws.send(message);
    });

});
