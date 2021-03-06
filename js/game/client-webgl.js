"use strict";
/**
 * Decorator function for each-frame function call-backs.
 * 
 * @param fn The function object
 * @param fncontext The function `this` scope
 */
window.onEachFrame = function(fn) {
	function decorate(afn, renderfn) {
		var __callable = function() {
			try {
				afn();
				renderfn(__callable);
			} catch (e) {
				console.error("window.onEachFrame", "__callable", "callback error", e);
			}
		}
		__callable();
		return __callable;
	}

	if (window.requestAnimationFrame) {
		console.log("window.onEachFrame", "Using window.requestAnimationFrame support");
		return decorate(fn, window.requestAnimationFrame);
	}
	if (window.webkitRequestAnimationFrame) {
		console.log("window.onEachFrame", "Using window.webkitRequestAnimationFrame support");
		return decorate(fn, window.webkitRequestAnimationFrame);
	}
	if (window.mozRequestAnimationFrame) {
		console.log("window.onEachFrame", "Using window.mozRequestAnimationFrame support");
		return decorate(fn, window.mozRequestAnimationFrame);
	}
	console.log("window.onEachFrame", "Using fallback renderer queue support");
	return decorate(fn, function(q) {
		setTimeout(q, 1000 / 60);
	});
};

/**
 * The game main instance.
 */
