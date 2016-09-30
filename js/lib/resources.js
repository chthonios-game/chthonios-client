"use strict";

/**
 * chthonios game asset controller TODO: cache resources in local-storage
 */
function AssetManager() {

	AssetManager.prototype.ASSET_LOADED = "LOADED";
	AssetManager.prototype.ASSET_ERRORED = "ERRORED";
	AssetManager.prototype.ASSET_REQUESTING = "REQUESTING";
	AssetManager.prototype.ASSET_PENDING = "PENDING";
	AssetManager.prototype.ASSET_MISSING = "MISSING";

	AssetManager.prototype.ASSET_TYPES = [ "x-text", "x-json", "x-html", "x-css", "x-bitmap", "x-shader", "x-js" ];

	this.guards = {};
	this.assets = {};

	/**
	 * Load resources from a descriptor file located on a server. When executed, invoke the callback function provided.
	 * 
	 * @param path
	 *            The asset list to download
	 * @param callback
	 *            The callback to invoke when all resources have loaded OK
	 */
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

	/**
	 * Download a network resource
	 * 
	 * @param type
	 *            The type of resource (x-bitmap, x-text, x-shader, x-json)
	 * @param path
	 *            The URI to fetch
	 * @param callback
	 *            The future callback to invoke when the request has concluded
	 */
	this.downloadResource = function(type, path, callback) {
		if (type == "x-bitmap" || type == "x-text" || type == "x-shader" || type == "x-json") {
			if (this.guards[path] != null) {
				console.error("AssetManager.downloadResource", "Already loading or loaded resource", path);
				return;
			}
			var cbfn = decoratedCallback(function(req, result) {
				if (result.success) {
					this.assets[path] = result.payload;
					if (callback)
						callback(true, result.type, result.payload);
				} else {
					console.error("AssetManager.downloadResource", "Problem getting resource", path, result.status);
					if (callback)
						callback(false, result.type, result.status);
				}
			}, this);

			var request = null;
			if (type == "x-text" || type == "x-shader" || type == "x-json" || type == "x-css")
				request = this.request(path + "?_=" + (new Date().getTime()), type, cbfn);
			else
				request = this.request(path, type, cbfn);

			this.guards[path] = request;
			this.guards[path].dispatch();
		} else
			console.error("AssetManager.downloadResource", "Unsupported asset type", type, path);
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
				console.error("AssetManager.request", "$x-bitmap handler", "failed to fetch in time limit", this.xpath);
				this.request = null;
			}

			guard.dispatch = decoratedCallback(function() {
				if (this.ctex != null)
					return;
				console.log("AssetManager.request", "$x-bitmap handler", "dispatching for bitmap", this.xpath);
				this.status = AssetManager.prototype.ASSET_REQUESTING;
				this.ctex = setTimeout(decoratedCallback(this.panic, this), 10000);
				this.request.src = this.xpath;
			}, guard);
		} else if (xtype == "x-js") {
			guard.request = document.createElement("script");
			guard.request.type = "text/javascript";
			document.body.appendChild(guard.request);

			guard.request.onload = decoratedCallback(function() {
				clearTimeout(this.ctex);
				this.status = AssetManager.prototype.ASSET_LOADED;
				this.callback(this, {
					success : true,
					type : this.xtype,
					scriptobj : this.request
				});
				this.request = null;
			}, guard);

			guard.request.onerror = decoratedCallback(function(evt) {
				this.status = AssetManager.prototype.ASSET_ERRORED;
				this.callback(this, {
					success : false,
					type : this.xtype,
					status : evt
				});
				this.request = null;
			}, guard);

			guard.panic = function() {
				this.ctex = null;
				console.error("AssetManager.request", "$x-js handler", "failed to fetch in time limit", this.xpath);
				this.request = null;
			}

			guard.dispatch = decoratedCallback(function() {
				if (this.ctex != null)
					return;
				console.log("AssetManager.request", "$x-js handler", "dispatching for script", this.xpath);
				this.status = AssetManager.prototype.ASSET_REQUESTING;
				this.ctex = setTimeout(decoratedCallback(this.panic, this), 10000);
				this.request.src = this.xpath;
			}, guard);
		} else if (xtype == "x-css") {
			guard.request = new XMLHttpRequest();
			guard.guard = function() {
				if (this.request.readyState == 4) {
					clearTimeout(this.ctex);
					this.ctex = null;
					if (this.request.status == 200) {
						this.status = AssetManager.prototype.ASSET_LOADED;
						var inject = $("<style></style>");
						inject.attr("id", "rsis_" + this.simpleName(this.xpath));
						$("head").appendChild(inject);
						this.callback(this, {
							success : true,
							type : this.xtype,
							payload : this.request.responseText,
							eleme : inject
						});
						this.request = null;
					} else {
						this.status = AssetManager.prototype.ASSET_ERRORED;
						this.callback(this, {
							success : false,
							type : this.xtype,
							status : this.request.status
						});
						this.request = null;
					}
				}
			}

			guard.request.onreadystatechange = decoratedCallback(guard.guard, guard);
			guard.panic = function() {
				this.ctex = null;
				console.error("AssetManager.request", "$x-css handler", "failed to fetch in time limit", this.xpath);
				this.request.abort();
				this.request = null;
			}

			guard.dispatch = decoratedCallback(function() {
				if (this.ctex != null)
					return;
				console.log("AssetManager.request", "$x-css handler", "dispatching for resource", this.xpath);
				this.status = AssetManager.prototype.ASSET_REQUESTING;
				this.ctex = setTimeout(decoratedCallback(this.panic, this), 10000);
				this.request.open("GET", this.xpath, true);
				this.request.send();
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
							type : this.xtype,
							payload : this.request.responseText
						});
						this.request = null;
					} else if (this.request.status == 204) {
						this.status = AssetManager.prototype.ASSET_LOADED;
						this.callback(this, {
							success : true,
							type : this.xtype,
							payload : ''
						});
						this.request = null;
					} else {
						this.status = AssetManager.prototype.ASSET_ERRORED;
						this.callback(this, {
							success : false,
							type : this.xtype,
							status : this.request.status
						});
						this.request = null;
					}
				}
			}

			guard.request.onreadystatechange = decoratedCallback(guard.guard, guard);
			guard.panic = function() {
				this.ctex = null;
				console.error("AssetManager.request", "$x-* handler", "failed to fetch in time limit", this.xpath);
				this.request.abort();
				this.request = null;
			}

			guard.dispatch = decoratedCallback(function() {
				if (this.ctex != null)
					return;
				console.log("AssetManager.request", "$x-* handler", "dispatching for resource", this.xpath);
				this.status = AssetManager.prototype.ASSET_REQUESTING;
				this.ctex = setTimeout(decoratedCallback(this.panic, this), 10000);
				this.request.open("GET", this.xpath, true);
				this.request.send();
			}, guard);

		}
		return guard;
	}

	this.simpleName = function(path) {
		var realpath = path.replace("\\", "/");
		if (realpath.indexOf("/") == -1)
			return path;
		return realpath.substring(realpath.indexOf("/") + 1);
	}

	this.writeAsset = function(path, blob) {
		this.assets[path] = blob;
	}

	/**
	 * Get an asset from memory
	 * 
	 * @param path
	 *            The URI to fetch
	 */
	this.getAsset = function(path) {
		return this.assets[path];
	}

	/**
	 * Get a list of all outstanding assets (~ASSET_LOADED)
	 */
	this.getPendingAssets = function() {
		var pending = [];
		for ( var label in this.guards) {
			if (this.guards.hasOwnProperty(label)) {
				var guard = this.guards[label];
				if (guard.status != this.ASSET_LOADED)
					pending.push(guard);
			}
		}
		return pending;
	}

	/**
	 * Get the status of an asset
	 */
	this.getAssetStatus = function(path) {
		if (this.assets[path] != null)
			return this.ASSET_LOADED;
		if (this.guards[path] != null)
			return this.guards[path].status;
		return this.ASSET_MISSING;
	}
}