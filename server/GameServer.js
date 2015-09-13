var WebSocket = require('ws');

var Common = require("./common.js");
var Sockets = require("./serversocket.js");
var World = require("./worlds.js");
var MapServer = require("./mapserver.js");
var GameObjects = World.GameObjects;

var Server = {

	serverSocket : null,
	mapServer : null,
	world : null,

	boot : function() {
		console.log("Starting server...");
		this.world = new World.World();
		this.mapServer = new MapServer.MapService({
			port : 9001
		});
		this.mapServer.init();

		this.serverSocket = new WebSocket.Server({
			port : 1357
		});

		this.serverSocket.on("connection", Common.decoratedCallback(function(csocket) {
			console.log(csocket._socket.remoteAddress, csocket._socket.remotePort, "handling connection");
			var client = new Sockets.ClientSocket(this, csocket);
			var player = new GameObjects.Player(this, client);
			player.init();
			this.world.connectPlayerToWorld(player);
		}, this));
	},

	run : function() {
		this.world.update();
	}
}

Server.boot();
setInterval(Common.decoratedCallback(Server.run, Server), 100);
