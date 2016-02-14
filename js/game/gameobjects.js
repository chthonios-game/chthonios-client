"use strict";

/**
 * Entity
 */
function Entity() {
	this.x = 0;
	this.y = 0;

	this.setPosition = function(x, y) {
		this.x = x;
		this.y = y;
	}

	this.repaintEntity = function() {
		/* voidable */
	}
}

/**
 * Chunk
 */
function Chunk(world, x, y, width, height) {
	this.world = world;
	this.x = x;
	this.y = y;
	this.width = width;
	this.height = height;
	this.tiles = [];

	this._needRepaint = false;
	this._client_gbuf = null;

	this._dataModified = function() {
		if (!this._needRepaint) {
			this._needRepaint = true;
			this.world.markChunkDirty(this);
		}
	}

	this.parseChunk = function(payload) {
		var data = JSON.parse(payload.payload);
		if (this.width != undefined && this.height != undefined)
			if (data.width != this.width || data.height != this.height)
				throw new Error("Chunk data size <-> declared size mismatch.");
		this.width = data.width;
		this.height = data.height;
		this.tiles = data.tiles;
		this._dataModified();
	}

	this.getTile = function(x, y) {
		return this.tiles[x][y][0];
	}

	this.getSolid = function(x, y) {
		return this.tiles[x][y][1];
	}

	this.getPassable = function(x, y) {
		return this.tiles[x][y][2];
	}

	this.getAttributes = function(x, y) {
		return this.tiles[x][y][3];
	}
	
	this.getHeight = function(x, y) {
		return this.tiles[x][y][4];
	}
}