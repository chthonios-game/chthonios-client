/**
 * Simple future assurance callback service.
 */

var Future = {
	futures : [],
	timer : null,
	debug : function() { /* voidable */
	},

	assure : function(freq, debug) {
		if (Future.timer != null)
			clearInterval(Future.timer);
		console.log("Future.assure", "assuring future callbacks at frequency", freq);
		Future.timer = setInterval(Future.update, freq);
		if (debug === true) {
			Future.debug = function() {
				console.log.apply(console, arguments);
			};
			Future.debug("Future.debug", "future debugging turned on");
		}
	},

	/**
	 * Assure that a function callback will be executed once when a condition
	 * function callback returns true.
	 * 
	 * @param fn
	 *            The callback function.
	 * @param cond
	 *            The conditional function.
	 */
	once : function(fn, cond) {
		Future.debug("Future.once", fn, cond);
		Future.futures.push({
			type : "once",
			condition : cond,
			callback : fn
		});
	},

	/**
	 * Assure that a function callback is executed every update until the
	 * condition function callback returns true.
	 * 
	 * @param fn
	 *            The callback function.
	 * @param cond
	 *            The conditional function.
	 */
	until : function(fn, cond) {
		Future.debug("Future.until", fn, cond);
		Future.futures.push({
			type : "until",
			condition : cond,
			callback : fn
		});
	},

	/**
	 * Assure that a function callback is executed every update until the
	 * condition function callback returns false.
	 * 
	 * @param fn
	 *            The callback function.
	 * @param cond
	 *            The conditional function.
	 */
	repeat : function(fn, cond) {
		Future.debug("Future.repeat", fn, cond);
		Future.futures.push({
			type : "repeat",
			condition : cond,
			callback : fn
		});
	},

	/**
	 * Assure that a function callback is executed every update.
	 * 
	 * @param fn
	 *            The callback function.
	 */
	forever : function(fn) {
		Future.debug("Future.forever", fn);
		Future.futures.push({
			type : "forever",
			callback : fn
		});
	},

	update : function() {
		var fx = Future.futures;
		var garbage = [];
		for (var ix = 0; ix < fx.length; ix++) {
			var ifuture = fx[ix];
			try {
				if (ifuture.type == "forever") {
					ifuture.callback();
				} else if (ifuture.type == "once") {
					var cond = ifuture.condition();
					if (cond) {
						Future.debug("Future.update", "update.once", ifuture);
						ifuture.callback();
						garbage.push(ifuture);
					}
				} else if (ifuture.type == "repeat") {
					if (ifuture.condition())
						ifuture.callback();
					else
						garbage.push(ifuture);
				} else if (ifuture.type == "until") {
					if (!ifuture.condition())
						ifuture.callback();
					else
						garbage.push(ifuture);
				}
			} catch (e) {
				console.error("Future threw exception", e);
				garbage.push(ifuture);
			}
		}
		if (garbage.length != 0)
			for (var gx = 0; gx < garbage.length; gx++) {
				var igarbage = garbage[gx];
				Future.debug("Future.update", "update.collect", igarbage);
				var idx = -1;
				while ((idx = Future.futures.indexOf(igarbage)) != -1)
					Future.futures.splice(idx, 1);
			}
	}

}