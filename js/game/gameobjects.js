"use strict";

/**
 * Entity
 * <ul>
 * <li>TODO: Entity requires a VMA to repaint</li>
 * <li>TODO: Entity repaintEntity() should write to the VMA</li>
 * <li>TODO: Entity needs a method to set rendering opts per-frame</li>
 * </ul>
 */
function Entity() {
	this.posX = 0;
	this.posY = 0;
	this.icon = null;
	this.previous = {};

	this.modified = false;

	this.setPosition = function(x, y) {
		this.posX = x;
		this.posY = y;
		this.modified = true;
	}

	this.setEntityIcon = function(icon) {
		this.icon = icon;
	}
	this.getEntityIcon = function() {
		return this.icon;
	}

	this.tickEntity = function() {
	}

	this.partialTickEntity = function(partialTicks) {
	}

	this.preTickEntity = function() {
	}
	this.postTickEntity = function() {
	}

	this.prePartialTickEntity = function(pt) {
	}
	this.postPartialTickEntity = function(pt) {

	}

	this.updateEntity = function() {
		return false;
	}
	this.partialUpdateEntity = function(partialTicks) {
		return false;
	}
}

function EntityIcon(path, fx, fy, fw, fh) {
	this.path = path;
	this.fx = fx;
	this.fy = fy;
	this.fw = fw;
	this.fh = fh;
}

/**
 * Chunk
 */
function Chunk(world, x, y, width, height) {
	this.loaded = false;
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
			console.log(this.toString()
					+ " modified, need chunk repaint bug fix!");
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
		this.loaded = true;
		this._dataModified();
	}

	this.getTile = function(x, y) {
		assert(this.tiles != undefined && this.tiles != null, "no tile data!");
		return this.tiles[x][y][0];
	}

	this.getSolid = function(x, y) {
		assert(this.tiles != undefined && this.tiles != null, "no tile data!");
		return this.tiles[x][y][1];
	}

	this.getPassable = function(x, y) {
		assert(this.tiles != undefined && this.tiles != null, "no tile data!");
		return this.tiles[x][y][2];
	}

	this.getAttributes = function(x, y) {
		assert(this.tiles != undefined && this.tiles != null, "no tile data!");
		return this.tiles[x][y][3];
	}

	this.getHeight = function(x, y) {
		assert(this.tiles != undefined && this.tiles != null, "no tile data!");
		return this.tiles[x][y][4];
	}
}