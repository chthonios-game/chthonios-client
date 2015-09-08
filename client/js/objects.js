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

	this.magnitude = function() {
		return Math.sqrt(Math.pow(this.x, 2) + Math.pow(this.y, 2));
	}

	this.add = function() {
		if (arguments.length == 1) {
			assert(arguments[0] instanceof Vector2d, "Expected Vector2d");
			var vec = arguments[0];
			return new Vector2d(this.x + vec.x, this.y + vec.y);
		}
		assert(isNumber(arguments[0]) && isNumber(arguments[1]), "Expected number, number");
		return new Vector2d(this.x + arguments[0], this.y + arguments[1]);
	}

	this.sub = function() {
		if (arguments.length == 1) {
			assert(arguments[0] instanceof Vector2d, "Expected Vector2d");
			var vec = arguments[0];
			return new Vector2d(this.x - vec.x, this.y - vec.y);
		}
		assert(isNumber(arguments[0]) && isNumber(arguments[1]), "Expected number, number");
		return new Vector2d(this.x - arguments[0], this.y - arguments[1]);
	}

	this.imul = function() {
		assert(isNumber(arguments[0]), "Expected number");
		return new Vector2d(this.x * arguments[0], this.y * arguments[0]);
	}
}

/**
 * Basic camera prototype
 */
function Camera() {
	this.cameraX = 0;
	this.cameraY = 0;
	this.cameraWidth = 0;
	this.cameraHeight = 0;

	this.updateViewport = function(width, height) {
		this.cameraWidth = width / 2;
		this.cameraHeight = height / 2;
	}

	this.focusOnEntity = function(game, entity) {
		assert(entity instanceof Entity, "Expected entity");
		this.focusOnCoords(entity.x, entity.y);
	}

	this.focusOnGameCoords = function(x, y) {
		this.focusOnCoords(x * 32, y * 32);
	}

	this.focusOnCoords = function(x, y) {
		this.cameraX = x;
		this.cameraY = y;
	}

	this.getInterpolatedPosition = function() {
		return {
			x : this.cameraWidth - (this.cameraX),
			y : this.cameraHeight - (this.cameraY)
		};
	}
}

/**
 * World
 */
function World() {
	/* voidable */
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
}