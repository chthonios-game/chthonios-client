"use strict";

function ClientWorld(client, uid) {

	this._client = client;
	this._uid = uid;

	this._fetchers = [];

	this._descriptor = [];

	this.init = function() {
		var fetcher = this.fetch("http://localhost:9001/" + this._uid + "/descriptor", decoratedCallback(function(result) {
			if (!result.success)
				console.error("failed to get world descriptor file");
			else
				this._descriptor = result.payload;
		}, this));

	};
	this.close = function() {

	};

	this.fetch = function(xpath, callback) {
		var fetcher = this.request(xpath, null);
		this._fetchers.push(fetcher);
		fetcher.callback = decoratedCallback(function(fe, args) {
			var idx = -1;
			while ((idx = this._fetchers.indexOf(fe)) != -1)
				this._fetchers.splice(idx, 1);
			callback.apply(this, [ args ]);
		}, this);
		fetcher.dispatch();
		return fetcher;
	}

	this.request = function(xpath, callback) {
		var guard = {
			xpath : xpath,
			callback : callback,
			ctex : null,
			guard : null,
			request : null,
			dispatch : null
		};

		guard.request = new XMLHttpRequest();
		guard.guard = function() {
			if (this.request.readyState == 4) {
				clearTimeout(this.ctex);
				this.ctex = null;
				if (this.request.status == 200) {
					var payload = JSON.parse(this.request.responseText);
					this.callback(this, {
						success : true,
						payload : payload
					});
					this.request = null;
				} else if (this.request.status == 204) {
					this.callback(this, {
						success : true
					});
					this.request = null;
				} else {
					this.callback(this, {
						success : false,
						status : this.request.status
					});
					this.request = null;
				}
			}
		}
		guard.request.onreadystatechange = decoratedCallback(guard.guard, guard);
		guard.panic = function() {
			this.ctex = null;
			console.error("failed to fetch in time limit", this.xpath);
			this.request.abort();
			this.request = null;
		}
		guard.dispatch = decoratedCallback(function() {
			if (this.ctex != null)
				return;
			console.log("dispatching for resource", this.xpath);
			this.ctex = setTimeout(decoratedCallback(this.panic, this), 10000);
			this.request.open("GET", this.xpath, true);
			this.request.send();
		}, guard);
		return guard;
	}

}