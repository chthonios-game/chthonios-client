// Display objects
var canvas, canvasCache, stage;
// Websocket objects
var wsConnection, wsQueue;

// TODO not correctly setting uuid in cookies
var playerUuid = generateUUID();

// Non-static data object
var entities = {
	'player': 
	{ 
		'self': 
			{ 
				// TODO: only the first section of uuid before the dash is being passed to server
				// (or possibly the bug is in the server code)
				'uuid': playerUuid,
				'x': 0,
				'y': 0,
				'tileID': createjs.UID.get(),
				'tile' : undefined
			}, 
		other: 
			{
			}
	}
};


// these should probably be changed to event.keyCode numbers
var keyBindings = {
    'i' : 'Up',
    'k' : 'Down',
    'j' : 'Left',
    'l' : 'Right'
};

// the pixel offset of the screen (i.e., the center of the screen where the player is drawn)
// set on reDrawCanvasBackground()
var screenOffsetX = 0;
var screenOffsetY = 0;

// milliseconds between movement, lower is faster
var playerSpeed = 75;
// last time player was moved, move this into the player object.
var lastMovement = (new Date).getTime();

// whether a key is currently being pressed.
var pressedKeys = {
};

var monsters = {};
var objects  = {};

function init() {
    if ("WebSocket" in window) {
        // Get the canvas object
        canvas = document.getElementById('canvas');
        canvasCache = [];
        stage = new createjs.Stage(canvas);

        // Reset/prime the queue
        resetQueue();

        // Open the websocket
        newWebSocketConnection();

        // Register event listeners
        addEventListeners();

        // Resize the window for the first time
        resizeCanvas();
    } else
    {
        // Alert the user that their browser isn't supported
        alert("Your browser doesn't support WebSocket\nPlease download the latest version of\nGoogle Chrome or Mozilla Firefox to play");
    }
}

function addEventListeners() {
    initMouseListeners();

    initKeyboardListeners();

    initWebSocketListeners();

    initCreateJSTickHandler();

    initWindowResizeListener();
}

function initWindowResizeListener() {
    if (window.addEventListener) {
        window.addEventListener('resize', resizeCanvas, false);
    } else if (window.attachEvent) {
        window.attachEvent('onresize', resizeCanvas);
    } else {
        window.onresize = resizeCanvas;
    }
}

function initCreateJSTickHandler() {
    //createjs.Ticker.addEventListener("tick", function () {
        //stage.update();
    //});
}

function reDrawCanvasBackground() {
    var width = Math.round(canvas.offsetWidth / 32) + 1;
    var height = Math.round(canvas.offsetHeight / 32) + 1;
		
	screenOffsetX = canvas.offsetWidth / 2;
	screenOffsetY = canvas.offsetHeight / 2;

    var iterations = canvasCache.length;
    for (var i = 0; i < iterations; i++) {
        stage.removeChildAt(stage.getChildIndex(stage.getChildByName(canvasCache.pop())));
    }

    for (var y = 0; y < height; y++) {
        for (var x = 0; x < width; x++) {
            var tile = new createjs.Bitmap('tiles/environment/Soil.png');
            tile.x = x * 32;
            tile.y = y * 32;
            tile.name = "x" + x + "y" + y;

            stage.addChild(tile);
            canvasCache.push(tile.name);
        }
    }
}

// TODO put this in an playerInit() function
entities.player.self.tile = new createjs.Bitmap('tiles/environment/Tower1.png');

function drawPlayer() {
    entities.player.self.tile.x = entities.player.self.x * 32;
    entities.player.self.tile.y = entities.player.self.y * 32;
    if (entities.player.self.tileID !== 0) {
        stage.removeChildAt(entities.player.self.tileID);
    }
    stage.addChild(entities.player.self.tile);
    //entities.player.self.tileID = stage.getChildIndex(playerTile);
}

