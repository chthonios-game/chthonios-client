"use strict";
/**
 * <p>
 * Generate a decorated callback function. The decorated callback function uses the provided <code>this</code> scope
 * to generate a callback closure which can subsequently used where the value of <code>this</code> is likely to be
 * mangled or otherwise an unknown value.
 * </p>
 * 
 * <p>
 * On invoke by the calling function the callback closure passes all provided function call arguments to the decorated
 * child function. The value returned by the child function is returned to the calling function without modification.
 * Any exception raised in the child function are passed to the calling function without handling or reporting.
 * </p>
 * 
 * <p>
 * This is necessary because generic callbacks (from event-places like <code>window</code>, <code>document</code>
 * and <code>canvas</code>) mangle the logical value of the "this" context. Because we are reliant on the
 * <code>this</code> scope pointing to a game object or the game itself, a decorator closure is required to un-mangle
 * the <code>this</code> reference.
 * </p>
 * 
 * @param fn
 *            The function reference
 * @param fncontext
 *            The context which "this" refers to
 */
var decoratedCallback = function(fn, fncontext) {
	assert(fn !== undefined && fn !== null, "Illegal decorated callback functional target.");
	assert(fncontext !== undefined && fncontext !== null, "Illegal decorated callback functional context.");
	return function() {
		return fn.apply(fncontext, arguments);
	}
};

/**
 * Compute the unique items of an array under a specified optional hasher and initial default hashtable.
 */
var unique = function(arr, hasher, hashtable) {
	var _hashtbl = (hashtable != null) ? hashtable : {};
	var _hashfn = (hasher != null) ? hasher : JSON.stringify;
	return arr.filter(function(object) {
		var hash = _hashfn(object);
		return _hashtbl.hasOwnProperty(hash) ? false : (_hashtbl[hash] = true);
	})
}

/**
 * Boot the future system. This allows assured callbacks, and is essential.
 */
Future.assure(100, false);

function init() {
	if (!("WebSocket" in window))
		alert("Your browser doesn't support WebSocket.\nPlease download the latest version of\n"
				+ "Google Chrome or Mozilla Firefox to play.");
	else {
		scaffold.init();
		var lwin = scaffold.createWindow("Login", $("#authenticator")).ireg("properties.close", false).ireg("properties.resize", false)
				.ireg("properties.minimize", false);
		lwin.hide();
		lwin.resize(450, 200);

		var gwin = scaffold.createWindow("Game Window", $("#win-canvas"));
		gwin.hide();
		gwin.subscribe("resize", function() {
			Game.cbResizeCanvas();
		});
		gwin.resize(1200, 800);
		gwin.move(365, 0);

		var controlbox = scaffold.createWindow("Control Window", $("#win-controls"));
		controlbox.hide();
		controlbox.resize(360, 800);
		controlbox.move(0, 0);

		Game.init(scaffold.getLoader(), function() {
			var authentication = new authenticator();
			var callback = function(data) {
				lwin.hide();
				gwin.show();
				controlbox.show();
				var result = Game.login(data.token, data.secret);
			}
			authentication.requestToken(callback);
			lwin.show();
		});
	}
}
