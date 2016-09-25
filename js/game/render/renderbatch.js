/**
 * Main game rendering
 */
var RenderBatch = function(client) {
	this.graphics = client.g2d;
	this.assets = client.assets;
	this.camera = client.g2d.camera;

	this.world = null;
	this.terrainAtlas = null;
	this.terrainRenderer = null;
	this.entityBatcher = null;

	/**
	 * Set the render world.
	 * 
	 * Internally, recalculates the rendering data required to display the
	 * world; this includes getting the tileset and constructing the atlas, as
	 * well as resetting most of the rendering matricies for new world rendering
	 * to occur.
	 */
	this.setWorld = function(world) {
		if (this.world != null) {
			this.clearWorld();
		}
		console.log(this.toString(), "rbSetWorld", world);
		this.world = world;

		this.prepareTerrainAtlas();
		this.prepareTerrainRenderer();
		this.prepareEntityBatcher();
	}

	/**
	 * Remove the render world.
	 * 
	 * Internally, clears all rendering data which is being used to render the
	 * current world. The rendering stops for the world - including terrain,
	 * entities, gfx.
	 */
	this.clearWorld = function() {
		console.log(this.toString(), "rbClearWorld");
		this.deleteTerrainRenderer();
		this.deleteTerrainAtlas();
	}

	this.prepareTerrainAtlas = function() {
		if (this.terrainAtlas != null)
			return;
		this.terrainAtlas = new g2d.atlas();
		var tileinfo = this.world.remoteWorldData.tileset;
		for (var i = 0; i < tileinfo.length; i++) {
			var tile = tileinfo[i];
			console.log(this.toString(), "rbPrepareTerrainAtlas",
					"tiles/environment/" + tile.sprite);
			var bitmap = this.assets.getAsset("tiles/environment/"
					+ tile.sprite);
			this.terrainAtlas.addSubTex("tile_" + i, bitmap);
		}
		this.terrainAtlas.packSubTex(this.graphics);
	}

	this.deleteTerrainAtlas = function() {
		if (this.terrainAtlas == null)
			return;
		this.terrainAtlas.deleteAtlas();
		this.terrainAtlas = null;
	}

	this.prepareTerrainRenderer = function() {
		if (this.terrainRenderer != null)
			return;
		this.terrainRenderer = new RenderBatch.TerrainMap(this, this.world);
	}

	this.deleteTerrainRenderer = function() {
		if (this.terrainRenderer == null)
			return;
		this.terrainRenderer.deleteRenderer();
		this.terrainRenderer = null;
	}

	this.prepareEntityBatcher = function() {
		if (this.entityBatcher != null)
			return;
		this.entityBatcher = new RenderBatch.EntityBatcher(this, this.world);
		this.entityBatcher.init();
	}

	this.deleteEntityBatcher = function() {
		if (this.entityBatcher == null)
			return;
		this.entityBatcher.deleteRenderer();
		this.entityBatcher = null;
	}

	/**
	 * Called by the game each frame to update the scene.
	 */
	this.repaintScene = function() {
		if (this.terrainRenderer != null) {
			var graphics = this.graphics, buffer = this.graphics.buffer;

			this.terrainRenderer.doUpdateBuffers();

			this.terrainAtlas.bitmap.bind();
			buffer.paintBufferOnScreen(graphics.BUFFER_TILES0);
			buffer.paintBufferOnScreen(graphics.BUFFER_TILES1);
			buffer.paintBufferOnScreen(graphics.BUFFER_TILES2);
			buffer.paintBufferOnScreen(graphics.BUFFER_WALLS0);
			buffer.paintBufferOnScreen(graphics.BUFFER_WALLS1);
			this.terrainAtlas.bitmap.release();

			buffer.paintBufferOnScreen(graphics.BUFFER_DOODADS0);
			buffer.paintBufferOnScreen(graphics.BUFFER_DOODADS1);

			buffer.paintBufferOnScreen(graphics.BUFFER_GFX0);
			buffer.paintBufferOnScreen(graphics.BUFFER_GFX1);

			buffer.paintBufferOnScreen(graphics.BUFFER_ENTITIES0);
			buffer.paintBufferOnScreen(graphics.BUFFER_ENTITIES1);
		}

	}
}

RenderBatch.TerrainRenderError = function(message) {
	this.name = 'RenderBatch.TerrainRenderError';
	this.message = message;
	this.stack = (new Error()).stack;
}
RenderBatch.TerrainRenderError.prototype = new Error;

/**
 * Terrain renderer
 */
