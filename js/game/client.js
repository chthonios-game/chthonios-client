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
				console.error(e);
			}
		}
		__callable();
		return __callable;
	}

	if (window.requestAnimationFrame)
		return decorate(fn, window.requestAnimationFrame);
	if (window.webkitRequestAnimationFrame)
		return decorate(fn, window.webkitRequestAnimationFrame);
	if (window.mozRequestAnimationFrame)
		return decorate(fn, window.mozRequestAnimationFrame);
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
	canvasCache : null,
	stage : null,
	camera : null,

	/** Websocket objects */
	socket : null,

	/** Status overlay */
	status : null,

	/** The world loader */
	virtWorld : null,

	entities : {
		player : {
			self : {
				'x' : 0,
				'y' : 0,
				'tileID' : createjs.UID.get(),
				'tile' : undefined
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
	loops : 0,
	fps : 60,
	maxFrameSkip : 10,
	nextGameTick : 0,

	boot : function(token, secret) {
		console.log(">> boot");
		// Get the canvas object
		this.canvas = document.getElementById('canvas');
		this.canvasCache = [];
		this.stage = new createjs.Stage(this.canvas);
		this.camera = new Camera();

		// TODO put this in an playerInit() function
		this.entities.player.self.tile = new createjs.Bitmap('tiles/environment/Tower1.png');

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

		// Register event listeners
		this.addEventListeners();
		// Resize the window for the first time
		this.resizeCanvas();
		// Boot the game loop
		window.onEachFrame(decoratedCallback(Game.run, Game));

		// Boot the socket
		this.socket.open();
	},

	/**
	 * Connect all event listeners. Sets up window events, keyboard events and
	 * mouse events.
	 */
	addEventListeners : function() {

		if (window.addEventListener) {
			window.addEventListener('resize', decoratedCallback(this.resizeCanvas, this), false);
		} else if (window.attachEvent) {
			window.attachEvent('onresize', decoratedCallback(this.resizeCanvas, this));
		} else {
			window.onresize = decoratedCallback(this.resizeCanvas, this);
		}

		if (canvas.addEventListener) {
			canvas.addEventListener('click', decoratedCallback(this.handleMouseEvent, this), false);
			canvas.addEventListener('contextmenu', decoratedCallback(this.handleMouseEvent, this), false);
		} else if (canvas.attachEvent) {
			canvas.attachEvent('onclick', decoratedCallback(this.handleMouseEvent, this));
			canvas.attachEvent('oncontextmenu', decoratedCallback(this.handleMouseEvent, this));
		} else {
			canvas.onclick = decoratedCallback(this.handleMouseEvent, this);
			canvas.oncontextmenu = decoratedCallback(this.handleMouseEvent, this);
		}

		if (document.addEventListener) {
			document.addEventListener("keydown", decoratedCallback(this.handleKeyEvent, this), false);
			document.addEventListener("keypress", decoratedCallback(this.handleKeyEvent, this), false);
			document.addEventListener("keyup", decoratedCallback(this.handleKeyEvent, this), false);
		} else if (document.attachEvent) {
			document.attachEvent("onkeydown", decoratedCallback(this.handleKeyEvent, this));
			document.attachEvent("onkeypress", decoratedCallback(this.handleKeyEvent, this));
			document.attachEvent("onkeyup", decoratedCallback(this.handleKeyEvent, this));
		} else {
			document.onkeydown = decoratedCallback(this.handleKeyEvent, this);
			document.onkeypress = decoratedCallback(this.handleKeyEvent, this);
			document.onkeyup = decoratedCallback(this.handleKeyEvent, this);
		}
	},

	/**
	 * Repaint the canvas (?)
	 */
	reDrawCanvasBackground : function() {
		var width = Math.round(this.canvas.offsetWidth / 32) + 1;
		var height = Math.round(this.canvas.offsetHeight / 32) + 1;

		this.camera.updateViewport(this.canvas.offsetWidth, this.canvas.offsetHeight);

		var iterations = this.canvasCache.length;
		for (var i = 0; i < iterations; i++) {
			this.stage.removeChildAt(this.stage.getChildIndex(this.stage.getChildByName(this.canvasCache.pop())));
		}

		for (var y = 0; y < height; y++) {
			for (var x = 0; x < width; x++) {
				var tile = new createjs.Bitmap('tiles/environment/Soil.png');
				tile.x = x * 32;
				tile.y = y * 32;
				tile.name = "x" + x + "y" + y;

				this.stage.addChild(tile);
				this.canvasCache.push(tile.name);
			}
		}
	},

	/**
	 * Draw the self player
	 */
	drawPlayer : function() {
		this.entities.player.self.tile.x = this.entities.player.self.x * 32;
		this.entities.player.self.tile.y = this.entities.player.self.y * 32;
		if (this.entities.player.self.tileID !== 0) {
			this.stage.removeChildAt(this.entities.player.self.tileID);
		}
		this.stage.addChild(this.entities.player.self.tile);
		// entities.player.self.tileID = stage.getChildIndex(playerTile);
	},

	/**
	 * Create another player tile
	 * 
	 * @param playerId
	 *            unknownparam1
	 */
	createOtherPlayerTile : function(playerId) {
		this.entities.player.other[playerId].tileID = createjs.UID.get();
		var tile = new createjs.Bitmap('tiles/environment/Tower1.png');
		tile.x = entities.player.other[playerId].x * 32;
		tile.y = entities.player.other[playerId].y * 32;
		this.entities.player.other[playerId].tile = tile;
		this.stage.addChild(tile);
	},

	/**
	 * Resize the game canvas. (also do other stuff??)
	 */
	resizeCanvas : function() {
		if (this.canvas.width !== window.innerWidth || this.canvas.height !== window.innerHeight) {
			this.canvas.width = window.innerWidth;
			this.canvas.height = window.innerHeight;
			this.reDrawCanvasBackground();
			this.drawPlayer();
			// drawOtherPlayers();
		}
	},

	/**
	 * Handle mouse input
	 * 
	 * @param e
	 *            The mouse event, if any
	 */
	handleMouseEvent : function(e) {
		if (!e)
			e = event;
		e.preventDefault();
		var click = {
			x : ((e.clientX - this.canvas.getBoundingClientRect().left) / 32).toFixed(1),
			y : ((e.clientY - this.canvas.getBoundingClientRect().top) / 32).toFixed(1)
		};
		this.sendMessage("click", click);
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
	 * Handle keyboard input
	 * 
	 * @param e
	 *            The keyboard event, if any
	 */
	handleKeyEvent : function(e) {
		if (!e)
			e = event;
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
				if (this.virtWorld != null)
					this.virtWorld.close();
				this.virtWorld = new ClientWorld(this, payload.uid);
				this.virtWorld.init();
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
		this.camera.focusOnGameCoords(x, y);
		this.drawPlayer();
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

	run : function() {
		// skips frames if the framerate drops
		while ((new Date).getTime() > this.nextGameTick && this.loops < this.maxFrameSkip) {
			// State updates should be handled only by ws events?
			console.log("frame skip on");
			this.nextGameTick += (1000 / this.fps);
			this.loops++;
		}

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

		if (this.virtWorld != null)
			this.virtWorld.cacheChunks();

		var interpCameraView = this.camera.getInterpolatedPosition();
		this.stage.x = interpCameraView.x;
		this.stage.y = interpCameraView.y;
		this.stage.update();

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
		// Game.draw();
	}
};