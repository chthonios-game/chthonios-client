var Common = require("./common.js");

function Player(server, socket) {
	/** The underlying server */
	this._server = server;
	/** The incoming data socket */
	this._socket = socket;
	/** The incoming packet memory connection */
	this._packets = [];

	this.toString = function() {
		return "Player { }";
	}

	/**
	 * Initialize the player. Spins up the socket and binds our network memory
	 * connection to the socket, so packets are fed to the main loop.
	 */
	this.init = function() {
		console.log(this, "opening player connection");
		this._socket.init();
		this._socket.bind("packet", Common.decoratedCallback(function(packet) {
			this._packets.push(packet);
		}, this));
	}

	/**
	 * Called to update the player.
	 */
	this.think = function() {
		if (this._packets.length != 0) {
			try {
				for (var i = 0; i < this._packets.length; i++) {
					var packet = this._packets[i];
					this.thinkPacket(packet);
				}
				this._packets = [];
			} catch (e) {
				console.error(this, "error handling packet", e);
				this._socket.close(1, {
					msg : "Error when handling packet: " + e.name + ": " + e.message
				});
			}
		}
	}

	this.thinkPacket = function(packet) {
		switch (packet.type) {
		case "move":

			break;
		default:
			throw new Error("Unsupported packet type" + ((packet.type == null || packet.type == undefined) ? "<voidable>" : packet.type));
		}
	}

	this.sendDataToPlayer = function() {
		this._socket.send(data);
	}

	this.invalid = function() {
		return this._socket._socket.readyState == WebSocket.CLOSED;
	}
}

module.exports = {
	Player : Player
}