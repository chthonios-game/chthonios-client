var Common = require("./common.js");

function Player(server, socket) {
	/** The underlying server */
	this._server = server;
	/** The incoming data socket */
	this._socket = socket;
	/** The incoming packet memory connection */
	this._packets = [];

	this.toString = function() {
		return "Player { " + this._socket.toString() + " }";
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
	this.update = function() {
		if (this._packets.length != 0) {
			try {
				var packets = this._packets;
				this._packets = [];
				for (var i = 0; i < packets.length; i++)
					this.thinkPacket(packets[i]);
			} catch (e) {
				console.error(this.toString(), "error handling packet", e);
				this._socket.close(Common.Network.CODE_PROTO_ERROR, {
					msg : "Error when handling packet: " + e.name + ": " + e.message
				});
			}
		}
	}

	this.thinkPacket = function(packet) {
		if (packet.type == undefined || packet.type == null)
			throw new Error("Illegal packet format.");
		switch (packet.type) {
		case "command":

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
					otherData += '"' + otherUUID.substring(0, 8) + '":{"x":' + CLIENTS[otherUUID].x + ',"y":' + CLIENTS[otherUUID].y + '},';
				}
			}

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
};

var Entity = Common.Class.extend({
	init : function(type, x, y) {
		this.id = 0;
		this.x = x;
		this.y = y;
		this.type = type;
	},

	move : function(dx, dy) {
		this.x += dx;
		this.y += dy;
	},

	setPosition : function(x, y) {
		this.x = x;
		this.y = y;
	},

	getPacket : function() {
		return {
			id : this.id,
			x : this.x,
			y : this.y,
			type : this.type
		};
	},

	update : function() {
	}
});

var EntityLiving = Entity.extend({
	init : function(type, x, y, h) {
		this._super(type, x, y);
		this.health = h;
		this.maxHealth = h;
	},

	getPacket : function() {
		var packet = this._super();
		packet.health = this.health;
		packet.maxHealth = this.maxHealth;
		return packet;
	}
});

module.exports = {
	Player : Player,
	Entity : Entity,
	EntityLiving : EntityLiving
}