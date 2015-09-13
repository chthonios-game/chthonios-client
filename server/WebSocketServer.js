var WebSocket = require('ws');

var Common = require("./common.js");
var Sockets = require("./serversocket.js");
var GameObjects = require("./gameobjects.js");

var Server = {

	serverSocket : null,
	players : [],

	boot : function() {
		console.log("Starting server...");
		this.serverSocket = new WebSocket.Server({
			port : 1357
		});

		this.serverSocket.on("connection", Common.decoratedCallback(function(csocket) {
			console.log(csocket._socket.remoteAddress, csocket._socket.remotePort, "handling connection");
			var client = new Sockets.ClientSocket(this, csocket);
			var player = new GameObjects.Player(this, client);
			player.init();
			this.players.push(player);
		}, this));
	},

	run : function() {
		for (var i = 0; i < this.players.length; i++) {
			var player = this.players[i];
			player.think();
			if (this.player.invalid()) {
				console.log(player, "player disconnected, collecting");
				players.splice(i, 1);
			}
		}
	}
}

Server.boot();
setInterval(Common.decoratedCallback(Server.run, Server), 100);

return;

wss.on('connection', function(ws) {
	console.log("connected");
	ws.on('message',
			function(message) {
				console.log("message recieved:" + message);
				var msg = JSON.parse(message);
				var otherData = '';
				if ("uuid" in msg) {
					if (!(msg.uuid in CLIENTS)) {
						CLIENTS[msg.uuid] = {
							x : 0,
							y : 0,
							input : {
								click : [],
								key : []
							}
						};
					}
					if ("click" in msg) {
						CLIENTS[msg.uuid]['input']['click'].push(msg.click);
					}
					if ("key" in msg) {
						CLIENTS[msg.uuid]['input']['key'].push(msg.key);
					}
					for ( var cl in CLIENTS[msg.uuid]['input']['click']) {
						var input = CLIENTS[msg.uuid]['input']['click'].pop();
						if (CLIENTS[msg.uuid].x < input.x - 1) {
							CLIENTS[msg.uuid].x++;
						} else if (CLIENTS[msg.uuid].x > input.x + 1) {
							CLIENTS[msg.uuid].x--;
						}
						if (CLIENTS[msg.uuid].y < input.y - 1) {
							CLIENTS[msg.uuid].y++;
						} else if (CLIENTS[msg.uuid].y > input.y + 1) {
							CLIENTS[msg.uuid].y--;
						}
					}
					for ( var cl in CLIENTS[msg.uuid]['input']['key']) {
						var input = CLIENTS[msg.uuid]['input']['key'].pop();
						switch (input) {
						case 'Up':
						case 'w':
							CLIENTS[msg.uuid].y -= 0.5;
							break;
						case 'Down':
						case 's':
							CLIENTS[msg.uuid].y += 0.5;
							break;
						case 'Left':
						case 'a':
							CLIENTS[msg.uuid].x -= 0.5;
							break;
						case 'Right':
						case 'd':
							CLIENTS[msg.uuid].x += 0.5;
						}
						if (CLIENTS[msg.uuid].x < 0) {
							CLIENTS[msg.uuid].x = 0;
						}
						if (CLIENTS[msg.uuid].y < 0) {
							CLIENTS[msg.uuid].y = 0;
						}
					}

					for ( var otherUUID in CLIENTS) {
						if (otherUUID !== msg.uuid) {
							otherData += '"' + otherUUID.substring(0, 8) + '":{"x":' + CLIENTS[otherUUID].x + ',"y":'
									+ CLIENTS[otherUUID].y + '},';
						}
					}
				}
				var JSONData = '{"x":' + CLIENTS[msg.uuid].x + ',"y":' + CLIENTS[msg.uuid].y;
				if (otherData.length !== 0) {
					if (otherData.slice(-1) === ',') {
						otherData = otherData.slice(0, -1);
					}
					JSONData += ',"other":{' + otherData + '}';
				}
				JSONData += '}';
				console.log("message sent: " + JSONData);
				ws.send(JSONData);
			});

});
