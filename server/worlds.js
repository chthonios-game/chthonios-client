var Common = require("./common.js");
var fs = require('fs');
var mkdirp = require('mkdirp');
var GameObjects = require("./gameobjects.js");
var Nodegraph = require("./math/nodegraph.js");

var World = Common.Class.extend({

	uid : null,
	players : [],
	entities : [],
	chunks : null,

	toString : function() {
		return "World { uid: " + this.uid + " }";
	},

	init : function(uid) {
		Common.assert(uid != null, "cannot generate world without uid");
		this.uid = uid;
	},

	generate : function(generator) {
		console.log(this.toString(), "requesting chunks");
		this.chunks = generator.paintChunks();
		console.log(this.toString(), "done requesting chunks");
		console.log(this.toString(), "rebuilding pathing for world");
		for (var x = 0; x < this.chunks.length; x++)
			for (var y = 0; y < this.chunks[x].length; y++)
				this.chunks[x][y].rebuildNodes();
		console.log(this.toString(), "done pathing for world");
		this.writeMapToDisk();
	},

	writeMapToDisk : function(callback) {
		console.log(this.toString(), "saving tileset data");
		ChunkDiskIO.writeAllChunks(this, Common.decoratedCallback(function() {
			console.log(this.toString(), "done saving tileset data");
			if (callback)
				callback();
		}, this));
	},

	connectPlayerToWorld : function(player) {
		Common.assert(player instanceof GameObjects.Player, "not a player");
		console.log(this.toString(), "adding player to world", player.toString());
		this.players.push(player);
		this.sendWorldToPlayer(player);
	},

	removePlayerFromWorld : function(player) {
		Common.assert(player instanceof GameObjects.Player, "not a player");
		console.log(this.toString(), "removing player from world", player.toString());
		var idx = -1;
		while ((idx = this.players.indexOf(player)) != -1)
			this.players.splice(idx, 1);
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
			this.entities.splice(idx, 1);
	},

	sendWorldToPlayer : function(player) {
		// TODO: Send world data to player
		console.log(player.toString(), "sending world data...");
		player.sendDataToPlayer([ {
			type : "world",
			uid : this.uid
		} ]);
		console.log(player.toString(), "done sending descriptors");
	},

	update : function() {
		for (var i = 0; i < this.players.length; i++) {
			var player = this.players[i];
			player.update(this);
			if (player.invalid()) {
				console.log(player.toString(), "player invalidated, collecting");
				this.removePlayerFromWorld(player);
			}
		}
		for (var i = 0; i < this.entities.length; i++) {
			var entity = this.entities[i];
			entity.update(this);
			if (entity.invalid()) {
				console.log(entity.toString(), "entity invalidated, collecting");
				this.removeEntityFromWorld(entity);
			}
		}
	}
});

var Chunk = Common.Class.extend({
	tiles : null,
	nodemap : null,
	width : 0,
	height : 0,
	init : function(width, height) {
		this.width = width;
		this.height = height;
		this.tiles = Common.brewArray(width, height, 4);
	},

	toString : function() {
		return "Chunk { width: " + this.width + ", height: " + this.height + " }";
	},

	rebuildNodes : function() {
		console.log(this.toString(), "rebuilding node map");
		this.nodemap = Nodegraph.Painter.paintMap(this);
		console.log(this.toString(), "rebuilt node map", this.nodemap.toString());
	},

	adjacent : function(x, y) {
		var adjacents = [];
		for (var x = -1; x <= 1; x++)
			for (var y = -1; y <= 1; y++)
				if ((x >= 0 && y >= 0) && (x < this.width && y < this.height))
					adjacents.push([ x, y ]);
		return adjacents;
	},

	getTile : function(x, y) {
		return this.tiles[x][y][0];
	},

	getSolid : function(x, y) {
		return this.tiles[x][y][1];
	},

	getPassable : function(x, y) {
		return this.tiles[x][y][2];
	},

	getAttributes : function(x, y) {
		return this.tiles[x][y][3];
	}
});

var ChunkDiskIO = {
	writeAllChunks : function(aworld, callback) {
		var stream = function(err) {
			if (err)
				console.error("chunk write error: ", err);
			var chunkmap = aworld.chunks;
			fs.mkdir(fpath + "chunk/", function() {
				var guards = 0;
				var guard = function() {
					guards--;
					if (guards == 0)
						fs.unlink(lockfile, function(err) {
							if (err)
								console.error("Failed to release WRITE.lock", err);
							callback();
						});
				};
				for (var x = 0; x < chunkmap.length; x++) {
					for (var y = 0; y < chunkmap[x].length; y++) {
						guards++;
						var cpath = fpath + "chunk/" + x + "-" + y + ".chunk";
						ChunkDiskIO.streamChunkToDisk(cpath, chunkmap[x][y], guard);
					}
				}
			});
		}

		var fpath = "data/world/" + aworld.uid + "/";
		var lockfile = fpath + "WRITE.lock";
		if (fs.exists(lockfile))
			throw new Error("World directory is write-locked (WRITE.lock)");
		fs.closeSync(fs.openSync(lockfile, "w"));

		if (fs.exists(fpath))
			fs.unlink(fpath, function() {
				mkdirp(fpath, stream);
			});
		else
			mkdirp(fpath, stream);
	},

	streamChunkToDisk : function(path, chunk, callback) {
		var wstream = fs.createWriteStream(path);
		wstream.on("finish", callback);
		wstream.write(JSON.stringify({
			width : chunk.width,
			height : chunk.height,
			tiles : chunk.tiles
		}));
		wstream.end();
	},

	readAllChunks : function(aworld) {

	}
}

var WorldGenerator = Common.Class.extend({
	seed : null,
	width : null,
	height : null,
	chunkWidth : null,
	chunkHeight : null,

	init : function(seed, width, height, chunkWidth, chunkHeight) {
		this.seed = seed;
		this.width = width;
		this.height = height;
		this.chunkWidth = chunkWidth;
		this.chunkHeight = chunkHeight;
	},

	paintChunks : function() {
		console.log(this.toString(), "populating chunks");
		var chunks = Common.brewArray(this.width, this.height);
		for (var x = 0; x < this.width; x++)
			for (var y = 0; y < this.height; y++) {
				console.log(this.toString(), "painting chunk", [ x, y ]);
				chunks[x][y] = this.paintChunk(x, y);
				console.log(this.toString(), "decorating chunk", [ x, y ]);
				this.decorateChunk(chunks[x][y], x, y);
				console.log(this.toString(), "done preparing chunk", [ x, y ], chunks[x][y].toString());
			}
		console.log(this.toString(), "done populating chunks");
		return chunks;
	},
	paintChunk : function(x, y) {
	},
	decorateChunk : function(chunk, x, y) {
	},
});

module.exports = {
	GameObjects : GameObjects,
	World : World,
	Chunk : Chunk,
	WorldGenerator : WorldGenerator
}