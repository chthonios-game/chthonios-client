"use strict";

function Packet(payloads) {
	this.timestamp = new Date().getTime();
	this.payloads = payloads;

	this.serialize = function() {
		return JSON.stringify({
			timestamp : this.timestamp,
			msgs : this.payloads
		});
	}

	this.deserialize = function(str) {
		var blob = JSON.parse(str);
		this.timestamp = blob.timestamp;
		this.payloads = blob.msgs;
	}
}

/**
 * Memory-buffered auto-recovering WebSocket wrapper.
 */
function Socket(domain, accessToken, clientToken) {

	this.CODE_PROTO_ERROR = 3001;
	this.CODE_HANDSHAKE_ERR = 3002;

	this.CODE_DISCONNECT = 3003;

	/** The request domain path */
	this.domain = domain;

	this.accessToken = accessToken;
	this.clientToken = clientToken;

	/** The callbacks registered on this socket's events */
	this.callbacks = {
		opening : [],
		open : [],
		close : [],
		error : [],
		message : [],
		packet : []
	};

	this._socket = null;
	this._ready = false;
	this._gracefulClose = false;
	this._retry = null;
	this._handshakeTimer = null;
	this._pendingPackets = [];

	/**
	 * Bind a callback function to an event type.
	 * 
	 * @param event
	 *            The event type
	 * @param fn
	 *            The function
	 */
	this.bind = function(event, fn) {
		assert(this.callbacks[event], "No such event type");
		this.callbacks[event].push(fn);
	}

	/**
	 * Open the connection. If the connection is already opened, the previous
	 * connection is closed.
	 */
	this.open = function() {
		if (this._retry != null)
			clearTimeout(this._retry);
		if (this._socket != null && this._socket.readyState == WebSocket.OPEN)
			this._socket.close(this.CODE_DIS);
		this._gracefulClose = false;
		this._ready = false;
		console.log(domain, "opening connection");
		this._handleEvtOpening();
		this._socket = new WebSocket(this.domain);
		this._socket.onopen = decoratedCallback(this._handleEvtOpen, this);
		this._socket.onclose = decoratedCallback(this._handleEvtClose, this);
		this._socket.onerror = decoratedCallback(this._handleEvtError, this);
		this._socket.onmessage = decoratedCallback(this._handleEvtMessage, this);
	}

	/**
	 * Closes the connection
	 * 
	 * @param code
	 *            The status code to send to the server
	 * @param data
	 *            The final data payload to send to the server, if any
	 */
	this.close = function(code, data) {
		console.log(domain, "software requested close", code, data);
		this._gracefulClose = true;
		this._socket.close(code, JSON.stringify(data));
	}

	/**
	 * Check if the socket is ready to send data. The socket can accept data if
	 * the underlying socket is not ready to send data to a server.
	 * 
	 * @returns If the socket is ready to send data.
	 */
	this.ready = function() {
		if (this._socket == null)
			return false;
		return this._ready && this._socket.readyState == WebSocket.OPEN;
	}

	/**
	 * <p>
	 * Send a data payload to the server via the underlying socket. If the
	 * socket is not currently open, then the payload will be buffered and
	 * replayed when the underlying socket is ready to send data.
	 * </p>
	 * <p>
	 * If the payload is not a Packet, the payload is wrapped inside a Packet
	 * container and is dispatched. Else, the packet is dispatched as-is.
	 * </p>
	 */
	this.send = function(data) {
		if (!(data instanceof Packet))
			data = new Packet(data);
		if (!this.ready())
			this._pendingPackets.push(data);
		else
			this._socket.send(data.serialize());
	}

	this._fireCallbacks = function(event, args) {
		var callbacks = this.callbacks[event];
		for (var i = 0; i < callbacks.length; i++) {
			var callback = callbacks[i];
			try {
				callback.apply(this, args);
			} catch (e) {
				// TODO: Log exception somewhere, continue gracefully!
			}
		}
	}

	this._handleUngracefulClose = function() {
		if (this._retry != null)
			return;
		console.log(domain, "socket closed unexpectedly");
		this._retry = setTimeout(decoratedCallback(function() {
			console.log(domain, "attempting to restore connection");
			this._retry = null;
			this.open();
		}, this), 1000);
	}

	this._handleEvtOpening = function() {
		console.log(domain, "socket opening");
		this._fireCallbacks("opening", arguments);
	}

	this._handleEvtOpen = function() {
		console.log(domain, "socket opened");
		this._dispatchHandshakeStatement();
	}

	this._handleEvtClose = function() {
		var code = arguments[0].code;
		console.log(domain, "socket closing");
		if (code != 1000 && code != 1001 && code != this.CODE_DISCONNECT) {
			console.error(domain, "error close reason", code);
			this._fireCallbacks("error", arguments);
		}
		if (this._ready)
			this._fireCallbacks("close", arguments);
		this._ready = false;
		if (code != this.CODE_DISCONNECT && !this._gracefulClose)
			this._handleUngracefulClose();
	}

	this._handleEvtError = function() {
		console.error(domain, "socket error");
		this._ready = false;
		if (!this._gracefulClose)
			this._handleUngracefulClose();
	}

	this._handleEvtMessage = function(message) {
		var typeofz = message.type;
		if (typeofz == "message") {
			var chunk = message.data;
			this._fireCallbacks("message", [ chunk ]);
			var packet = new Packet(null);
			packet.deserialize(chunk);
			if (packet.payloads.length == 1) {
				var payload = packet.payloads[0];
				if (payload.type == "handshake") {
					this._handleHandshakeResponse(payload);
					return;
				}
			}
			this._fireCallbacks("packet", [ packet ]);
		} else
			console.error(this.toString(), "unexpected payload type", typeofz);
	}

	this._dispatchHandshakeStatement = function() {
		console.log(domain, "dispatching network handshake");
		var blob = new Packet([ {
			type : "handshake",
			accessToken : this.accessToken,
			clientToken : this.clientToken
		} ]);
		this._socket.send(blob.serialize());
		this._handshakeTimer = setTimeout(decoratedCallback(function() {
			console.error(domain, "no handshake reply from server");
			this._fireCallbacks("error", []);
			this._socket.close(this.CODE_HANDSHAKE_ERR);
		}, this), 15000);
	}

	this._handleHandshakeResponse = function(payload) {
		clearTimeout(this._handshakeTimer);
		console.log(domain, "handshake result", payload);
		if (payload.result != "200") {
			console.error(domain, "handshake authentication error");
			if (payload.message != undefined && payload.message != null)
				console.error(domain, "the server says:", payload.message);
			this._fireCallbacks("error", []);
			// Hang up; the server will not listen anymore. :(
			this._socket.close(this.CODE_DISCONNECT);
		} else {
			console.log(domain, "handshake authentication success");
			this._fireCallbacks("open", arguments);
			this._ready = true;
			this._retry = null;
			if (this._pendingPackets.length != 0) {
				var data = this._pendingPackets;
				this._pendingPackets = [];
				for (var i = 0; i < data.length; i++)
					this._socket.send(data[i].serialize());
			}
		}
	}
}