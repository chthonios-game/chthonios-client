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
		console.log(this.toString(), "opening player connection");
		this._socket.init();
		this._socket.bind("packet", Common.decoratedCallback(function(packet) {
			if (packet.payloads != undefined && packet.payloads != null) {
				var payloads = packet.payloads;
				if (payloads.length != 0)
					for (var i = 0; i < payloads.length; i++)
						this._packets.push(payloads[i]);
			}
		}, this));
	}

	/**
	 * Called to update the player.
	 */
	this.think = function() {
		if (this._packets.length != 0) {
			try {
				var packets = this._packets;
				this._packets = [];
				for (var i = 0; i < packets.length; i++)
					this.thinkPacket(packets[i]);
			} catch (e) {
				console.error(this.toString(), "error handling packet", e);
				this._socket.close(1002, {
					msg : "Error when handling packet: " + e.name + ": " + e.message
				});
			}
		}
	}

	this.thinkPacket = function(packet) {
		if (packet.type == undefined || packet.type == null)
			throw new Error("Illegal packet format.");
		switch (packet.type) {
		case "move":

			break;
		default:
			throw new Error("Unsupported packet type " + packet.type);
		}
	}

	this.sendDataToPlayer = function() {
		this._socket.send(data);
	}

	this.invalid = function() {
		/*
		 * TODO: We need to decide when to give up waiting for the player to
		 * (re-)connect; at which stage we "tombstone" the owned player entities
		 * into something else (some sort of ghost-player-entity type), until
		 * the game finally decides to collect (remove) the ghosted entities.
		 */
		return false;
	}
}

module.exports = {
	Player : Player
}