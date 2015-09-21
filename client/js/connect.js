"use strict";
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
		return fn.apply(fncontext, arguments);
	}
};

/**
 * Boot the future system. This allows assured callbacks, and is essential.
 */
Future.assure(100, true);

function init() {
	if (!("WebSocket" in window))
		alert("Your browser doesn't support WebSocket.\nPlease download the latest version of\n"
				+ "Google Chrome or Mozilla Firefox to play.");
	else {
		var authentication = new authenticator();
		var callback = function(data) {
			authentication.hideAuthenticator();
			Game.init(data.token, data.secret);
		}
		authentication.requestToken(callback);
	}
}
