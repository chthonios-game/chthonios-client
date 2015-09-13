if (typeof String.prototype.startsWith != 'function') {
	String.prototype.startsWith = function(str) {
		return this.slice(0, str.length) == str;
	};
}

if (typeof String.prototype.endsWith != 'function') {
	String.prototype.endsWith = function(str) {
		return this.slice(-str.length) == str;
	};
}

/**
 * <p>
 * Generate a decorated callback function. The decorated callback function uses
 * the provided <code>this</code> scope to generate a callback closure which
 * can subsequently used where the value of <code>this</code> is likely to be
 * mangled or otherwise an unknown value.
 * </p>
 * 
 * <p>
 * On invoke by the calling function the callback closure passes all provided
 * function call arguments to the decorated child function. The value returned
 * by the child function is returned to the calling function without
 * modification. Any exception raised in the child function are passed to the
 * calling function without handling or reporting.
 * </p>
 * 
 * <p>
 * This is necessary because generic callbacks (from event-places like
 * <code>window</code>, <code>document</code> and <code>canvas</code>)
 * mangle the logical value of the "this" context. Because we are reliant on the
 * <code>this</code> scope pointing to a game object or the game itself, a
 * decorator closure is required to un-mangle the <code>this</code> reference.
 * </p>
 * 
 * @param fn
 *            The function reference
 * @param fncontext
 *            The context which "this" refers to
 */
var decoratedCallback = function(fn, fncontext) {
	return function() {
		fn.apply(fncontext, arguments);
	}
};

var assert = function(cond, message) {
	if (cond)
		return;
	if (typeof Error !== "undefined")
		throw new Error(message || "Assertion failed!");
	throw message || "Assertion failed!";
};

var Class = (function() {
	var initializing = false;
	var fnTest = /xyz/.test(function() {
		xyz;
	}) ? /\b_super\b/ : /.*/;

	var Class = function() {
	};

	Class.extend = function(prop) {
		var _super = this.prototype;
		initializing = true;
		var prototype = new this();
		initializing = false;

		for ( var name in prop) {
			if (typeof prop[name] != "function" || typeof _super[name] != "function" || !fnTest.test(prop[name]))
				prototype[name] = prop[name];
			else
				prototype[name] = (function(name, fn) {
					return function() {
						var tmp = this._super;
						this._super = _super[name];
						var ret = fn.apply(this, arguments);
						this._super = tmp;
						return ret;
					};
				})(name, prop[name]);
		}

		function Class() {
			if (!initializing && this.init)
				this.init.apply(this, arguments);
		}

		Class.prototype = prototype;
		Class.prototype.constructor = Class;
		Class.extend = arguments.callee;
		return Class;
	};
	return Class;
})();

var Network = {
	CODE_PROTO_ERROR : 3001,
	CODE_HANDSHAKE_ERR : 3002,
	CODE_DISCONNECT : 3003
};

module.exports = {
	assert : assert,
	Class : Class,
	decoratedCallback : decoratedCallback,
	Network : Network
}