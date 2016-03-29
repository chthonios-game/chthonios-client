"use strict";

function ClientWorld(client, uid) {
	this._downloader = new ClientMapStreamer(this, uid);

	this.remoteWorldData = null;

	this.entities = [];
	this._fetchers = {};
	this.chunks = {};

	this.init = function(onReadyCbfn) {
		this._downloader.init(decoratedCallback(function() {
			this.remoteWorldData = this._downloader.descriptor;
			if (onReadyCbfn != null)
				onReadyCbfn();
		}, this));
	};

	this.getOrCacheChunk = function(cx, cy) {
		if (this.chunks[cx] != null)
			if (this.chunks[cx][cy] != null)
				return this.chunks[cx][cy];
		this.prefetch(cx, cy);
	}

	this.prefetch = function(cx, cy) {
		if (this.chunks[cx] != null)
			if (this.chunks[cx][cy] != null)
				return false;

		if (0 > cx || 0 > cy)
			return false;

		if (this._fetchers[cx] == null)
			this._fetchers[cx] = {};
		if (this._fetchers[cx][cy] != null)
			return false;

		console.log(this.toString(), "dispatching for chunk", cx, cy);

		this._fetchers[cx][cy] = this._downloader.getChunk(cx, cy, decoratedCallback(function(chunk) {
			if (this.chunks[cx] == null)
				this.chunks[cx] = {};
			this.chunks[cx][cy] = chunk;
			console.log(this.toString(), "loaded chunk", cx, cy);
		}, this));
		return true;
	}

	this.close = function() {

	};

	this.addEntity = function(entity) {
		assert(entity instanceof Entity, "Can't add non-entity to world");
		this.entities.push(entity);
	}

	this.removeEntity = function(entity) {
		assert(entity instanceof Entity, "Can't remove non-entity from world");
		var idx = -1;
		while ((idx = this.entities.indexOf(entity)) !== -1)
			this.entities.splice(idx, 1);
	}

	this.getTilesetInfo = function() {
		return this.remoteWorldData.tileset;
	}

	this.getInfoForTile = function(id) {
		return this.remoteWorldData.tileset[id];
	}
}

function ClientMapStreamer(world, uid) {
	this._world = world;
	this._uid = uid;
	this._fetchers = [];
	this.descriptor = null;

	this.init = function(cbfn) {
		this.fetch("http://localhost:9001/" + this._uid + "/descriptor", decoratedCallback(function(result) {
			if (!result.success)
				console.error("failed to get world descriptor file", result.status, result.message);
			else {
				this.descriptor = JSON.parse(result.payload.payload);
				console.log(this._world.toString(), "map descriptor obtained", this.descriptor);
				if (cbfn != null)
					cbfn();
			}
		}, this));
	}

	this.getChunk = function(cx, cz, callback) {
		var requestor = this.fetch("http://localhost:9001/" + this._uid + "/chunk/" + cx + "-" + cz + ".chunk", decoratedCallback(function(
				result) {
			if (!result.success) {
				console.error(this._world.toString(), "couldn't fetch missing chunk data", result.status, result.message);
			} else {
				var chunkdata = result.payload;
				var chunk = new Chunk(this._world, cx, cz, chunkdata.width, chunkdata.height);
				chunk.parseChunk(chunkdata);
				console.log(this._world.toString(), "obtained missing chunk data");
				callback(chunk);
			}
		}, this));
		return requestor;
	}

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
				var payload = JSON.parse(this.request.responseText);
				if (this.request.status == 200) {
					this.callback(this, {
						success : true,
						payload : payload
					});
					this.request = null;
				} else if (this.request.status == 204) {
					this.callback(this, {
						success : true,
						message : payload.message
					});
					this.request = null;
				} else {
					this.callback(this, {
						success : false,
						status : this.request.status,
						message : payload.message
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