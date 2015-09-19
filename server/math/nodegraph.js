var Common = require("./common.js");
var Graph = Common.Class.extend({
	nodes : [],
	edges : [],

	putNode : function(x, y) {
		this.nodes.push({
			x : x,
			y : y
		});
	},

	putEdge : function(x, y, xd, yd) {
		this.edges.push({
			a : {
				x : x,
				y : y
			},
			b : {
				xd : xd,
				yd : yd
			}
		});
	},

	node : function(c) {
		return (this.nodes.filter(function(n) {
			return n.coord.x == c.x && n.coord.y == c.y;
		})[0]);
	},

	edge : function(a, b) {
		return (this.edges.filter(function(e) {
			var f0 = (e.a.x == a.x && e.a.y == a.y) && (e.b.x == b.x && e.b.y == b.y);
			var f1 = (e.a.x == b.x && e.a.y == b.y) && (e.b.x == a.x && e.b.y == a.y);
			return f0 || f1;
		})[0]);
	},

	outEdges : function(r) {
		return this.edges.filter(function(e) {
			return (e.a.x == r.x && e.a.y == r.y);
		});
	},

	inEdges : function(r) {
		return this.edges.filter(function(e) {
			return (e.b.x == r.x && e.b.y == r.y);
		});
	},

});

var Nodegraph = {
	paintMap : function(chunk) {
		var graph = new Graph();

		for (var x = 0; x < chunk.width; x++) {
			for (var y = 0; y < chunk.height; y++) {
				var tile = chunk.tiles[x][y];
				if (!graph.node({
					x : x,
					y : y
				}))
					graph.putNode(x, y);

				var adjacents = chunk.adjacent(x, y);
				for (var ix = 0; ix < adjacents.length; ix++)
					if (!graph.node({
						x : adjacents[ix][0],
						y : adjacents[ix][1]
					}))
						graph.putNode(adjacents[ix][0], adjacents[ix][1]);

				var tile_solid = chunk.getSolid(x, y);
				var tile_passable = chunk.getPassable(x, y);
				for (var ix = 0; ix < adjacents.length; ix++) {
					var adjacent_solid = chunk.getSolid(adjacents[ix][0], adjacents[ix][1]);
					var adjacent_passable = chunk.getPassable(adjacents[ix][0], adjacents[ix][1]);

					/*
					 * If the source tile is impassable and the destination tile
					 * is also impassable, we will connect the two tiles
					 * together. No entity should be able to walk here.
					 * 
					 * If the source tile is passable and the destination tile
					 * is passable, we will consider them.
					 */
					if ((!tile_passable) && (!adjacent_passable))
						graph.putEdge(x, y, adjacents[ix][0], adjacents[ix][1]);
					else if (tile_passable && adjacent_passable) {
						// Connect only solid ground tiles to ground tiles;
						// Connect only water tiles to water tiles.
						if (tile_solid && adjacent_solid)
							graph.putEdge(x, y, adjacents[ix][0], adjacents[ix][1]);
						else if ((!tile_solid) && (!adjacent_solid))
							graph.putEdge(x, y, adjacents[ix][0], adjacents[ix][1]);
					}
				}
			}
		}
	}
}

module.exports = {
	Nodegraph : Nodegraph
}