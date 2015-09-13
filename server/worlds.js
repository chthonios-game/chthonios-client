var Common = require("./common.js");
var GameObjects = require("./gameobjects.js");

var World = Common.Class.extend({

	players : [],
	entities : [],

	init : function() {
	},

	connectPlayerToWorld : function(player) {
		Common.assert(player instanceof GameObjects.Player, "not a player");
		console.log(this.toString(), "adding player to world", player);
		this.players.push(player);
		this.sendWorldToPlayer(player);
	},

	removePlayerFromWorld : function(player) {
		Common.assert(player instanceof GameObjects.Player, "not a player");
		console.log(this.toString(), "removing player from world", player);
		var idx = -1;
		while ((idx = this.players.indexOf(player)) != -1)
			this.players.slice(idx, 1);
	},

	spawnEntityInWorld : function(entity) {
		Common.assert(entity instanceof GameObjects.Entity, "not an entity");
		var next = 0;
		while (true) {
			var dup = false;
			next = Math.floor(Math.random() * (Number.MAX_VALUE - 1));
			for (var i = 0; i < this.entities.length; i++) {
				var entity = this.entities[i];
				if (entity.id == next) {
					dup = true;
					break;
				}
			}
			if (!dup)
				break;
		}
		entity.id = next;
		this.entities.push(entity);
	},

	removeEntityFromWorld : function(entity) {
		Common.assert(entity instanceof GameObjects.Entity, "not an entity");
		var idx = -1;
		while ((idx = this.entities.indexOf(player)) != -1)
			this.entities.slice(idx, 1);
	},

	sendWorldToPlayer : function(player) {
		// TODO: Send world data to player
	},

	update : function() {
		for (var i = 0; i < this.players.length; i++) {
			var player = this.players[i];
			player.update(this);
			if (player.invalid()) {
				console.log(player, "player invalidated, collecting");
				this.removePlayerFromWorld(player);
			}
		}
		for (var i = 0; i < this.entities.length; i++) {
			var entity = this.entities[i];
			entity.update(this);
			if (entity.invalid()) {
				console.log(entity, "entity invalidated, collecting");
				this.removeEntityFromWorld(entity);
			}
		}
	}

});

module.exports = {
	GameObjects : GameObjects,
	World : World
}