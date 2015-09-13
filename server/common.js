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

var Network = {
	CODE_PROTO_ERROR : 3001,
	CODE_HANDSHAKE_ERR : 3002,
	CODE_DISCONNECT : 3003
};

module.exports = {
	assert : assert,
	decoratedCallback : decoratedCallback,
	Network : Network
}