function createOtherPlayerTile(playerId) {
	entities.player.other[playerId].tileID = createjs.UID.get();
    var tile = new createjs.Bitmap('tiles/environment/Tower1.png');
    tile.x = entities.player.other[playerId].x * 32;
    tile.y = entities.player.other[playerId].y * 32;
	entities.player.other[playerId].tile = tile;
    stage.addChild(tile) = entities.player.other[playerId].tile;
}

function resizeCanvas() {
    if (canvas.width !== window.innerWidth || canvas.height !== window.innerHeight) {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        if (wsConnection.readyState === 1) {
            processQueue();
        }
        reDrawCanvasBackground();
        drawPlayer();
		drawOtherPlayers();
    }
}

function initMouseListeners() {
    if (canvas.addEventListener) {
        canvas.addEventListener('click', mouseEvent, false);
        canvas.addEventListener('contextmenu', mouseEvent, false);
    } else if (canvas.attachEvent) {
        canvas.attachEvent('onclick', mouseEvent);
        canvas.attachEvent('oncontextmenu', mouseEvent);
    } else {
        canvas.onclick = mouseEvent;
        canvas.oncontextmenu = mouseEvent;
    }
}

function mouseEvent(e) {
    if (!e) {
        e = event;
    }
    e.preventDefault();
    var click = {
        x: ((e.clientX - canvas.getBoundingClientRect().left) / 32).toFixed(1),
        y: ((e.clientY - canvas.getBoundingClientRect().top) / 32).toFixed(1)
    };
    sendMessage("click", click);
}

function getMousePos(e) {
    if (!e) {
        e = event;
    }
    return {
        x: e.clientX - canvas.getBoundingClientRect().left,
        y: e.clientY - canvas.getBoundingClientRect().top
    };
}

function initKeyboardListeners() {

    if (document.addEventListener)
    {
        document.addEventListener("keydown", keyEvent, false);
        document.addEventListener("keypress", keyEvent, false);
        document.addEventListener("keyup", keyEvent, false);
    } else if (document.attachEvent) {
        document.attachEvent("onkeydown", keyEvent);
        document.attachEvent("onkeypress", keyEvent);
        document.attachEvent("onkeyup", keyEvent);
    } else {
        document.onkeydown = keyEvent;
        document.onkeypress = keyEvent;
        document.onkeyup = keyEvent;
    }
}

function keyEvent(e) {
    if (!e) {
        e = event;
    }
    if (e.type === 'keydown') {
		pressedKeys[e.which] = 1;		
        if (e.keyIdentifier === 'Up' || e.keyIdentifier === 'Down' || e.keyIdentifier === 'Left' || e.keyIdentifier === 'Right') {
            sendMessage("key", e.keyIdentifier);
        } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
            sendMessage("key", e.key.substring(5));
        } else if (e.which < 32) {
            sendMessage("key", getKeyValueFromCode(e.which));
        }
    } else if (e.which >= 32 && e.type === 'keypress') {
        sendMessage("key", getKeyValueFromCode(e.which));
    }
	if (e.type === 'keyup'){
		delete pressedKeys[e.which];
	}
}
function getKeyValueFromCode(code) {
    if (code === 'undefined') {
        return 'undefined';
    }
    if (code >= 32 && code < 127) {
        return String.fromCharCode(code);
    }
    return code;
}

