var Common = require("./common.js");
function ClientSocket(server, socket) {
	/** The callbacks registered on this socket's events */
	this.callbacks = {
		opening : [],
		open : [],
		close : [],
		error : [],
		message : [],
		packet : []
	};

	this._socket = socket;
	this._server = server;
	this._gracefulClose = false;

	this.toString = function() {
		return "ServerSocket { " + this._socket._socket.remoteAddress + ":" + this._socket._socket.remotePort + " }";
	}

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
	 * Initializes the client connection handler.
	 */
	this.init = function() {
		console.log(this, "opening connection");
		this._handleEvtOpening();
		this._socket.onopen = Common.decoratedCallback(this._handleEvtOpen, this);
		this._socket.onclose = Common.decoratedCallback(this._handleEvtClose, this);
		this._socket.onerror = Common.decoratedCallback(this._handleEvtError, this);
		this._socket.onmessage = Common.decoratedCallback(this._handleEvtMessage, this);
	}

	/**
	 * Closes the connection. The client is disconnected gracefully
	 * 
	 * @param code
	 *            The status code to send to the server
	 * @param data
	 *            The final data payload to send to the server, if any
	 */
	this.close = function(code, data) {
		console.log(this, "software requested close", code, data);
		this._gracefulClose = true;
		this._socket.close(code, jsonify(data));
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
		return this._socket.readyState == WebSocket.OPEN;
	}

	/**
	 * <p>
	 * Send a data payload to the client via the underlying socket. If the
	 * socket is not currently open, then the payload will be be ignored.
	 * </p>
	 * <p>
	 * If the payload is not a Packet, the payload is wrapped inside a Packet
	 * container and is dispatched. Else, the packet is dispatched as-is.
	 * </p>
	 */
	this.send = function(data) {
		if (!data instanceof Packet)
			data = new Packet(this.uid, data);
		if (this.ready())
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
		console.log(this, "client socket closed unexpectedly");
		this._fireCallbacks("shutdown", arguments);
	}

	this._handleEvtOpening = function() {
		console.log(this, "client socket opening");
		this._fireCallbacks("opening", arguments);
	}

	this._handleEvtOpen = function() {
		console.log(this, "client socket opened");
		this._fireCallbacks("open", arguments);
	}

	this._handleEvtClose = function() {
		console.log(this, "client socket closing");
		this._fireCallbacks("close", arguments);
		if (!this._gracefulClose)
			this._handleUngracefulClose();
	}

	this._handleEvtError = function() {
		console.log(this, "client socket error");
		this._fireCallbacks("error", arguments);
		if (!this._gracefulClose)
			this._handleUngracefulClose();
	}

	this._handleEvtMessage = function(message) {
		this._fireCallbacks("message", arguments);
		var packet = new Packet(this.uid, null);
		packet.deserialize(message);
		this._fireCallbacks("packet", packet);
	}

}

module.exports = {
	ClientSocket : ClientSocket
}