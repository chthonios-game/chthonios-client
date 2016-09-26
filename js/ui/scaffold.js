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
	_reg : {},

	/**
	 * Read to or write from the local registry.
	 * 
	 * @param q
	 *            The key to query
	 * @param v
	 *            The optional value to set
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
		/*
		 * We have to hook all events here and manage them in the scaffold, then pass events back to the active window
		 * if the event concerns a window.
		 */
		if (document.addEventListener) {
			document.addEventListener("keydown", decoratedCallback(this._cbKeyEvent, this), false);
			document.addEventListener("keypress", decoratedCallback(this._cbKeyEvent, this), false);
			document.addEventListener("keyup", decoratedCallback(this._cbKeyEvent, this), false);
			document.addEventListener("resize", decoratedCallback(this._cbResizeViewport, this), false);
			document.addEventListener("mousedown", decoratedCallback(this._cbMouseClicked, this), false);
			document.addEventListener("mousemove", decoratedCallback(this._cbMouseMoved, this), false);
			document.addEventListener("mouseup", decoratedCallback(this._cbMouseUp, this), false);
			document.addEventListener("wheel", decoratedCallback(this._cbMouseWheel, this), false);
		} else if (document.attachEvent) {
			document.attachEvent("onkeydown", decoratedCallback(this._cbKeyEvent, this));
			document.attachEvent("onkeypress", decoratedCallback(this._cbKeyEvent, this));
			document.attachEvent("onkeyup", decoratedCallback(this._cbKeyEvent, this));
			document.attachEvent("onresize", decoratedCallback(this._cbResizeViewport, this));
			document.attachEvent("onmousedown", decoratedCallback(this._cbMouseClicked, this));
			document.attachEvent("onmousemove", decoratedCallback(this._cbMouseMoved, this));
			document.attachEvent("onmouseup", decoratedCallback(this._cbMouseUp, this));
			document.attachEvent("onwheel", decoratedCallback(this._cbMouseWheel, this));
		} else {
			document.onkeydown = decoratedCallback(this._cbKeyEvent, this);
			document.onkeypress = decoratedCallback(this._cbKeyEvent, this);
			document.onkeyup = decoratedCallback(this._cbKeyEvent, this);
			document.onresize = decoratedCallback(this._cbResizeViewport, this);
			document.onmousedown = decoratedCallback(this._cbMouseClicked, this);
			document.onmousemove = decoratedCallback(this._cbMouseMoved, this);
			document.onmouseup = decoratedCallback(this._cbMouseUp, this);
			document.onwheel = decoratedCallback(this._cbMouseWheel, this);
		}
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
		console.log("_cbResizeViewport", event);
	},
	_cbMouseClicked : function(event) {
		if (!event)
			event = window.event; /* old browser? */
		console.log("_cbMouseClicked", event);
		this.reg("mouse-x", event.clientX);
		this.reg("mouse-y", event.clientY);
		this.reg("mouse-down", true);

		if (this._clickInActiveWindow(event.clientX, event.clientY)) {
			if (this._activeWindow !== null) {
				console.log("clickInTitlebox:", this._clickInTitlebox(event.clientX, event.clientY));
				if (this._clickInTitlebox(event.clientX, event.clientY)) {
					this.reg("_drag_window", this._activeWindow);
					var tbar = this._getTitlebox(this._activeWindow.container);
					var origin = tbar.offset();
					this.reg("_drag_mdx", event.clientX - origin.left);
					this.reg("_drag_mdy", event.clientY - origin.top);
				} else
					this._activeWindow._callEvent("mousedown", [ event ]);
			}
		} else {
			console.log("click in nonactive region", event.clientX, event.clientY, event.target);
			var win = this.findWindow(event.target);
			if (win !== undefined && win !== null) {
				this.switchToWindow(win);
				console.log('doneSwitch');
				event.preventDefault();
			}
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
		this._activeWindows[n] = new scaffold.window(n, w);
		this._activeWindows[n].init();
		this._zIndex.push(this._activeWindows[n]);
		this._rebuildLayout();
		return this._activeWindows[n];
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
		var mwo = $(o).closest(".scaffold-window")[0];
		if (mwo !== undefined && mwo !== null) {
			var which = null;
			$.each(this._activeWindows, function(n, w) {
				if (w.container[0] == mwo)
					which = w;
			});
			if (which !== null)
				return which;
			throw new Error("scaffold.findWindow got scaffold-window but no activeWindow");
		}
		return null;
	},

	activeWindow : function(w) {
		if (w === undefined || w === null)
			return this._activeWindow;
		return w == this._activeWindow;
	},

	switchToWindow : function(which) {
		if (this._activeWindow !== null)
			this._activeWindow._callEvent("blur", [ "blur", this._activeWindow ]);
		this._activeWindow = null;

		var idx = this._zIndex.indexOf(which);
		if (idx !== -1) { /* in render stack */
			var dpl = this._zIndex.splice(idx, 1)[0];
			console.log("scaffold.switchToWindow:", dpl, this._zIndex);
			this._zIndex.push(dpl);
			this._activeWindow = dpl;
			this._rebuildLayout(); // rebuild zbuffer
			if (this._activeWindow !== null) {
				this._activeWindow._callEvent("focus", [ "focus", this._activeWindow ]);
			}
		} else
			throw new Error("scaffold.switchToWindow no such window in zbuffer, cannot switch!");
	},

	_clickInActiveWindow : function(x, y) {
		if (this._activeWindow == null)
			return false;
		return ((x >= this._activeWindow.x && x <= this._activeWindow.x + this._activeWindow.width) && (y >= this._activeWindow.y && y <= this._activeWindow.y
				+ this._activeWindow.height));
	},

	_getTitlebox : function(win) {
		if (win === undefined || win === null)
			return null;
		var tbar = $(win).find(".win-caption");
		if (tbar[0] === undefined || tbar[0] === null)
			return null;
		return tbar;
	},

	_clickInTitlebox : function(x, y) {
		var tbar = this._getTitlebox(this._activeWindow.container);
		if (tbar === null)
			return false;
		var origin = tbar.offset();
		return ((x >= origin.left && x <= origin.left + tbar.width()) && (y >= origin.top && y <= origin.top + 12));
	},

	pollKeyboard : function(accessor) {
		if (accessor !== this._activeWindow)
			throw new Error("scaffold.pollKeyboard not allowed for inactive window!");
		return this._pressedKeys.slice();
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

	this.init = function() {
		this.width = this.container.width();
		this.height = this.container.height();
		this.resize(this.width, this.height, true);
	};

	this.setMaxDimensions = function(mw, mh) {
		this.maxWidth = mw;
		this.maxHeight = mh;
		this.resize(this.width, this.height);
	};

	this.setMinDimensions = function(mw, mh) {
		this.minWidth = mw;
		this.minHeight = mh;
		this.resize(this.width, this.height);
	}

	this.resize = function(w, h, force) {
		if (this.minWidth != 0 && this.minWidth > w)
			w = this.minWidth;
		if (this.minHeight != 0 && this.minHeight > h)
			h = this.minHeight;
		if (this.maxWidth != 0 && this.maxWidth < w)
			w = this.maxWidth;
		if (this.maxHeight != 0 && this.maxHeight < h)
			h = this.maxHeight;
		var oldW = this.width, oldH = this.height;
		this.width = w;
		this.height = h;
		if (this.width != oldW || this.height != oldH || force) {
			this._rebuildLayout();
			this.innerWidth = this.width - 1;
			this.innerHeight = this.height - 2 - $(this.container).find(".win-caption").height();
			this._callEvent("resize", [ this, this.width, this.height, this.innerWidth, this.innerHeight ]);
		}
	};

	this.move = function(x, y, force) {
		if (0 > x)
			x = 0;
		if (0 > y)
			y = 0;
		if (x > (window.innerWidth - this.width))
			x = (window.innerWidth - this.width);
		if (y > (window.innerHeight - this.height))
			y = (window.innerHeight - this.height);

		var oldX = this.x, oldY = this.y;
		this.x = x;
		this.y = y;
		if (this.x != oldX || this.y != oldY || force) {
			this._rebuildLayout();
			this._callEvent("move", [ this, this.x, this.y ]);
		}
	}

	this.subscribe = function(event, callback) {
		if (this.events[event] === undefined || this.events[event] === null)
			this.events[event] = [];
		this.events[event].push(callback);
	};

	this._callEvent = function(event, args) {
		if (this.events[event] !== undefined && this.events[event] !== null) {
			var subscribers = this.events[event];
			for (var i = 0; i < subscribers.length; i++)
				subscribers[i].apply(subscribers[i], args);
		}
	};

	this._rebuildLayout = function() {
		this.container.css("top", this.y + "px");
		this.container.css("left", this.x + "px");
		this.container.width(this.width);
		this.container.height(this.height);
	};

}