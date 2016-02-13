"use strict";
/**
 * Decorator function for each-frame function call-backs.
 * 
 * @param fn
 *            The function object
 * @param fncontext
 *            The function `this` scope
 */
window.onEachFrame = function(fn) {
	function decorate(afn, renderfn) {
		var __callable = function() {
			try {
				afn();
				renderfn(__callable);
			} catch (e) {
				console.error("window.onEachFrame callback error", e);
			}
		}
		__callable();
		return __callable;
	}

	if (window.requestAnimationFrame) {
		console.log("Using window.requestAnimationFrame support");
		return decorate(fn, window.requestAnimationFrame);
	}
	if (window.webkitRequestAnimationFrame) {
		console.log("Using window.webkitRequestAnimationFrame support");
		return decorate(fn, window.webkitRequestAnimationFrame);
	}
	if (window.mozRequestAnimationFrame) {
		console.log("Using window.mozRequestAnimationFrame support");
		return decorate(fn, window.mozRequestAnimationFrame);
	}
	console.log("Using fallback renderer queue support");
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

	entities : {
		player : {
			self : {
				'x' : 0,
				'y' : 0
			},
			other : {}
		}
	},

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
	monsters : {},

	// render properties
	fps : 60,

	init : function(token, secret) {
		this.canvas = document.getElementById('canvas');
		this.assets = new AssetManager();
		this.g2d = new g2d(canvas);
		this.g2d.init();

		this.rb = new RenderBatch(this);

		// Register event listeners
		this.addEventListeners();

		// Prepare the nework stuff
		this.socket = new Socket("ws://localhost:1357", token, secret);
		// TODO replace this with network handling good stuff
		this.socket.bind("packet", decoratedCallback(this.handlePacket, this));

		this.socket.bind("opening", decoratedCallback(function() {
			this.status = "Connecting to the server...";
		}, this));

		this.socket.bind("open", decoratedCallback(function() {
			this.status = null;
		}, this));

		this.socket.bind("error", decoratedCallback(function() {
			this.status = "Connection to server lost, reconnecting...";
		}, this));

		// Boot the game
		this.assets.loadResourcesFromFile("settings/boot.json", decoratedCallback(this.boot, this));
	},

	boot : function() {
		var fragment = this.assets.getAsset("shaders/default.frag");
		var vertex = this.assets.getAsset("shaders/default.vert");
		var program = this.g2d.generateShaderProgram(fragment, vertex);
		this.g2d.useShaderProgram(program);
		this.cbResizeCanvas();

		var gl = this.g2d.gl;
		
		var vfill0 = Array.apply(null, Array(73728 * 3)).map(Number.prototype.valueOf, 0);
		var vfill1 = Array.apply(null, Array(73728 * 2)).map(Number.prototype.valueOf, 0);
		var fifill = [];
		for (var i = 0; i < 73728; i++) {
			var q = i * 4;
			fifill.push(q, q + 1, q + 2, q, q + 2, q + 3);
		}
		
		for (var i = 0; i < this.g2d.BUFFERS; i++) {
			var vp = gl.createBuffer(), vn = gl.createBuffer(), vi = gl.createBuffer();
			var tc = gl.createBuffer();
			
			console.log("gameBackfillBuffer", i, vfill0.length, vfill1.length);
			
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
		Future.forever(decoratedCallback(Game.runNonRenderTick, Game));
		window.onEachFrame(decoratedCallback(Game.run, Game));

		this.assets.loadResourcesFromFile("settings/tileset.json", decoratedCallback(this.connect, this));
	},

	connect : function() {
		// Boot the socket
		this.socket.open();
	},

	/**
	 * Connect all event listeners. Sets up window events, keyboard events and
	 * mouse events.
	 */
	addEventListeners : function() {
		if (window.addEventListener) {
			window.addEventListener('resize', decoratedCallback(this.cbResizeCanvas, this), false);
		} else if (window.attachEvent) {
			window.attachEvent('onresize', decoratedCallback(this.cbResizeCanvas, this));
		} else {
			window.onresize = decoratedCallback(this.cbResizeCanvas, this);
		}

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

		if (document.addEventListener) {
			document.addEventListener("keydown", decoratedCallback(this.cbKeyEvent, this), false);
			document.addEventListener("keypress", decoratedCallback(this.cbKeyEvent, this), false);
			document.addEventListener("keyup", decoratedCallback(this.cbKeyEvent, this), false);
		} else if (document.attachEvent) {
			document.attachEvent("onkeydown", decoratedCallback(this.cbKeyEvent, this));
			document.attachEvent("onkeypress", decoratedCallback(this.cbKeyEvent, this));
			document.attachEvent("onkeyup", decoratedCallback(this.cbKeyEvent, this));
		} else {
			document.onkeydown = decoratedCallback(this.cbKeyEvent, this);
			document.onkeypress = decoratedCallback(this.cbKeyEvent, this);
			document.onkeyup = decoratedCallback(this.cbKeyEvent, this);
		}
	},

	/**
	 * Repaint the canvas (?)
	 */
	reDrawCanvasBackground : function() {
		var width = Math.round(this.canvas.offsetWidth / 32) + 1;
		var height = Math.round(this.canvas.offsetHeight / 32) + 1;

		// TODO: redraw backdrops?
	},

	cbResizeCanvas : function() {
		if (this.canvas.width !== window.innerWidth || this.canvas.height !== window.innerHeight) {
			this.canvas.width = window.innerWidth;
			this.canvas.height = window.innerHeight;
			this.g2d.resize();
		}
	},

	cbMouseEvent : function(e) {
		if (!e)
			e = window.event;
		e.preventDefault();
		var click = {
			x : ((e.clientX - this.canvas.getBoundingClientRect().left) / 32).toFixed(1),
			y : ((e.clientY - this.canvas.getBoundingClientRect().top) / 32).toFixed(1)
		};
		this.sendMessage("click", click);
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
			if (e.keyIdentifier === 'Up' || e.keyIdentifier === 'Down' || e.keyIdentifier === 'Left' || e.keyIdentifier === 'Right') {
				this.sendMessage("key", e.keyIdentifier);
			} else if (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
				this.sendMessage("key", e.key.substring(5));
			} else if (e.which < 32) {
				this.sendMessage("key", this.getKeyValueFromCode(e.which));
			}
		} else if (e.which >= 32 && e.type === 'keypress') {
			this.sendMessage("key", this.getKeyValueFromCode(e.which));
		}
		if (e.type === 'keyup') {
			delete this.pressedKeys[e.which];
		}
	},

	/**
	 * Get the mouse position
	 * 
	 * @param e
	 *            The mouse event, if any
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
	 * @param code
	 *            The code type
	 * @returns The keyboard value, or <code>"undefined"</code> if unknown
	 */
	getKeyValueFromCode : function(code) {
		if (code === 'undefined')
			return 'undefined';
		if (code >= 32 && code < 127)
			return String.fromCharCode(code);
		return code;
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

		if (2 > 1)
			return;

		var data = JSON.parse(message.data);
		this.setPlayerPosition(data.x, data.y);
		if (data.other !== null && typeof data.other !== 'undefined') {
			this.updateOtherPlayers(data.other);
		}
	},

	/**
	 * Update other players
	 * 
	 * @param players
	 *            other players
	 */
	updateOtherPlayers : function(players) {
		for ( var id in players) {
			if (this.entities.player.other[id] !== null && typeof this.entities.player.other[id] !== 'undefined') {
				this.entities.player.other[id].x = players[id].x;
				this.entities.player.other[id].y = players[id].y;
			} else {
				this.entities.player.other[id] = players[id];
				this.createOtherPlayerTile(id);
			}
		}
		// drawOtherPlayers();
	},

	/**
	 * Set player position. Also redraw player (???)
	 * 
	 * @param x
	 *            new x val
	 * @param y
	 *            new y val
	 */
	setPlayerPosition : function(x, y) {
		this.entities.player.self.x = x;
		this.entities.player.self.y = y;
		this.g2d.camera.focusOnCoords(32 * x, 32 * y);
	},

	/**
	 * Send a message to the server. Also dispatch packet(s) pending (???)
	 * 
	 * @param key
	 *            the key
	 * @param value
	 *            the value
	 */
	sendMessage : function(key, value) {
		this.socket.send(new Packet([ {
			type : "command",
			key : key,
			value : value
		} ]));
	},

	runNonRenderTick : function() {

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
					sendMessage('key', this.keyBindings[pkChar]);
				}
			}
		}

		this.g2d.beginDrawing();
		
		this.g2d.glLighting(false);
		this.g2d.glStaticColor(false);
		this.g2d.glApplyMasking(false);

		this.g2d.glAlphaWeighting(1.0);
		this.g2d.glAlphaCull(0.1);
		this.g2d.glColorFill(1.0, 1.0, 1.0, 1.0);
		this.g2d.glColorMultiplier(1.0, 1.0, 1.0, 1.0);

		this.g2d.glBegin(this.g2d.GL_QUAD);
		this.g2d.glEnd();
		
		
		this.g2d.glColorFill(0.0, 0.0, 0.0, 1.0);
		this.defaultFont.paintText("TEST TEXT");
		
		this.g2d.glLighting(false);
		this.g2d.glStaticColor(false);
		this.g2d.glStaticColorMangleAlpha(false);
		this.g2d.glApplyStatic(false);
		
		this.rb.repaintScene();
		
		this.g2d.endDrawing();

		var sample = this.g2d.perf.sample();
		if (sample != null)
			console.log("FPS:", sample.frames, "MAFRAME:", sample.matime);

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