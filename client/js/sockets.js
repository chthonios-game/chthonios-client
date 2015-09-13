"use strict";

function Packet(uid, payloads) {
	this.timestamp = new Date().getTime();
	this.uid = uid;
	this.payloads = payloads;

	this.serialize = function() {
		return jsonify({
			timestamp : this.timestamp,
			uid : this.uid,
			msgs : this.payloads
		});
	}

	this.deserialize = function(str) {
		var blob = jsonParse(str);
		this.timestamp = blob.timestamp;
		this.uid = blob.uid;
		this.payloads = msgs;
	}
}

/**
 * Memory-buffered auto-recovering WebSocket wrapper.
 */
function Socket(domain) {
	/** The request domain path */
	this.domain = domain;
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
			this._socket.close();
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
		this._socket.close(code, data);
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
		if (!data instanceof Packet)
			data = new Packet(this.uid, data);
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
		console.log(domain, "socket closing");
		// If we never handshook OK, don't fire closed event
		if (this._ready)
			this._fireCallbacks("close", arguments);
		this._ready = false;
		if (!this._gracefulClose)
			this._handleUngracefulClose();
	}

	this._handleEvtError = function() {
		console.log(domain, "socket error");
		// If we never handshook OK, don't fire error event
		if (this.ready)
			this._fireCallbacks("error", arguments);
		this._ready = false;
		if (!this._gracefulClose)
			this._handleUngracefulClose();
	}

	this._handleEvtMessage = function(message) {
		var packet = new Packet(this.uid, null);
		packet.deserialize(message);
		if (packet.payloads.length == 1) {
			var payload = packet.payloads[0];
			if (payload.type == "handshake") {
				this._handleHandshakeResponse(payload);
				return;
			}
		}
		this._fireCallbacks("message", arguments);
		this._fireCallbacks("packet", packet);
	}

	this._dispatchHandshakeStatement = function() {
		console.log(domain, "dispatching network handshake");
		var blob = new Packet(this.uid, [ {
			type : "handshake",
			accessToken : this.accessToken,
			clientToken : this.clientToken
		} ]);
		this._socket.send(blob.serialize());
	}

	this._handleHandshakeResponse = function(payload) {
		if (!payload.result) {
			console.log(domain, "handshake authentication error");
			this._fireCallbacks("error", []);
			// Hang up; the server will not listen anymore. :(
			this._socket.close(1002);
		} else {
			this._fireCallbacks("open", arguments);
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