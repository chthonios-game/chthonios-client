/**
 * Main game rendering
 */
var RenderBatch = function(client) {
	this.graphics = client.g2d;
	this.camera = client.g2d.camera;

	this.world = null;
	this.terrainAtlas = null;
	this.terrainRenderer = null;
	
	this.bufferVertPos = gl.createBuffer();
	this.bufferTexCoords = gl.createBuffer();
	this.bufferVertNormals = gl.createBuffer();
	this.bufferVertIndex = gl.createBuffer();

	this.setWorld = function(world) {
		if (this.world != null) {
			this.clearWorld();
		}
		this.world = world;
		this.prepareTerrainAtlas();
		this.prepareTerrainRenderer();
	}

	this.clearWorld = function() {
		this.deleteTerrainRenderer();
		this.deleteTerrainAtlas();
	}

	this.prepareTerrainAtlas = function() {
		if (this.terrainAtlas != null)
			return;
		this.terrainAtlas = new g2d.atlas();
		var tileinfo = this.world.tileset;
		for (var i = 0; i < tileinfo.length; i++) {
			var tile = tileinfo[i];
			var bitmap = client.assets.getAsset("tiles/environment/" + tile.sprite);
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
		this.terrainRenderer.prepareBuffers();
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
		this.terrainRenderer.doUpdateBuffers();
	}
}

/**
 * Terrain renderer
 */
RenderBatch.TerrainMap = function(rb, world) {

	this.rb = rb;
	this.world = world;
	this.lods = [];
	
	this.prepareBuffers = function() {
		
	}
	
	this.doUpdateBuffers = function() {
		
	}
	
	this.deleteRenderer = function(chunk) {
		
	}

}

RenderBatch.TerrainLOD = function(g2d, chunk) {
	this.g2d = g2d;
	this.chunk = chunk;
	
	/* The GL buffers */
	this.bufferVertPos = null;
	this.bufferVertNormals = null;
	this.bufferTexCoords = null;
	this.bufferVertIndex = null;
	
	
	this.buildLOD = function() {
		var gl = this.g2d.gl;
		
		
		
		gl.bindBuffer(gl.ARRAY_BUFFER, this.bufferVertNormals);
		gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([ 0.0, 0.0, -1.0, 0.0, 0.0, -1.0, 0.0, 0.0, -1.0, 0.0, 0.0, -1.0 ]), gl.DYNAMIC_DRAW);
		
		
		gl.bindBuffer(gl.ARRAY_BUFFER, this.bufferVertPos);
		gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertexes), gl.DYNAMIC_DRAW);
		gl.bindBuffer(gl.ARRAY_BUFFER, this.bufferTexCoords);
		gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(texuvs), gl.DYNAMIC_DRAW);
	}
	
	this.renderLODOnScreen = function() {
		gl.bindBuffer(gl.ARRAY_BUFFER, this.bufferVertPos);
		gl.vertexAttribPointer(this._shader.vertexPositionAttribute, 3, gl.FLOAT, false, 0, 0);
		gl.bindBuffer(gl.ARRAY_BUFFER, this.bufferVertNormals);
		gl.vertexAttribPointer(this._shader.vertexNormalAttribute, 3, gl.FLOAT, false, 0, 0);
		gl.bindBuffer(gl.ARRAY_BUFFER, this.bufferTexCoords);
		gl.vertexAttribPointer(this._shader.textureCoordAttributes[0], 2, gl.FLOAT, false, 0, 0);
		gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.bufferVertIndex);
		gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
	}
	

	this.deleteLOD = function() {

	}

}