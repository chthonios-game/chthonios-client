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
	/** The current position of the entity */
	this.posX = 0, this.posY = 0;
	/** The entity's trail */
	this.previous = {};
	/** The current icon of the entity */
	this.icon = null;

	/** The half width/height render size */
	this.halfW = 0, this.halfH = 0;

	/**
	 * Set by internal methods when the rendering settings are changed, but the EntityBatcher has not yet collected them
	 * and sent them to the GPU.
	 */
	this.modified = false;

	/**
	 * Updates the position of the entity. The entity is marked for render update.
	 * 
	 * @param x
	 *            The new x-coordinate
	 * @param y
	 *            The new y-coordinate
	 */
	this.setPosition = function(x, y) {
		this.posX = x;
		this.posY = y;
		this.modified = true;
	}

	/**
	 * Sets the icon of the entity. The entity is marked for render update.
	 * 
	 * @param icon
	 *            The EntityIcon to use
	 */
	this.setEntityIcon = function(icon) {
		this.icon = icon;
	}
	this.getEntityIcon = function() {
		return this.icon;
	}

	this.getRenderBounds = function() {
		return [ this.posX - this.halfW, this.posY - this.halfH, this.posX + this.halfW, this.posY + this.halfH ];
	}

	/**
	 * Called by the World to tick the entity.
	 */
	this.tickEntity = function() {
	}

	/**
	 * Called by the World to render-tick the entity.
	 */
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

	this._dataModified = function() {
		if (!this._needRepaint) {
			this._needRepaint = true;
			console.log(this.toString() + " modified, need chunk repaint bug fix!");
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