var Game = {
	/** Display objects */
	canvas : null,
	dwin : null,
	g2d : null,
	rb : null,
	defaultFont : null,
	titleTexture : null,

	/** Websocket objects */
	socket : null,

	/** Asset manager */
	assets : null,

	/** Status overlay */
	status : null,

	setup : true,

	/** The world loader */
	virtWorld : null,

	/** System timer */
	timer : null,

	// these should probably be changed to event.keyCode numbers
	keyBindings : {
		'i' : 'Up',
		'k' : 'Down',
		'j' : 'Left',
		'l' : 'Right'
	},

	// milliseconds between movement, lower is faster
	playerSpeed : 75,
	// last time player was moved, move this into the player object.
	lastMovement : (new Date).getTime(),

	// whether a key is currently being pressed.
	pressedKeys : {},

	// render properties
	fps : 60,

	init : function(loader, cb) {
		this.canvas = document.getElementById("canvas");
		this.dwin = scaffold.findWindow(this.canvas);
		this.assets = loader;
		this.g2d = new g2d(canvas);
		this.g2d.init();

		this.rb = new RenderBatch(this);
		this.timer = new g2d.timer(this.g2d, 20, 10);

		// Register event listeners
		this.addEventListeners();

		// Boot the game
		this.assets.loadResourcesFromFile("settings/boot.json", decoratedCallback(function() {
			this.boot(cb);
		}, this));
	},

	login : function(token, secret) {
		// Prepare the nework stuff
		this.socket = new Socket("ws://localhost:1357", token, secret);
		// TODO replace this with network handling good stuff
		this.socket.channel("general", decoratedCallback(this.handlePacket, this));

		this.socket.bind("opening", decoratedCallback(function() {
			this.status = "Connecting to the server...";
		}, this));

		this.socket.bind("open", decoratedCallback(function() {
			this.status = null;
		}, this));

		this.socket.bind("error", decoratedCallback(function() {
			this.status = "Connection to server lost, reconnecting...";
		}, this));

		// Start the game now
		Future.forever(decoratedCallback(Game.runNonRenderTick, Game));
		window.onEachFrame(decoratedCallback(Game.run, Game));
		this.connect();
	},

	boot : function(cb) {
		var fragment = this.assets.getAsset("shaders/default.frag");
		var vertex = this.assets.getAsset("shaders/default.vert");
		this.g2d.buildSystemResources();
		this.g2d.loadVideoDefaults();
		var program = this.g2d.generateShaderProgram(fragment, vertex);
		this.g2d.useShaderProgram(program);
		this.cbResizeCanvas(this.dwin, this.dwin.width, this.dwin.height, this.dwin.innerWidth, this.dwin.innerHeight);

		var gl = this.g2d.gl;

		/**
		 * This used to be handled as so -
		 * 
		 * Array.apply(null, Array(73728 * 3)).map(Number.prototype.valueOf, 0);
		 * 
		 * Array.apply(null, Array(73728 * 2)).map(Number.prototype.valueOf, 0)
		 */
		var vfill0 = [], vfill1 = [], fifill = [];
		for (var i = 0; i < 73728; i++) {
			var q = i * 4;
			fifill.push(q, q + 1, q + 2, q, q + 2, q + 3);
			for (var j = 0; j < 3; j++) {
				vfill0.push(0);
				if (j < 2)
					vfill1.push(0);
			}

		}

		for (var i = 0; i < this.g2d.BUFFERS; i++) {
			var vp = gl.createBuffer(), vn = gl.createBuffer(), vi = gl.createBuffer();
			var tc = gl.createBuffer();

			gl.bindBuffer(gl.ARRAY_BUFFER, vp);
			gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vfill0), gl.DYNAMIC_DRAW);
			gl.bindBuffer(gl.ARRAY_BUFFER, vn);
			gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vfill0), gl.DYNAMIC_DRAW);
			gl.bindBuffer(gl.ARRAY_BUFFER, tc);
			gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vfill1), gl.DYNAMIC_DRAW);
			gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, vi);
			gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(fifill), gl.DYNAMIC_DRAW);

			this.g2d.buffer.createHeap(i, {
				bufferVertPos : vp,
				bufferVertNormals : vn,
				bufferTexCoords : tc,
				bufferVertIndex : vi
			}, 73728);
		}

		this.titleTexture = this.g2d.allocator.texture("title", this.assets.getAsset("graphics/title.png"));
		this.defaultFont = new g2d.font(this.g2d, "32px sans-serif");
		this.defaultFont.init();
		this.assets.loadResourcesFromFile("settings/tileset.json", decoratedCallback(cb, this));
	},

	connect : function() {
		// Boot the socket
		this.socket.open();
	},

	/**
	 * Connect all event listeners. Sets up window events, keyboard events and mouse events.
	 */
	addEventListeners : function() {
		// Resize events are passed through the windowmgr
		this.dwin.subscribe("resize", decoratedCallback(this.cbResizeCanvas, this));

		// Keyboard events are also passed through the windowmgr
		this.dwin.subscribe("keydown", decoratedCallback(this.cbKeyEvent, this));
		this.dwin.subscribe("keyup", decoratedCallback(this.cbKeyEvent, this));

		// We must subscribe to blur and focus to understand if we are active or
		// not.
		this.dwin.subscribe("focus", decoratedCallback(this.cbFocusEvent, this));
		this.dwin.subscribe("blur", decoratedCallback(this.cbFocusEvent, this));

		// Click, mouse move, wheel, etc, are all connected to the canvas.
		if (canvas.addEventListener) {
			canvas.addEventListener('click', decoratedCallback(this.cbMouseEvent, this), false);
			canvas.addEventListener('contextmenu', decoratedCallback(this.cbMouseEvent, this), false);
			canvas.addEventListener('mousemove', decoratedCallback(this.cbMousePosition, this), false);
			canvas.addEventListener('mouseenter', decoratedCallback(this.cbMousePosition, this), false);
			canvas.addEventListener('mousewheel', decoratedCallback(this.cbMouseWheel, this), false);
		} else if (canvas.attachEvent) {
			canvas.attachEvent('onclick', decoratedCallback(this.cbMouseEvent, this));
			canvas.attachEvent('oncontextmenu', decoratedCallback(this.cbMouseEvent, this));
			canvas.attachEvent('onmousemove', decoratedCallback(this.cbMousePosition, this), false);
			canvas.attachEvent('onmouseenter', decoratedCallback(this.cbMousePosition, this), false);
			canvas.attachEvent('onmousewheel', decoratedCallback(this.cbMouseWheel, this), false);
		} else {
			canvas.onclick = decoratedCallback(this.cbMouseEvent, this);
			canvas.oncontextmenu = decoratedCallback(this.cbMouseEvent, this);
			canvas.onmousemove = decoratedCallback(this.cbMousePosition, this);
			canvas.onmouseenter = decoratedCallback(this.cbMousePosition, this);
			canvas.onmousewheel = decoratedCallback(this.cbMouseWheel, this);
		}

	},

	cbResizeCanvas : function(win, w, h, iw, ih) {
		if (this.canvas !== undefined && this.canvas !== null) {
			if (this.canvas.width !== iw || this.canvas.height !== ih) {
				this.canvas.width = iw;
				this.canvas.height = ih;
				this.g2d.resize();
			}
		}
	},

	cbMouseEvent : function(e) {
		if (!e)
			e = window.event;
		e.preventDefault();
		var click = {
			x : (e.clientX - this.canvas.getBoundingClientRect().left).toFixed(1),
			y : (e.clientY - this.canvas.getBoundingClientRect().top).toFixed(1)
		};
		console.log("Game.cbMouseEvent", click);

	},

	cbMousePosition : function(e) {
		if (!e)
			e = window.event;
		this.lastMouse = this.getMousePos(e);
	},

	cbMouseWheel : function(e) {
		if (!e)
			e = window.event;
		var delta = Math.max(-1, Math.min(1, (e.wheelDelta || -e.detail)));
		this.g2d.camera.zoomCamera(delta * 0.5);
	},

	cbKeyEvent : function(e) {
		if (!e)
			e = window.event;
		if (e.type === 'keydown') {
			this.pressedKeys[e.which] = 1;

			var id = ((e.key !== undefined && e.key !== null) ? e.key : e.keyIdentifier);
			if (id === 'Up' || id === 'Down' || id === 'Left' || id === 'Right') {
				this.handleCameraEvent("key", id);
			} else if (id === 'ArrowUp' || id === 'ArrowDown' || id === 'ArrowLeft' || id === 'ArrowRight') {
				this.handleCameraEvent("key", id.substring(5));
			} else if (e.which < 32) {
				this.handleCameraEvent("key", this.getKeyValueFromCode(e.which));
			}
		} else if (e.which >= 32 && e.type === 'keypress') {
			this.handleCameraEvent("key", this.getKeyValueFromCode(e.which));
		}
		if (e.type === 'keyup') {
			delete this.pressedKeys[e.which];
		}
	},

	cbFocusEvent : function(mode, window) {
		if (mode == "focus") {
			console.log("Game.cbFocusEvent", "game regained focus!");
		} else {
			console.log("Game.cbFocusEvent", "game lost focus!");
		}
	},

	/**
	 * Get the mouse position
	 * 
	 * @param e The mouse event, if any
	 * @returns the mouse position (should be vector_t, not __anon?)
	 */
	getMousePos : function(e) {
		if (!e)
			e = event;
		return {
			x : e.clientX - this.canvas.getBoundingClientRect().left,
			y : e.clientY - this.canvas.getBoundingClientRect().top
		};
	},

	/**
	 * Get the keyboard value from a mixed code type
	 * 
	 * @param code The code type
	 * @returns The keyboard value, or <code>"undefined"</code> if unknown
	 */
	getKeyValueFromCode : function(code) {
		if (code === 'undefined')
			return 'undefined';
		if (code >= 32 && code < 127)
			return String.fromCharCode(code);
		return code;
	},

	handleCameraEvent : function(event, value) {
		if (event == "key") {
			if (value == "w" || value == "Up") {
				this.g2d.camera.panCamera(0.5, 0.0, 0.0);
			} else if (value == "s" || value == "Down") {
				this.g2d.camera.panCamera(-0.5, 0.0, 0.0);
			} else if (value == "a" || value == "Left") {
				this.g2d.camera.panCamera(0.0, -0.5, 0.0);
			} else if (value == "d" || value == "Right") {
				this.g2d.camera.panCamera(0.0, 0.5, 0.0);
			}
		}
	},

	handlePacket : function(packet) {
		for (var i = 0; i < packet.payloads.length; i++) {
			var payload = packet.payloads[i];
			if (payload.type == "world") {
				console.log("switching game world", payload.uid);
				if (this.virtWorld != null) {
					this.rb.clearWorld();
					this.virtWorld.close();
				}
				this.virtWorld = new ClientWorld(this, payload.uid);
				this.virtWorld.init(decoratedCallback(function() {
					console.log(this);
					this.rb.setWorld(this.virtWorld);
				}, this));
			}

		}
	},

	/**
	 * Send a message to the server. Also dispatch packet(s) pending (???)
	 * 
	 * @param key the key
	 * @param value the value
	 */
	sendMessage : function(key, value) {
		this.socket.send(new Packet([ {
			type : "command",
			key : key,
			value : value
		} ]));
	},

	/**
	 * <p>
	 * Perform the main game simulation.
	 * </p>
	 * 
	 * <p>
	 * runNonRenderTick is invoked whenever Future can do so, but it might not be time for us to actually wake the
	 * world. It is also not guaranteed that Future will wake us before more than one tick has elapsed, since other
	 * workers might be executing on the Future bus. Hence, an invocation of runNonRenderTick does not necessarily
	 * equate to or represent any particular number of ticks.
	 * </p>
	 * 
	 * <p>
	 * If you need to know the number of ticks which have elapsed since the last time runNonRenderTick was called, check
	 * the elapsedTicks field in the global timer.
	 * </p>
	 */
	runNonRenderTick : function() {
		this.timer.updateTimer();

		if (this.virtWorld != null) {
			if (this.timer.elapsedTicks != 0) {
				for (var i = 0; i < this.timer.elapsedTicks; i++) {
					this.virtWorld.tickWorld();
				}
			}
			this.virtWorld.partialTickWorld(this.timer.elasedPartialTicks);
		}
	},

	run : function() {
		var currentTime = (new Date).getTime();
		// is the player allowed to move
		if (this.currentTime - this.lastMovement > this.playerSpeed) {
			// console.log("ready to move");
			// are any of the movement keys pressed
			for ( var pk in this.pressedKeys) {
				var pkChar = String.fromCharCode(pk).toLowerCase();
				// console.log("pressed key: " + pkChar);
				if (pkChar in this.keyBindings) {
					// console.log(keyBindings[pkChar] + " is pressed");
					this.lastMovement = this.currentTime;
					this.handleCameraEvent('key', this.keyBindings[pkChar]);
				}
			}
		}

		this.g2d.beginDrawing();

		this.g2d.glLighting(false);
		this.g2d.glStaticColor(false);
		this.g2d.glStaticColorMangleAlpha(false);
		this.g2d.glApplyStatic(false);
		this.g2d.glApplyMasking(false);

		this.g2d.glAlphaWeighting(1.0);
		this.g2d.glAlphaCull(0.1);
		this.g2d.glColorFill(1.0, 1.0, 1.0, 1.0);
		this.g2d.glColorMultiplier(1.0, 1.0, 1.0, 1.0);

		this.g2d.glBegin(this.g2d.GL_QUAD);
		this.g2d.glEnd();

		this.rb.repaintScene(this.lastMouse);

		this.g2d.endDrawing();

		var container = document.getElementById("status");
		if (this.status != null) {
			if (container == null) {
				container = document.createElement("div");
				container.id = "status";
				document.body.appendChild(container);
			}
			container.innerHTML = this.status;
		} else {
			if (container != null)
				document.body.removeChild(container);
		}
	}
};