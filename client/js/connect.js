// Display objects
var canvas, stage;
// Websocket objects
var wsConnection, wsQueue;
// Non-static data object
var entities = {player: {self: {uuid: 0, x: 0, y: 0, tileID: 0}, other: {}}};

function init() {
    if ("WebSocket" in window) {
        // Get the canvas object
        canvas = document.getElementById('canvas');
        stage = new createjs.Stage(canvas);

        // Reset/prime the queue
        resetQueue();

        // Open the websocket
        newWebSocketConnection();

        // Register event listeners
        addEventListeners();

        // Resize the window for the first time
        resizeCanvas();

        // Do initial map draw
        drawCanvasBackground();
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
    createjs.Ticker.addEventListener("tick", function () {
        stage.update();
    });
}
function drawCanvasBackground() {
    var width = Math.round(canvas.offsetWidth / 32) + 1;
    var height = Math.round(canvas.offsetHeight / 32) + 1;

    for (var y = 0; y < height; y++) {
        for (var x = 0; x < width; x++) {
            var tile = new createjs.Bitmap('tiles/environment/Soil.png');
            tile.x = x * 32;
            tile.y = y * 32;
            stage.addChild(tile);
        }
    }
}
function drawPlayer() {
    var tile = new createjs.Bitmap('tiles/environment/Tower1.png');
    tile.x = entities.player.self.x * 32;
    tile.y = entities.player.self.y * 32;
    if (entities.player.self.tileID !== 0) {
        stage.removeChildAt(entities.player.self.tileID);
    }
    stage.addChild(tile);
    entities.player.self.tileID = stage.getChildIndex(tile);
}
function drawOtherPlayers() {
    for (var id in entities.player.other) {
        var tile = new createjs.Bitmap('tiles/environment/Tower1.png');
        tile.x = entities.player.other[id].x * 32;
        tile.y = entities.player.other[id].y * 32;
        tile.name = id;
        if (entities.player.other[id].tileID !== null && typeof entities.player.other[id].tileID !== 'undefined') {
            stage.removeChildAt(entities.player.other[id].tileID);
        }
        stage.addChild(tile);
        entities.player.other[id].tileID = stage.numChildren - 1;
    }
}
function resizeCanvas() {
    if (canvas.width !== window.innerWidth || canvas.height !== window.innerHeight) {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        if (wsConnection.readyState === 1) {
            processQueue();
        }
        drawCanvasBackground();
        drawPlayer();
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
function updateOtherPlayers(player) {
    for (var id in player) {
        if (entities.player.other[id] !== null && typeof entities.player.other[id] !== 'undefined') {
            entities.player.other[id].x = player[id].x;
            entities.player.other[id].y = player[id].y;
        } else {
            entities.player.other[id] = player[id];
        }
    }
}
function setPlayerPosition(x, y) {
    entities.player.self.x = x;
    entities.player.self.y = y;
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