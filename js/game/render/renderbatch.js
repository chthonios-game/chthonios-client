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

	this.setWorld = function(world) {
		if (this.world != null) {
			this.clearWorld();
		}
		console.log(this.toString(), "rbSetWorld", world);
		this.world = world;
		this.prepareTerrainAtlas();
		this.prepareTerrainRenderer();
	}

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
			console.log(this.toString(), "rbPrepareTerrainAtlas", "tiles/environment/" + tile.sprite);
			var bitmap = this.assets.getAsset("tiles/environment/" + tile.sprite);
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
			this.terrainAtlas.bitmap.release();

			buffer.paintBufferOnScreen(graphics.BUFFER_WALLS0);
			buffer.paintBufferOnScreen(graphics.BUFFER_WALLS1);

			buffer.paintBufferOnScreen(graphics.BUFFER_DOODADS0);
			buffer.paintBufferOnScreen(graphics.BUFFER_DOODADS1);

			buffer.paintBufferOnScreen(graphics.BUFFER_GFX0);
			buffer.paintBufferOnScreen(graphics.BUFFER_GFX1);

			buffer.paintBufferOnScreen(graphics.BUFFER_ENTITIES0);
			buffer.paintBufferOnScreen(graphics.BUFFER_ENTITIES1);
		}

	}
}

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

	}

	this._ngBuildTerrainMap = function(vma, lod_name, chunk) {
		var tiles = chunk.width * chunk.height;
		var verts = tiles * 4;

		var alloc = this.rb.graphics.buffer.allocate(this.rb.graphics.BUFFER_TILES0, verts);
		if (!alloc)
			alloc = this.rb.graphics.buffer.allocate(this.rb.graphics.BUFFER_TILES1, verts);
		if (!alloc)
			throw new g2d.error("unable to get buffer space to render terrain!");
		vma.groundAllocation = alloc;
		
		var tileMap = [], tileNormals = [], tileTexels = [];
		var gx = chunk.width * chunk.x, gy = chunk.height * chunk.y;
		console.log("_ngBuildTerrainMap", gx, gy);
		
		var atlas = this.rb.terrainAtlas;

		for (var i = 0; i < tiles; i++) {
			var fx = (Math.floor(i / chunk.width)) + gx;
			var fy = (i % chunk.width) + gy;

			var tileInfo = this.world.getInfoForTile(chunk.getTile(fx, fy));
			var solid = chunk.getSolid(fx, fy);
			var passable = chunk.getSolid(fx, fy);
			var attrib = chunk.getAttributes(fx, fy);
			
			tileMap.push([ fx, fy, -5.0 ], [ fx, fy + 1.0, -5.0 ]);
			tileMap.push([ fx + 1.0, fy + 1.0, -5.0 ], [ fx + 1.0, fy, -5.0 ]);
			tileNormals.push([ 0.0, 0.0, -1.0 ], [ 0.0, 0.0, -1.0 ]);
			tileNormals.push([ 0.0, 0.0, -1.0 ], [ 0.0, 0.0, -1.0 ]);
			texels.push([ 0.0, 0.0 ], [ 0.0, 1.0 ]);
			texels.push([ 1.0, 1.0 ], [ 1.0, 0.0 ]);
		}

		vma.groundAllocation.writeVertexData(tileMap);
		vma.groundAllocation.writeVertexNormalData(tileNormals);
		vma.groundAllocation.writeTextureData(tileTexels);
		
		alloc = this.rb.graphics.buffer.allocate(this.rb.graphics.BUFFER_WALLS0, wallMap.length);
		if (!alloc)
			alloc = this.rb.graphics.buffer.allocate(this.rb.graphics.BUFFER_WALLS1, wallMap.length);
		if (!alloc)
			throw new g2d.error("unable to get buffer space to render terrain!");
		vma.wallAllocation = alloc;
		
		vma.wallAllocation.writeVertexData(wallMap);
		vma.wallAllocation.writeVertexNormalData(wallNormals);
		vma.wallAllocation.writeTextureData(wallTexels);
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
		/*
		 * Figure out which VMA units are in use.
		 */
		var gc_vmas = [], active_vmas = [];
		for (var i = 0; i < this._vmas.length; i++) {
			var vma = this._vmas[i];
			if (vma.label == null || this._chunksToRender.indexOf(vma.label) == -1) {
				gc_vmas.push(vma);
			} else
				active_vmas.push(vma.label);
		}

		/*
		 * Clean up dirty VMA's.
		 */
		while (gc_vmas.length) {
			var vma = gc_vmas[i];
			var idx = -1;
			while ((idx = this._vmas.indexOf(vma)) != -1)
				this._vmas.splice(vma, 1);
			this._releaseVma(vma);
		}

		/*
		 * Perform new VMA allocations.
		 */
		for (var i = 0; i < this._chunksToRender.length; i++) {
			var lod_name = this._chunksToRender[i];
			if (active_vmas.indexOf(lod_name) == -1) {
				var chunkcoord = this._getChunkCoordFromName(lod_name);
				var chunk = this.world.getOrCacheChunk(chunkcoord[0], chunkcoord[1]);
				if (chunk != null)
					this._renderToVma(lod_name, chunk);
			}
		}
	}

	this.deleteRenderer = function(chunk) {

	}

}