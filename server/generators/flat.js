var Common = require("../common.js");
var World = require("../worlds.js");
var Noise = require("../math/noise.js");

var FlatGenerator = World.WorldGenerator.extend({
	init : function(seed, width, height, chunkWidth, chunkHeight) {
		this._super(seed, width, height, chunkWidth, chunkHeight);
	},

	toString : function() {
		return "FlatGenerator { seed: " + this.seed + ", width: " + this.width + ", height: " + this.height + " }";
	},

	paintChunk : function(x, y) {
		var chunk = new World.Chunk(this.chunkWidth, this.chunkHeight);
		for (var x = 0; x < this.chunkWidth; x++) {
			for (var y = 0; y < this.chunkHeight; y++) {
				chunk.tiles[x][y][0] = 1;
				chunk.tiles[x][y][1] = true;
				chunk.tiles[x][y][2] = true;
				chunk.tiles[x][y][3] = {};
			}
		}
		return chunk;
	},

	decorateChunk : function() {
	},
});

module.exports = {
	FlatGenerator : FlatGenerator
}