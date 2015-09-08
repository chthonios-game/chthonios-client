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
	this._retry = null;

	this.bind = function(event, fn) {
		assert(this.callbacks[event], "No such event type");
		this.callbacks[event].push(fn);
	}

	this.open = function() {
		if (this._socket != null && this._socket.readyState == 1)
			this._socket.close();
		this._socket = new WebSocket(domain);
		this._socket.onopen = decoratedCallback(this._handleEvtOpen, this);
		this._socket.onclose = decoratedCallback(this._handleEvtClose, this);
		this._socket.onerror = decoratedCallback(this._handleEvtError, this);
		this._socket.onmessage = decoratedCallback(this._handleEvtMessage, this);
	}

	this._fireCallbacks = function(event, args) {
		var callbacks = this.callbacks["event"];
		for (var i = 0; i < callbacks.length; i++) {
			var callback = callbacks[i];
			try {
				callback.apply(this, args);
			} catch (e) {
				// TODO: Log exception somewhere, continue gracefully!
			}
		}
	}

	this._handleEvtOpen = function() {
		this._fireCallbacks("open", arguments);
	}
	this._handleEvtClose = function() {
		this._fireCallbacks("close", arguments);
	}
	this._handleEvtError = function() {
		this._fireCallbacks("error", arguments);
	}
	this._handleEvtMessage = function(message) {
		this._fireCallbacks("message", arguments);
	}
}