function initWebSocketListeners() {
    wsConnection.onopen = function () {
        console.log('Socket open');
    };

    wsConnection.onclose = function () {
        console.log('Socket closed');
    };

    wsConnection.onerror = function (err) {
        console.log("Error: " + err);
    };

    wsConnection.onmessage = function (message)
    {
        var data = JSON.parse(message.data);
        setPlayerPosition(data.x, data.y);
        if (data.other !== null && typeof data.other !== 'undefined') {
            updateOtherPlayers(data.other);
        }
    };
}
function updateOtherPlayers(players) {
    for (var id in players) {
        if (entities.player.other[id] !== null && typeof entities.player.other[id] !== 'undefined') {
            entities.player.other[id].x = players[id].x;
            entities.player.other[id].y = players[id].y;
        } else {
            entities.player.other[id] = players[id];
			createOtherPlayerTile(id);
        }
    }
	//drawOtherPlayers();
}
function setPlayerPosition(x, y) {
    entities.player.self.x = x;
    entities.player.self.y = y;
	stage.x = (-x * 32) + screenOffsetX;
	stage.y = (-y * 32) + screenOffsetY;
    drawPlayer();
}
function sendMessage(key, value) {
    if (wsConnection.readyState !== 1) {
        if (wsConnection.readyState !== 1) {
            newWebSocketConnection();
        }
    }
    addToQueue(key, value);
    if (wsConnection.readyState === 1) {
        processQueue();
    }
}
function newWebSocketConnection() {
    wsConnection = new WebSocket("ws://localhost:1357");
}
function addToQueue(key, value) {
    wsQueue[key] = value;
}
function processQueue() {
    wsConnection.send(JSON.stringify(wsQueue));
    if (wsConnection.readyState === 1) {
        resetQueue();
    }
}
function resetQueue() {
    if (entities.player.self.uuid === 0) {
        getUUIDFromCookie();
    }
    wsQueue = {uuid: entities.player.self.uuid};
}

function generateUUID() {
    var d = new Date().getTime();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        var r = (d + Math.random() * 16) % 16 | 0;
        d = Math.floor(d / 16);
        return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
}
function getUUIDFromCookie() {
    var cookies = document.cookie.split(';');
    for (var i = 0; i < cookies.length; i++) {
        var values = cookies[i].trim().split('=');
        if (values[0] === 'uuid') {
            entities.player.self.uuid = values[1];
        }
    }
    if (entities.player.self.uuid === null || typeof entities.player.self.uuid === 'undefined') {
        entities.player.self.uuid = generateUUID();
        document.cookie = "uuid=" + entities.player.self.uuid;
    }
}

//*********************************************************
// The main gameloop
// Redraws every tick
// checks for player movements at intervals
// 
// Possibly this is better handled by the eisle.js library
//
var Game = {};

Game.run = (function() {
  var loops = 0, skipTicks = 1000 / Game.fps,
      maxFrameSkip = 10,
      nextGameTick = (new Date).getTime();
  
  return function() {
    loops = 0;
    
	

    // skips frames if the framerate drops
    while ((new Date).getTime() > nextGameTick && loops < maxFrameSkip) {
	//// State updates should be handled only by ws events?
      nextGameTick += skipTicks;
      loops++;
    }
    
	currentTime = (new Date).getTime();
	// is the player allowed to move
	if (currentTime - lastMovement > playerSpeed){
		//console.log("ready to move");
		//console.log('uuid' + entities.player.self.uuid);
		// are any of the movement keys pressed
		for (var pk in pressedKeys){
			var pkChar = String.fromCharCode(pk).toLowerCase();
			//console.log("pressed key: " + pkChar);
			if (pkChar in keyBindings){
				//console.log(keyBindings[pkChar] + " is pressed");
				lastMovement = currentTime;
				sendMessage('key', keyBindings[pkChar]);
			}
		}
	}


	//console.log("drawing...");
    stage.update();
    //Game.draw();
  };
})();

// Start the game loop
Game._intervalId = setInterval(Game.run, 0);

// limits the framerate
(function() {
  var onEachFrame;
  if (window.webkitRequestAnimationFrame) {
    onEachFrame = function(cb) {
      var _cb = function() { cb(); webkitRequestAnimationFrame(_cb); }
      _cb();
    };
  } else if (window.mozRequestAnimationFrame) {
    onEachFrame = function(cb) {
      var _cb = function() { cb(); mozRequestAnimationFrame(_cb); }
      _cb();
    };
  } else {
    onEachFrame = function(cb) {
      setInterval(cb, 1000 / 60);
    }
  }
  
  window.onEachFrame = onEachFrame;
})();

window.onEachFrame(Game.run);
