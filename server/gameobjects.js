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
	this.init = function(world) {
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
	this.update = function(world) {
		if (this._packets.length != 0) {
			try {
				var packets = this._packets;
				this._packets = [];
				for (var i = 0; i < packets.length; i++)
					this.thinkPacket(world, packets[i]);
			} catch (e) {
				console.error(this.toString(), "error handling packet", e);
				this._socket.close(Common.Network.CODE_PROTO_ERROR, {
					msg : "Error when handling packet: " + e.name + ": " + e.message
				});
			}
		}
	}

	this.thinkPacket = function(world, packet) {
		if (packet.type == undefined || packet.type == null)
			throw new Error("Illegal packet format.");
		console.log(">>>", packet);
		switch (packet.type) {
		case "command":
			if (packet.key == "click") {
				var coords = packet.value;

			}

			if (packet.key == "key") {

			}
			break;
		default:
			throw new Error("Unsupported packet type " + packet.type);
		}
	}

	this.sendDataToPlayer = function(data) {
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

var EntityHelm = Common.Class.extend({
	init : function() {
	},
	update : function(entity) {
		/* do nothing */
	}
});

var AIEntityHelm = EntityHelm.extend({
	init : function() {
		this._super();
	},
	update : function() {
		/* TODO: AI things */
	}
});

var PlayerEntityHelm = EntityHelm.extend({
	commands : [],
	init : function() {
		this._super();
	},
	pushCommand : function(cmd) {
		this.commands.push(cmd);
	},
	update : function(entity) {
		if (this.commands.length != 0) {
			var cmds = this.commands;
			this.commands = [];
			for (var i = 0; i < cmds.length; i++) {
				var cmd = cmds[i];
				if (cmd.key = "click") {
					var varppos = entity.getPosition();
					if (varppos.x < cmd.value.x - 1)
						entity.move(0.5, 0);
					else if (varppos.x > cmd.value.x + 1)
						entity.move(-0.5, 0);

					if (varppos.y < cmd.value.y - 1)
						entity.move(0, 0.5);
					else if (varppos.y > cmd.value.y + 1)
						entity.move(0, -0.5);
				}

				if (cmd.key = "key") {
					var input = cmd.value;
					if (input == 'Up' || input == 'w')
						entity.move(0, -0.5);
					if (input == 'Down' || input == 's')
						entity.move(0, 0.5);
					if (input == 'Left' || input == 'a')
						entity.move(-0.5, 0);
					if (input == 'Right' || input == 'd')
						entity.move(0.5, 0);
				}
			}
		}
	}
});

var Entity = Common.Class.extend({
	init : function(type, x, y) {
		this.id = 0;
		this.x = x;
		this.y = y;
		this.type = type;
		this.helm = new EntityHelm();
	},

	move : function(dx, dy) {
		this.x += dx;
		this.y += dy;
	},

	setPosition : function(x, y) {
		this.x = x;
		this.y = y;
	},

	getPosition : function() {
		return {
			x : this.x,
			y : this.y
		};
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
		this.helm.update(this);
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