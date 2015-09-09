"use strict";

/**
 * Handle the instance where <code>assert</code> is undefined.
 */
(function() {
	if (!window.assert)
		window.assert = function(cond, message) {
			if (cond)
				return;
			if (typeof Error !== "undefined")
				throw new Error(message || "Assertion failed!");
			throw message || "Assertion failed!";
		};
})();

/**
 * Vector2d
 */
function Vector2d(x, y) {
	this.x = x;
	this.y = y;

	/**
	 * Get the magnitude of the vector.
	 */
	this.magnitude = function() {
		return Math.sqrt(Math.pow(this.x, 2) + Math.pow(this.y, 2));
	}

	/**
	 * Add a vector or a pair of (x, y) coordinates to this vector. Returns a
	 * new vector product.
	 */
	this.add = function() {
		if (arguments.length == 1) {
			assert(arguments[0] instanceof Vector2d, "Expected Vector2d");
			var vec = arguments[0];
			return new Vector2d(this.x + vec.x, this.y + vec.y);
		}
		assert(isNumber(arguments[0]) && isNumber(arguments[1]), "Expected number, number");
		return new Vector2d(this.x + arguments[0], this.y + arguments[1]);
	}

	/**
	 * Subtract a vector or a pair of (x, y) coordinates from this vector.
	 * Returns a new vector product.
	 */
	this.sub = function() {
		if (arguments.length == 1) {
			assert(arguments[0] instanceof Vector2d, "Expected Vector2d");
			var vec = arguments[0];
			return new Vector2d(this.x - vec.x, this.y - vec.y);
		}
		assert(isNumber(arguments[0]) && isNumber(arguments[1]), "Expected number, number");
		return new Vector2d(this.x - arguments[0], this.y - arguments[1]);
	}

	/**
	 * Multiplies this vector by a scalar value. All coordinates of the product
	 * vector are multiplied by the floating-point factor provided. Returns a
	 * new vector product.
	 */
	this.imul = function() {
		assert(isNumber(arguments[0]), "Expected number");
		return new Vector2d(this.x * arguments[0], this.y * arguments[0]);
	}
}

/**
 * Basic camera prototype
 */
function Camera() {
	this.cameraPos = new Vector2d(0, 0)
	this.cameraSize = new Vector2d(0, 0);

	this.updateViewport = function(width, height) {
		this.cameraSize = new Vector2d(width / 2, height / 2);
	}

	this.focusOnEntity = function(game, entity) {
		assert(entity instanceof Entity, "Expected entity");
		this.focusOnCoords(entity.x, entity.y);
	}

	this.focusOnGameCoords = function(x, y) {
		this.focusOnCoords(x * 32, y * 32);
	}

	this.focusOnCoords = function(x, y) {
		this.cameraPos = new Vector2d(x, y);
	}

	this.panCamera = function(x, y) {
		this.cameraPos = this.cameraPos.add(x, y);
	}

	this.getInterpolatedPosition = function() {
		return this.cameraSize.sub(this.cameraPos);
	}
}

/**
 * World
 */
function World() {

	this.entities = [];
	this.chunks = [];

	this.addEntity = function(entity) {
		assert(entity instanceof Entity, "Can't add non-entity to world");
		this.entities.push(entity);
	}

	this.removeEntity = function(entity) {
		assert(entity instanceof Entity, "Can't remove non-entity from world");
		var idx = -1;
		while ((idx = this.entities.indexOf(entity)) !== -1)
			this.entities.splice(idx, 1);
	}

	this.repaintWorld = function(game) {
		/* voidable */
	}
}

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
function Chunk(width, height) {
	this.width = width;
	this.height = height;
	this.tiles = [];

	this.repaintChunk = function() {
		/* voidable */
	}

}