RenderBatch.TerrainMap = function(rb, world) {

	this.rb = rb;
	this.world = world;
	this._chunksToRender = [];

	/** Video memory allocation map */
	this._vmas = [];

	this._renderToVma = function(lod_name, chunk) {
		var coords = this._getChunkCoordFromName(lod_name);
		var chunk = this.world.getOrCacheChunk(coords[0], coords[1]);
		if (chunk === false || chunk === true)
			return;
		var vma = {
			label : lod_name,
			chunk : chunk,
			groundAllocation : null,
			wallAllocation : null
		};
		this._ngBuildTerrainMap(vma, lod_name, chunk);
		this._vmas.push(vma);
	}

	this._releaseVma = function(vma) {
		if (vma.groundAllocation != null) {
			this.rb.graphics.buffer.free(vma.groundAllocation);
			vma.groundAllocation = null;
		}

		if (vma.wallAllocation != null) {
			this.rb.graphics.buffer.free(vma.wallAllocation);
			vma.wallAllocation = null;
		}
	}

	this._ngGetBufferSpace = function(buffer, verts) {
		var alloc = null;
		try {
			var alloc = this.rb.graphics.buffer.allocate(buffer, verts);
		} catch (e) {
			if (e instanceof VideoMemError) {
				console.log("_ngGetBufferSpace video error:", e);
			} else {
				throw e;
			}
		}
		return alloc;
	}

	this._ngBuildTerrainMap = function(vma, lod_name, chunk) {
		var tiles = chunk.width * chunk.height;
		var verts = tiles * 4;
		var alloc = this._ngGetBufferSpace(this.rb.graphics.BUFFER_TILES0,
				verts)
		if (!alloc)
			alloc = this._ngGetBufferSpace(this.rb.graphics.BUFFER_TILES1,
					verts)
		if (!alloc)
			throw new RenderBatch.TerrainRenderError(
					"unable to get buffer space to render terrain!");
		vma.groundAllocation = alloc;

		var tileMap = [], tileNormals = [], tileTexels = [];
		var wallMap = [], wallNormals = [], wallTexels = [];
		var gx = chunk.width * chunk.x, gy = chunk.height * chunk.y;
		console.log("_ngBuildTerrainMap (g)", gx, gy);

		var atlas = this.rb.terrainAtlas;

		for (var i = 0; i < tiles; i++) {
			var ix = (Math.floor(i / chunk.width));
			var iy = (i % chunk.width);
			var fx = ix + gx;
			var fy = iy + gy;

			var tile = chunk.getTile(ix, iy);
			var tileInfo = this.world.getInfoForTile(tile);
			var solid = chunk.getSolid(ix, iy);
			var passable = chunk.getSolid(ix, iy);
			var attrib = chunk.getAttributes(ix, iy);
			var height = chunk.getHeight(ix, iy);
			var texel = atlas.getCoordsForTex("tile_" + tile);

			tileMap.push([ fx, 0.0, fy ], [ fx, 0.0, fy + 1.0 ]);
			tileMap.push([ fx + 1.0, 0.0, fy + 1.0 ], [ fx + 1.0, 0.0, fy ]);
			tileNormals.push([ 0.0, 0.0, -1.0 ], [ 0.0, 0.0, -1.0 ]);
			tileNormals.push([ 0.0, 0.0, -1.0 ], [ 0.0, 0.0, -1.0 ]);
			tileTexels.push([ texel[0], texel[1] ], [ texel[0], texel[3] ]);
			tileTexels.push([ texel[2], texel[3] ], [ texel[2], texel[1] ]);

			if (height != 0) {
				// Top face
				wallMap.push([ fx, height, fy ], [ fx, height, fy + 1.0 ]);
				wallMap.push([ fx + 1.0, height, fy + 1.0 ], [ fx + 1.0,
						height, fy ]);
				wallNormals.push([ 0.0, 0.0, -1.0 ], [ 0.0, 0.0, -1.0 ]);
				wallNormals.push([ 0.0, 0.0, -1.0 ], [ 0.0, 0.0, -1.0 ]);
				wallTexels.push([ texel[0], texel[1] ], [ texel[0], texel[3] ]);
				wallTexels.push([ texel[2], texel[3] ], [ texel[2], texel[1] ]);

				// East Face
				wallMap.push([ fx, 0.0, fy + 1.0 ], [ fx, height, fy + 1.0 ]);
				wallMap.push([ fx + 1.0, height, fy + 1.0 ], [ fx + 1.0, 0.0,
						fy + 1.0 ]);
				wallNormals.push([ 0.0, 0.0, -1.0 ], [ 0.0, 0.0, -1.0 ]);
				wallNormals.push([ 0.0, 0.0, -1.0 ], [ 0.0, 0.0, -1.0 ]);
				wallTexels.push([ texel[0], texel[1] ], [ texel[0], texel[3] ]);
				wallTexels.push([ texel[2], texel[3] ], [ texel[2], texel[1] ]);

				// West Face
				wallMap.push([ fx, 0.0, fy ], [ fx, height, fy ]);
				wallMap.push([ fx + 1.0, height, fy ], [ fx + 1.0, 0.0, fy ]);
				wallNormals.push([ 0.0, 0.0, -1.0 ], [ 0.0, 0.0, -1.0 ]);
				wallNormals.push([ 0.0, 0.0, -1.0 ], [ 0.0, 0.0, -1.0 ]);
				wallTexels.push([ texel[0], texel[1] ], [ texel[0], texel[3] ]);
				wallTexels.push([ texel[2], texel[3] ], [ texel[2], texel[1] ]);

				// South Face
				wallMap.push([ fx, 0.0, fy ], [ fx, height, fy ]);
				wallMap.push([ fx, height, fy + 1.0 ], [ fx, 0.0, fy + 1.0 ]);
				wallNormals.push([ 0.0, 0.0, -1.0 ], [ 0.0, 0.0, -1.0 ]);
				wallNormals.push([ 0.0, 0.0, -1.0 ], [ 0.0, 0.0, -1.0 ]);
				wallTexels.push([ texel[0], texel[1] ], [ texel[0], texel[3] ]);
				wallTexels.push([ texel[2], texel[3] ], [ texel[2], texel[1] ]);

				// North Face
				wallMap.push([ fx + 1.0, 0.0, fy ], [ fx + 1.0, height, fy ]);
				wallMap.push([ fx + 1.0, height, fy + 1.0 ], [ fx + 1.0, 0.0,
						fy + 1.0 ]);
				wallNormals.push([ 0.0, 0.0, -1.0 ], [ 0.0, 0.0, -1.0 ]);
				wallNormals.push([ 0.0, 0.0, -1.0 ], [ 0.0, 0.0, -1.0 ]);
				wallTexels.push([ texel[0], texel[1] ], [ texel[0], texel[3] ]);
				wallTexels.push([ texel[2], texel[3] ], [ texel[2], texel[1] ]);
			}

		}

		vma.groundAllocation.writeVertexData(tileMap);
		vma.groundAllocation.writeVertexNormalData(tileNormals);
		vma.groundAllocation.writeTextureData(tileTexels);

		if (wallMap.length > 0) {
			alloc = this._ngGetBufferSpace(this.rb.graphics.BUFFER_WALLS0,
					wallMap.length);
			if (!alloc)
				alloc = this._ngGetBufferSpace(this.rb.graphics.BUFFER_WALLS1,
						wallMap.length);
			if (!alloc) {
				alloc = vma.groundAllocation;
				vma.groundAllocation = null;
				this.rb.graphics.buffer.free(alloc);
				throw new RenderBatch.TerrainRenderError(
						"unable to get buffer space to render terrain!");
			}
			vma.wallAllocation = alloc;

			vma.wallAllocation.writeVertexData(wallMap);
			vma.wallAllocation.writeVertexNormalData(wallNormals);
			vma.wallAllocation.writeTextureData(wallTexels);
		}
	}

	this._getChunkCoordFromName = function(lod_name) {
		var q = lod_name.indexOf("_") + 1, p = lod_name.indexOf(",");
		return [ lod_name.substring(q, p), lod_name.substring(p + 1) ];
	}

	this._getNameForLod = function(x, y) {
		return "lod_" + x + "," + y;
	}

	this.markChunkForRender = function(x, y) {
		var lod_name = this._getNameForLod(x, y);
		if (this._chunksToRender.indexOf(lod_name) == -1)
			this._chunksToRender.push(lod_name);
	}

	this.removeChunkForRender = function(x, y) {
		var lod_name = this._getNameForLod(x, y);
		var idx = -1;
		while ((idx = this._chunksToRender.indexOf(lod_name)) != -1)
			this._chunksToRender.splice(idx, 1);
	}

	this.doUpdateBuffers = function() {
		/* Figure out which VMA units are in use. */
		var gc_vmas = [], active_vmas = [];
		for (var i = 0; i < this._vmas.length; i++) {
			var vma = this._vmas[i];
			if (vma.label == null
					|| this._chunksToRender.indexOf(vma.label) == -1) {
				gc_vmas.push(vma);
			} else
				active_vmas.push(vma.label);
		}

		/* Clean up dirty VMA's. */
		while (gc_vmas.length) {
			var vma = gc_vmas[i];
			var idx = -1;
			while ((idx = this._vmas.indexOf(vma)) != -1)
				this._vmas.splice(vma, 1);
			this._releaseVma(vma);
		}

		/* Perform new VMA allocations. */
		for (var i = 0; i < this._chunksToRender.length; i++) {
			var lod_name = this._chunksToRender[i];
			if (active_vmas.indexOf(lod_name) == -1) {
				var chunkcoord = this._getChunkCoordFromName(lod_name);
				var chunk = this.world.getOrCacheChunk(chunkcoord[0],
						chunkcoord[1]);
				if (chunk != null && chunk.loaded)
					this._renderToVma(lod_name, chunk);
			}
		}
	}

	this.deleteRenderer = function(chunk) {

	}

}

