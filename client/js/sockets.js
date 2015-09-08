"use strict";

/**
 * Memory-buffered auto-recovering WebSocket wrapper.
 */
function Socket(domain) {
	/** The request domain path */
	this.domain = domain;
	/** The callbacks registered on this socket's events */
	this.callbacks = {
		open : [],
		close : [],
		error : [],
		message : []
	};

	this._socket = null;
	this._gracefulClose = false;
	this._retry = null;
	this._pendingData = [];

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
		console.log(domain, "opening connection");
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
		return this._socket.readyState == WebSocket.OPEN;
	}

	/**
	 * Send a data payload to the server via the underlying socket. If the
	 * socket is not currently open, then the payload will be buffered and
	 * replayed when the underlying socket is ready to send data.
	 */
	this.send = function(data) {
		if (!this.ready())
			this._pendingData.push(data);
		else
			this._socket.send(data);
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

	this._handleEvtOpen = function() {
		console.log(domain, "socket opened");
		this._fireCallbacks("open", arguments);
		this._retry = null;
		if (this._pendingData.length != 0) {
			var data = this._pendingData;
			this._pendingData = [];
			for (var i = 0; i < data.length; i++)
				this._socket.send(data[i]);
		}
	}

	this._handleEvtClose = function() {
		console.log(domain, "socket closing");
		this._fireCallbacks("close", arguments);
		if (!this._gracefulClose)
			this._handleUngracefulClose();
	}

	this._handleEvtError = function() {
		console.log(domain, "socket error");
		this._fireCallbacks("error", arguments);
		if (!this._gracefulClose)
			this._handleUngracefulClose();
	}

	this._handleEvtMessage = function(message) {
		this._fireCallbacks("message", arguments);
	}
}