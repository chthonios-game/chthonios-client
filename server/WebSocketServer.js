
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
            for (var cl in CLIENTS[msg.uuid]['input']['click']) {
                var input = CLIENTS[msg.uuid]['input']['click'].pop();
                if (CLIENTS[msg.uuid].x < input.x) {
                    CLIENTS[msg.uuid].x++;
                } else {
                    CLIENTS[msg.uuid].x--;
                }
                if (CLIENTS[msg.uuid].y < input.y) {
                    CLIENTS[msg.uuid].y++;
                } else {
                    CLIENTS[msg.uuid].y--;
                }
                console.log(JSON.stringify(CLIENTS[msg.uuid]));
            }
            for (var cl in CLIENTS[msg.uuid]['input']['key']) {
                var input = CLIENTS[msg.uuid]['input']['key'].pop();
                switch (input) {
                    case 'Up':
                    case 'w':
                        CLIENTS[msg.uuid].y--;
                        break;
                    case 'Down':
                    case 's':
                        CLIENTS[msg.uuid].y++;
                        break;
                    case 'Left':
                    case 'a':
                        CLIENTS[msg.uuid].x--;
                        break;
                    case 'Right':
                    case 'd':
                        CLIENTS[msg.uuid].x++;
                }
                if (CLIENTS[msg.uuid].x < 0) {
                    CLIENTS[msg.uuid].x = 0;
                }
                if (CLIENTS[msg.uuid].y < 0) {
                    CLIENTS[msg.uuid].y = 0;
                }
                console.log(JSON.stringify(CLIENTS[msg.uuid]));
            }
        }
        ws.send('{"x":' + CLIENTS[msg.uuid].x + ',y:' + CLIENTS[msg.uuid].y + '}');
    });

});