RenderBatch.EntityBatcher = function(rb, world) {

	RenderBatch.EntityBatcher.prototype.BUFFERS = 8;
	RenderBatch.EntityBatcher.prototype.MAX_ENTITY_BUFFER = 255;
	RenderBatch.EntityBatcher.prototype.GC_RATIO = 0.33;

	/* map of g2d.atlas pointers (buffers) */
	this._atlases = [];
	/* list of entities to render */
	this._entitiesToRender = [];
	/* list of textures currently rendering */
	this._texturesToRender = [];
	/* list of textures to atlases */
	this._mapTextureToAtlas = [];

	this.init = function() {
		for (var i = 0; i < this.BUFFERS; i++)
			this._mapTextureToAtlas[i] = [];
	}

	this.markEntityForRender = function(entity) {
		this._entitiesToRender.push(entity);

	}
	this.removeEntityForRender = function(entity) {
	}

	this.deleteRenderer = function() {

	}

	this.doUpdateBuffers = function() {
		var textures = [];
		for (var i = 0; i < this._entitiesToRender.length; i++) {
			var path = this._entitiesToRender[i].getEntityIcon().path;
			if (textures.indexOf(path) == -1)
				textures.push(path);
		}

		var active_textures = [], missing_textures = [], dead_textures = [];

		for (var i = 0; i < textures.length; i++) {
			if (this._texturesToRender.indexOf(textures[i]) == -1)
				missing_textures.push(path);
			else
				active_textures.push(path);
		}

		for (var i = 0; i < this._texturesToRender.length; i++) {
			if (textures.indexOf(this.texturesToRender[i]) == -1)
				dead_textures.push(path);
		}

		var ratio = dead_textures.length
				/ (textures.length + dead_textures.length);
		if (ratio > GC_RATIO) {
			console.log("doUpdateBuffers: performing garbage collection");
			this.__eraseAllAtlases();
			this.__putTexturesOnAtlas(active_textures.concat(missing_textures));
			console.log("doUpdateBuffers: done garbage collection");
		} else {			
			if (missing_textures.length != 0) {
				this.__putTexturesOnAtlases(missing_textures);
			}
		}
	}
	
	this.__eraseAllAtlases = function() {
		for (var i = 0; i < this.BUFFERS; i++) {
			this._atlases[i].removeAllSubTex();
		}
	}

	this.__putTexturesOnAtlas = function(textures) {
		var refreshAtlases = [];
		for (var i = 0; i < textures.length; i++) {
			var texture = textures[i];
			var status = this.rb.assets.getAssetStatus(texture);
			if (status == this.rb.assets.ASSET_MISSING) {
				console.log("__putTexturesOnAtlas: missing resource ", texture);
				this.rb.assets.downloadResource("x-bitmap", texture);
			}
			if (status == this.rb.assets.ASSET_LOADED) {
				console.log("__putTexturesOnAtlas: loaded resource ", texture);
				var bitmap = this.rb.assets.getAsset(texture);
				var slot = this.__writeBitmapToAtlas(texture, bitmap);
				if (refreshAtlases.indexOf(slot) == -1)
					refreshAtlases.push(slot);
			}
		}
		for (var i = 0; i < refreshAtlases.length; i++)
			this._atlases[refreshAtlases[i]].packSubTex(this.rb.graphics);
	}
	
	this.__writeBitmapToAtlas = function(texture, bitmap) {
		var buffer = this.__nextAvailableBuffer();
		var atlas = this._atlases[buffer];
		atlas.addSubTex(texture, bitmap);
		this._texturesToRender.push(texture);
		this._mapTextureToAtlas[texture] = slot;
	}

	this.__nextAvailableBuffer = function() {
		for (var i = 0; i < this.BUFFERS; i++) {
			if (this._mapTextureToAtlas[i].length < this.MAX_ENTITY_BUFFER)
				return i;
		}
		return -1;
	}

	this.__hasAnyBufferSpace = function() {
		return this.__nextAvailableBuffer() != -1;
	}

	this._rebuildEntityMap = function() {

	}
}
