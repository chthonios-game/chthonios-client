/**
 * scaffold: scaffolding for the general UI composition
 */
var scaffold = {
	/** list of active windows */
	_activeWindows : {},
	/** zbuffer for layering */
	_zIndex : [],
	/** reference to the current top window */
	_activeWindow : null,
	/** the current keyboard state */
	_pressedKeys : {},
	/** the live asset registry */
	_assets : null,

	_reg : {},

	/**
	 * Read to or write from the local registry.
	 * 
	 * @param q The key to query
	 * @param v The optional value to set
	 * @returns The value of the key specified by q, or if a value is set, the previous value of the key specified by q
	 *          before the value of q is updated with v.
	 */
	reg : function(q, v, fw) {
		if (v !== undefined && v !== null || fw) {
			var o = this._reg[q];
			this._reg[q] = v;
			return o;
		} else
			return (this._reg[q] === undefined) ? null : this._reg[q];
	},

	init : function() {
		console.log("scaffold.init", "init started");
		/*
		 * We have to hook all events here and manage them in the scaffold, then pass events back to the active window
		 * if the event concerns a window.
		 */
		if (document.addEventListener) {
			document.addEventListener("keydown", decoratedCallback(this._cbKeyEvent, this), false);
			document.addEventListener("keypress", decoratedCallback(this._cbKeyEvent, this), false);
			document.addEventListener("keyup", decoratedCallback(this._cbKeyEvent, this), false);
			document.addEventListener("mousedown", decoratedCallback(this._cbMouseClicked, this), false);
			document.addEventListener("mousemove", decoratedCallback(this._cbMouseMoved, this), false);
			document.addEventListener("mouseup", decoratedCallback(this._cbMouseUp, this), false);
			document.addEventListener("wheel", decoratedCallback(this._cbMouseWheel, this), false);
		} else if (document.attachEvent) {
			document.attachEvent("onkeydown", decoratedCallback(this._cbKeyEvent, this));
			document.attachEvent("onkeypress", decoratedCallback(this._cbKeyEvent, this));
			document.attachEvent("onkeyup", decoratedCallback(this._cbKeyEvent, this));
			document.attachEvent("onmousedown", decoratedCallback(this._cbMouseClicked, this));
			document.attachEvent("onmousemove", decoratedCallback(this._cbMouseMoved, this));
			document.attachEvent("onmouseup", decoratedCallback(this._cbMouseUp, this));
			document.attachEvent("onwheel", decoratedCallback(this._cbMouseWheel, this));
		} else {
			document.onkeydown = decoratedCallback(this._cbKeyEvent, this);
			document.onkeypress = decoratedCallback(this._cbKeyEvent, this);
			document.onkeyup = decoratedCallback(this._cbKeyEvent, this);
			document.onmousedown = decoratedCallback(this._cbMouseClicked, this);
			document.onmousemove = decoratedCallback(this._cbMouseMoved, this);
			document.onmouseup = decoratedCallback(this._cbMouseUp, this);
			document.onwheel = decoratedCallback(this._cbMouseWheel, this);
		}

		if (window.addeventListener) {
			window.addEventListener("resize", decoratedCallback(this._cbResizeViewport, this), false);
		} else if (window.attachEvent) {
			window.attachEvent("onresize", decoratedCallback(this._cbResizeViewport, this));
		} else {
			window.onresize = decoratedCallback(this._cbResizeViewport, this);
		}

		this._assets = new AssetManager();
		console.log("scaffold.init", "created assetworker:", this._assets);
	},

	_cbKeyEvent : function(e) {
		if (!e)
			e = window.event; /* old browser? */
		if (e.type === 'keydown') {
			this._pressedKeys[e.which] = 1;
			if (this._activeWindow !== null)
				this._activeWindow._callEvent("keydown", [ e ]);
		}
		if (e.type === 'keyup') {
			delete this._pressedKeys[e.which];
			if (this._activeWindow !== null)
				this._activeWindow._callEvent("keyup", [ e ]);
		}
	},

	_cbResizeViewport : function(event) {
		if (!event)
			event = window.event; /* old browser? */
		// _rebuildLayout is called by window.move on update, so window.move is sufficient
		$.each(this._activeWindows, function(n, w) { // each window
			w.move(w.x, w.y); // rebuild position
		});
	},
	_cbMouseClicked : function(event) {
		if (!event)
			event = window.event; /* old browser? */
		this.reg("mouse-x", event.clientX);
		this.reg("mouse-y", event.clientY);
		this.reg("mouse-down", true);
		var flag = false; // did we switch to this window
		if (this._activeWindow === null || !this._clickInActiveWindow(event.clientX, event.clientY)) { // elsewhere?
			var win = this.findWindow(event.target); // find win
			this.switchToWindow(win); // goto
			flag = true; // set switch flag
			event.preventDefault(); // prevent reuse
		}

		if (this._activeWindow !== null) { // has live window?
			if (this._clickInTitlebox(event.clientX, event.clientY)) { // clicked in titlebox?
				event.preventDefault(); // prevent reuse
				this.reg("_drag_window", this._activeWindow);
				var tbar = this._getTitlebox(this._activeWindow.container);
				var origin = tbar.offset();
				this.reg("_drag_mdx", event.clientX - origin.left);
				this.reg("_drag_mdy", event.clientY - origin.top);
			} else if (!flag) // has not switched to this click?
				this._activeWindow._callEvent("mousedown", [ event ]); // forward
		}

	},
	_cbMouseMoved : function(event) {
		if (!event)
			event = window.event; /* old browser? */
		if (this.reg("mouse-down") && event.clientX != this.reg("mouse-x") && event.clientY != this.reg("mouse-y")) {
			if (this.reg("_drag_window") !== null) { // if we have a drag target
				event.preventDefault(); // don't forward
				this.reg("_drag_window").move(event.clientX - this.reg("_drag_mdx"), event.clientY - this.reg("_drag_mdy"));
			} else if (this._activeWindow !== null)
				this._activeWindow._callEvent("mousemove", [ event ]);
		}
	},
	_cbMouseUp : function(event) {
		if (!event)
			event = window.event; /* old browser? */
		// If dragging, don't forward
		if (this.reg("mouse-down") === true && this.reg("_drag_window") !== null) {
			this.reg("_drag_window", null, true);
			this.reg("mouse-down", false); // reset mouse after _drag_window check
		} else {
			this.reg("mouse-down", false); // reset mouse before evt->fire
			if (this._activeWindow !== null)
				this._activeWindow._callEvent("mouseup", [ event ]);
		}
	},
	_cbMouseWheel : function(event) {
		if (!event)
			event = window.event; /* old browser? */
		if (this._activeWindow !== null)
			this._activeWindow._callEvent("mousewheel", [ event ]);
	},

	createWindow : function(n, w) {
		console.log("scaffold.createWindow", "creating window:", n, w);
		this._activeWindows[n] = new scaffold.window(n, w); // new
		this._activeWindows[n].init();
		return this._activeWindows[n]; // return ptr: new window
	},

	showWindow : function(w) {
		console.log("scaffold.showWindow", "showing window:", w);
		var flag = false; // in dom already?
		$("#scaffold-workspace").children().each(function(i, o) {
			if (o == w[0])
				flag = true; // if in dom -> in_dom = y
		});
		if (!flag) { // in_dom = n?
			console.log("scaffold.createWindow", "window not in DOM, adding...");
			$("#scaffold-workspace").append(w); // add to dom
		}

		w.container.css("display", "block");
		if (this._zIndex.indexOf(w) === -1) {
			this._zIndex.push(w); // on top of zstack, new win
			this._rebuildLayout(); // refresh windows
			w._callEvent("create", [ w ]); // notify the window
			w.resize(w.width, w.height, true);
		} else {
			w._callEvent("show", [ w ]); // notify the window
			w.resize(w.width, w.height, true);
		}
	},

	hideWindow : function(w) {
		console.log("scaffold.hideWindow", "hiding window:", w);
		w.container.css("display", "none");
		w._callEvent("hide", [ w ]); // notify the window
		this._activeWindow = null; // unset
		this._rebuildLayout(); // refresh windows
	},

	closeWindow : function(w) {
		console.log("scaffold.closeWindow", "closing window:", w);
		this.hideWindow(w);

		if (this._activeWindow == w) // is active ptr?
			this._activeWindow = null; // unset

		// zlayer has w? :
		var idx = -1;
		while ((idx = this._zIndex.indexOf(w)) !== -1)
			this._zIndex.splice(idx, 1); // remove from zbuffer

		var list = []; // list of aliases for window
		$.each(this._activeWindows, function(n, w0) {
			if (w == w0)
				list.push(n); // store alias
		});
		for (var i = 0; i < list.length; i++)
			// each alias
			delete this._activeWindows[list[i]]; // delete

		w._callEvent("close", [ w ]); // notify the window
		w.container.remove(); // remove it from dom
		this._rebuildLayout(); // refresh windows
	},

	_rebuildLayout : function() {
		// _zIndex is stored bottom->top so (n+i) is sufficient
		for (var i = 0; i < this._zIndex.length; i++) {
			var win = this._zIndex[i];
			win.container.css("zIndex", 10 + i);
			win._rebuildLayout(); // trickle down change since vis has changed maybe?
		}
	},

	findWindow : function(o) {
		var mwo = $(o).closest(".scaffold-window")[0]; // find container
		if (mwo !== undefined && mwo !== null) { // got container?
			var which = null; // which window?
			$.each(this._activeWindows, function(n, w) { // in all windows
				if (w.container[0] == mwo)
					which = w; // is win -> store
			});
			if (which !== null) // found window
				return which;
			// no window found, weird?
			throw new Error("scaffold.findWindow got scaffold-window but no activeWindow");
		}
		return null; // no container, not a window
	},

	activeWindow : function(w) {
		if (w === undefined || w === null) // not a question
			return this._activeWindow;
		return w == this._activeWindow; // am I active?
	},

	switchToWindow : function(which) {
		if (this._activeWindow !== null) { // has old window?
			var tbar = this._getTitlebox(this._activeWindow.container);
			if (tbar !== null)
				tbar.removeClass("active");
			this._activeWindow._callEvent("blur", [ "blur", this._activeWindow ]);
		}
		this._activeWindow = null; // no old window

		if (which !== null) {
			var idx = this._zIndex.indexOf(which); // where is new win in zstack?
			if (idx !== -1) { // in renders stack, move to top
				var dpl = this._zIndex.splice(idx, 1)[0]; // >> pop
				this._zIndex.push(dpl); // << push
				this._activeWindow = dpl; // update activewindow ptr
				this._rebuildLayout(); // rebuild zbuffer
				if (this._activeWindow !== null) { // new window?
					var tbar = this._getTitlebox(this._activeWindow.container);
					if (tbar !== null)
						tbar.addClass("active");
					this._activeWindow._callEvent("focus", [ "focus", this._activeWindow ]);
				}
			} else
				throw new Error("scaffold.switchToWindow no such window in zbuffer, cannot switch!");
		}
	},

	_clickInActiveWindow : function(x, y) {
		if (this._activeWindow == null) // no active window?
			return false;
		return ((x >= this._activeWindow.x && x <= this._activeWindow.x + this._activeWindow.width) // within win x-w
		&& (y >= this._activeWindow.y && y <= this._activeWindow.y + this._activeWindow.height)); // within win y-h
	},

	_getTitlebox : function(win) {
		if (win === undefined || win === null) // no win?
			return null; // no tbox!
		var tbar = $(win).find(".win-caption"); // find tbox
		if (tbar[0] === undefined || tbar[0] === null) // no found?
			return null; // no tbox!
		return tbar; // return tbox
	},

	_clickInTitlebox : function(x, y) {
		var tbar = this._getTitlebox(this._activeWindow.container);
		if (tbar === null) // no tbar?
			return false; // computer says no
		var origin = tbar.offset(); // get layout
		return ((x >= origin.left && x <= origin.left + tbar.width()) // within layout l-w
		&& (y >= origin.top && y <= origin.top + 12)); // within layout y-h
	},

	pollKeyboard : function(accessor) {
		if (accessor !== this._activeWindow) // bad window?
			throw new Error("scaffold.pollKeyboard not allowed for inactive window!"); // scald!
		return this._pressedKeys.slice(); // return copy of
	},

	getLoader : function() {
		return this._assets;
	}

};

