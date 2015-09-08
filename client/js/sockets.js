"use strict";

function Socket(domain) {
	this.domain = domain;
	this.callbacks = {
		open : [],
		close : [],
		error : [],
		message : []
	};

	this._socket = null;
	this._gracefulClose = false;
	this._retry = null;

	this.bind = function(event, fn) {
		assert(this.callbacks[event], "No such event type");
		this.callbacks[event].push(fn);
	}

	this.open = function() {
		if (this._socket != null && this._socket.readyState == WebSocket.OPEN)
			this._socket.close();
		this._gracefulClose = false;
		console.log("Opening connection: " + this.domain);
		this._socket = new WebSocket(this.domain);
		this._socket.onopen = decoratedCallback(this._handleEvtOpen, this);
		this._socket.onclose = decoratedCallback(this._handleEvtClose, this);
		this._socket.onerror = decoratedCallback(this._handleEvtError, this);
		this._socket.onmessage = decoratedCallback(this._handleEvtMessage, this);
	}

	this.close = function(code, data) {
		this._gracefulClose = true;
		this._socket.close(code, data);
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
		console.log("Socket closed unexpectedly!");
		this._retry = setTimeout(decoratedCallback(function() {
			console.log("Attempting to restore connection...");
			this._retry = null;
			this.open();
		}, this), 1000);
	}

	this._handleEvtOpen = function() {
		this._fireCallbacks("open", arguments);
		this._retry = null;
	}

	this._handleEvtClose = function() {
		this._fireCallbacks("close", arguments);
		if (!this._gracefulClose)
			this._handleUngracefulClose();
	}

	this._handleEvtError = function() {
		this._fireCallbacks("error", arguments);
		if (!this._gracefulClose)
			this._handleUngracefulClose();
	}

	this._handleEvtMessage = function(message) {
		this._fireCallbacks("message", arguments);
	}
}