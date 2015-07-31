var canvas;
var ws;
var mousePosition;
var queue;
var x, y;
var uuid;

function init() {
    // Get the canvas object
    canvas = document.getElementById('canvas');

    // Get the UUID of the user
    getUUIDFromCookie();

    // Reset/prime the queue
    resetQueue();


    if ("WebSocket" in window) {
        // Open the websocket
        ws = new WebSocket("ws://localhost:1357");

        // Register event listeners
        addEventListeners();
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
}

function initMouseListeners() {
    if (document.addEventListener) {
        canvas.addEventListener('click', mouseEvent, false);
        canvas.addEventListener('contextmenu', mouseEvent, false);
    } else if (document.attachEvent) {
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
    ws.onopen = function () {
        console.log('Socket open');
    };

    ws.onclose = function () {
        console.log('Socket closed');
    };

    ws.onerror = function (err) {
        console.log("Error: " + err);
    };

    ws.onmessage = function (message)
    {
        console.log('received: %s', message.data);
    };
}
function sendMessage(key, value) {
    if (ws.readyState !== 1) {
        if (ws.readyState !== 1) {
            ws = new WebSocket("ws://localhost:1357");
        }
    }
    addToQueue(key, value);
    if (ws.readyState === 1) {
        processQueue();
    }
}
function addToQueue(key, value) {
    queue[key] = value;
}
function processQueue() {
    ws.send(JSON.stringify(queue));
    if (ws.readyState === 1) {
        resetQueue();
    }
}
function resetQueue() {
    queue = {uuid: uuid};
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
            uuid = values[1];
        }
    }
    if (uuid === null || typeof uuid === 'undefined') {
        uuid = generateUUID();
        document.cookie = "uuid=" + uuid;
    }
}