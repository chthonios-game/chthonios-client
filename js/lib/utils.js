
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
