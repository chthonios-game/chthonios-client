var Common = require("../common.js");
var World = require("../worlds.js");
var Noise = require("../math/noise.js");

var FlatGenerator = World.WorldGenerator.extend({
	init : function(seed) {
		this._super(seed);
	},

	toString : function() {
		return "FlatGenerator { seed: " + this.seed + " }";
	},

	paintChunk : function(wx, wy, chunkWidth, chunkHeight) {
		var chunk = new World.Chunk(chunkWidth, chunkHeight);
		var i = 0;
		for (var x = 0; x < chunkWidth; x++) {
			for (var y = 0; y < chunkHeight; y++) {
				chunk.tiles[x][y][0] = ((x + y) % 6 == 0) ? 2 : 1;
				chunk.tiles[x][y][1] = true;
				chunk.tiles[x][y][2] = ((x + y) % 6 == 0) ? false : true;
				chunk.tiles[x][y][3] = {};
				chunk.tiles[x][y][4] = ((x + y) % 6 == 0) ? 1 : 0;
				i++;
			}
		}
		return chunk;
	},

	decorateChunk : function(chunk, x, y, chunkWidth, chunkHeight) {
	},

	paintWorldTileset : function(x, y, chunkWidth, chunkHeight) {
		return [ {
			sprite : "ash_lava.png",
			name : "Void"
		}, {
			sprite : "grass_light_full.png",
			name : "Grass"
		}, {
			sprite : "cobble_full.png",
			name : "Cobblestone"
		}, {
			sprite : "dirt_full.png",
			name : "Dirt"
		} ];
	},

});

module.exports = {
	FlatGenerator : FlatGenerator
}