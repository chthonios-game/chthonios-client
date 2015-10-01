"use strict";

function AssetManager() {

	AssetManager.prototype.ASSET_LOADED = "LOADED";
	AssetManager.prototype.ASSET_ERRORED = "ERRORED";
	AssetManager.prototype.ASSET_REQUESTING = "REQUESTING";
	AssetManager.prototype.ASSET_PENDING = "PENDING";
	AssetManager.prototype.ASSET_MISSING = "MISSING";

	this.guards = {};
	this.assets = {};

	this.loadResourcesFromFile = function(path, callback) {
		this.downloadResource("x-json", path);
		Future.once(decoratedCallback(function() {
			var boot = this.getAsset(path);
			var map = JSON.parse(boot);
			var min_resources = map["resources"];
			for (var i = 0; i < min_resources.length; i++) {
				var resource = min_resources[i];
				this.downloadResource(resource.type, resource.path);
			}

			var all = function() {
				var result = true;
				for ( var path in this.guards) {
					var guard = this.guards[path];
					if (guard.status != this.ASSET_LOADED) {
						result = false;
					}
				}
				return result;
			};
			Future.once(callback, decoratedCallback(all, this));
		}, this), decoratedCallback(function() {
			return this.getAssetStatus(path) == this.ASSET_LOADED;
		}, this));
	}

	this.downloadResource = function(type, path) {
		if (type == "x-bitmap" || type == "x-text" || type == "x-shader" || type == "x-json") {
			if (this.guards[path] != null) {
				console.error("Already loading or loaded resource", path);
				return;
			}
			var request = this.request(path, type, decoratedCallback(function(req, result) {
				if (result.success)
					this.assets[path] = result.payload;
				else
					console.error("Problem getting resource", result.status);
			}, this));
			this.guards[path] = request;
			this.guards[path].dispatch();
		} else
			console.error("Unsupported asset type", type);
	}

	this.request = function(xpath, xtype, callback) {
		var guard = {
			xpath : xpath,
			xtype : xtype,
			callback : callback,
			status : this.ASSET_PENDING,

			ctex : null,
			guard : null,
			request : null,
			dispatch : null
		};

		if (xtype == "x-bitmap") {
			guard.request = new Image();
			guard.guard = function() {
				if (this.request.complete) {
					clearTimeout(this.ctex);
					this.ctex = null;
					this.status = AssetManager.prototype.ASSET_LOADED;
					this.callback(this, {
						success : true,
						payload : this.request
					});
					this.request = null;
				} else {
					this.status = AssetManager.prototype.ASSET_ERRORED;
					this.callback(this, {
						success : false,
						status : this.request
					});
					this.request = null;
				}
			}

			guard.request.addEventListener("load", decoratedCallback(guard.guard, guard), false);
			guard.request.addEventListener("error", decoratedCallback(guard.guard, guard), false);

			guard.panic = function() {
				this.ctex = null;
				console.error("failed to fetch in time limit", this.xpath);
				this.request = null;
			}

			guard.dispatch = decoratedCallback(function() {
				if (this.ctex != null)
					return;
				console.log("dispatching for bitmap", this.xpath);
				this.status = AssetManager.prototype.ASSET_REQUESTING;
				this.ctex = setTimeout(decoratedCallback(this.panic, this), 10000);
				this.request.src = this.xpath;
			}, guard);
		} else {
			guard.request = new XMLHttpRequest();
			guard.guard = function() {
				if (this.request.readyState == 4) {
					clearTimeout(this.ctex);
					this.ctex = null;
					if (this.request.status == 200) {
						this.status = AssetManager.prototype.ASSET_LOADED;
						this.callback(this, {
							success : true,
							payload : this.request.responseText
						});
						this.request = null;
					} else if (this.request.status == 204) {
						this.status = AssetManager.prototype.ASSET_LOADED;
						this.callback(this, {
							success : true,
							payload : ''
						});
						this.request = null;
					} else {
						this.status = AssetManager.prototype.ASSET_ERRORED;
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
				this.status = AssetManager.prototype.ASSET_REQUESTING;
				this.ctex = setTimeout(decoratedCallback(this.panic, this), 10000);
				this.request.open("GET", this.xpath, true);
				this.request.send();
			}, guard);

		}
		return guard;
	}

	this.writeAsset = function(path, blob) {
		this.assets[path] = blob;
	}

	this.getAsset = function(path) {
		return this.assets[path];
	}

	this.getAssetStatus = function(path) {
		if (this.assets[path] != null)
			return this.ASSET_LOADED;
		if (this.guards[path] != null)
			return this.guards[path].status;
		return this.ASSET_MISSING;
	}

}