scaffold.window = function(name, root) {
	this.name = name;
	this.container = root;
	this.events = {};

	this.width = 0;
	this.height = 0;
	this.x = 0;
	this.y = 0;

	this.innerWidth = 0;
	this.innerHeight = 0;

	this.minWidth = 0;
	this.maxWidth = 0;
	this.minHeight = 0;
	this.maxHeight = 0;

	this._reg = {};

	this.reg = function(q, v) {
		if (v !== undefined && v !== null) {
			var o = this._reg[q];
			this._reg[q] = v;
			return o;
		} else
			return this._reg[q];
	};

	this.ireg = function(q, v) {
		this._reg[q] = v;
		return this;
	};

	this.init = function() {
		this.width = this.container.width(); // update width from real
		this.height = this.container.height(); // update height from real
		this.resize(this.width, this.height, true); // trigger sizing
	};

	this.setMaxDimensions = function(mw, mh) {
		this.maxWidth = mw;
		this.maxHeight = mh;
		this.resize(this.width, this.height); // update properties
	};

	this.setMinDimensions = function(mw, mh) {
		this.minWidth = mw;
		this.minHeight = mh;
		this.resize(this.width, this.height); // update properties
	}

	this.show = function() {
		return scaffold.showWindow(this);
	};
	this.hide = function() {
		return scaffold.hideWindow(this);
	};

	this.resize = function(w, h, force) {
		if (this.minWidth != 0 && this.minWidth > w) // too small width?
			w = this.minWidth;
		if (this.minHeight != 0 && this.minHeight > h) // too small height?
			h = this.minHeight;
		if (this.maxWidth != 0 && this.maxWidth < w) // too big width?
			w = this.maxWidth;
		if (this.maxHeight != 0 && this.maxHeight < h) // too bigh height?
			h = this.maxHeight;
		var oldW = this.width, oldH = this.height; // what old vals?
		this.width = w, this.height = h; // mangle
		if (this.width != oldW || this.height != oldH || force) { // changed or update forced?
			this._rebuildLayout(); // rebuild windows
			/*
			 * Update locally derived properties (innerWidth, innerHeight) which are computed post-resize from the
			 * container's new dimensions, the size of the caption and other layout dimensions.
			 */
			this.innerWidth = this.width - 1;
			this.innerHeight = this.height - $(this.container).find(".win-caption").height();
			this._callEvent("resize", [ this, this.width, this.height, this.innerWidth, this.innerHeight ]);
		}
	};

	this.move = function(x, y, force) {
		if (0 > x || 0 > y) // offscreen?
			x = 0; // scald
		if (x > (window.innerWidth - this.width)) // runaway?
			x = (window.innerWidth - this.width); // scald
		if (y > (window.innerHeight - this.height)) // runaway?
			y = (window.innerHeight - this.height); // scald

		var oldX = this.x, oldY = this.y; // what old vals?
		this.x = x, this.y = y; // mangle
		if (this.x != oldX || this.y != oldY || force) { // changed or update forced?
			this._rebuildLayout(); // rebuild windows
			this._callEvent("move", [ this, this.x, this.y ]);
		}
	}

	this.subscribe = function(event, callback) {
		if (this.events[event] === undefined // ??
				|| this.events[event] === null) // not registered before
			this.events[event] = []; // prepare list for registry
		this.events[event].push(callback); // register me!
	};

	this._callEvent = function(event, args) {
		if (this.events[event] !== undefined // ??
				&& this.events[event] !== null) { // has some registered events
			var subscribers = this.events[event]; // get list of subs
			for (var i = 0; i < subscribers.length; i++)
				// for each sub
				subscribers[i].apply(subscribers[i], args); // post
		}
	};

	this._rebuildLayout = function() {
		this.container.css("top", this.y + "px"); // css:top -> y
		this.container.css("left", this.x + "px"); // css:left -> x
		this.container.width(this.width); // css:width -> width
		this.container.height(this.height); // css:height -> height
	};

}