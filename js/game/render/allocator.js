var VideoMemError = function(message, causes) {
	this.name = 'VideoMemError';
	this.message = message;
	this.causes = causes;
	this.stack = (new Error()).stack;
}
VideoMemError.prototype = new Error;

/**
 * Graphics card memory manager
 */
var VideoMemAllocator = function(graphics) {

	this.graphics = graphics;
	this.gl = graphics.gl;

	/** A list of all the video heaps */
	this._heaps = [];

	/** A list of all active memory allocations */
	this._allocs = [];

	/** The allocation counter */
	this._allocCounter = 0;

	/**
	 * Creates a new heap on the allocator. The allocator will distribute access
	 * to the buffer according to size and any other allocation restrictions.
	 */
	this.createHeap = function(buffer, pointers, size) {
		var heap = new VideoMemHeap(this, buffer, pointers, size);
		heap.init();
		this._heaps[buffer] = heap;
	}

	/**
	 * Requests an allocation of video memory on a specified buffer of a
	 * specified size. If the buffer is invalid or the allocation cannot be
	 * performed, a VideoMemError is thrown.
	 * 
	 * @param buffer
	 *            The buffer code to write to, from g2d
	 * @param size
	 *            The size of the allocation, coordinates
	 */
	this.allocate = function(buffer, size) {
		if (0 > buffer || buffer >= this._heaps.length)
			throw new VideoMemError("Buffer out of range.", [ buffer ]);
		var buffer = this._heaps[buffer];
		var allocation = buffer.allocRegion(this._allocCounter, buffer
				.toVertexSize(size));
		if (allocation === false)
			throw new VideoMemError("Out of memory on buffer.",
					[ buffer, size ]);
		this._allocCounter++;
		this._heaps.push(allocation);
		return allocation;
	}

	/**
	 * Releases an allocation of video memory from the underlying buffer it is
	 * connected to. The underlying memory at the location of the buffer is NOT
	 * erased, so any remaining content on memory at the location of the buffer
	 * will still be rendered until a new allocation overwrites the data in the
	 * block. If the buffer is invalid or has already been freed, a
	 * VideoMemError is thrown.
	 * 
	 * @param allocation
	 *            The buffer to release
	 */
	this.free = function(allocation) {
		if (allocation == null || allocation == undefined)
			return;
		if (allocation._freed)
			throw new VideoMemError("Already freed allocation.", [ allocation ]);
		var buffer = this._heaps[allocation._bufferId];
		buffer.freeRegion(allocation);
		return true;
	}

	this._flattenMultiMap = function(map) {
		var quart = [], larp = -1;
		for (var i = 0; i < map.length; i++) {
			var ua = map[i];
			if (larp == -1)
				larp = ua.length;
			else
				assert(larp == ua.length, "vertex data length mismatch");
			for (var p = 0; p < larp; p++)
				quart.push(ua[p]);
		}
		return quart;
	}

	this._writeVertexDataForAllocation = function(allocation, vertexes) {
		if (allocation._freed)
			throw new VideoMemError(
					"Can't write data to collected allocation.", [ allocation ]);
		var buffer = this._heaps[allocation._bufferId];
		vertexes = this._flattenMultiMap(vertexes);
		assert(vertexes.length == buffer.toVertexSize(allocation._size),
				"Incorrect number of vertices");
		var pointers = buffer._glptrs;
		this.gl.bindBuffer(this.gl.ARRAY_BUFFER, pointers.bufferVertPos);
		console.log("_writeVertexDataForAllocation", buffer
				.toVertexSize(allocation._offset));
		this.gl.bufferSubData(this.gl.ARRAY_BUFFER, buffer
				.toVertexSize(allocation._offset) * 4, new Float32Array(
				vertexes));
		return true;
	}

	this._writeVertexNormalDataForAllocation = function(allocation, normals) {
		if (allocation._freed)
			throw new VideoMemError(
					"Can't write data to collected allocation.", [ allocation ]);
		var buffer = this._heaps[allocation._bufferId];
		normals = this._flattenMultiMap(normals);
		assert(normals.length == buffer.toVertexSize(allocation._size),
				"Incorrect number of normals");
		var pointers = buffer._glptrs;
		this.gl.bindBuffer(this.gl.ARRAY_BUFFER, pointers.bufferVertNormals);
		console.log("_writeVertexNormalDataForAllocation", buffer
				.toVertexSize(allocation._offset));
		this.gl.bufferSubData(this.gl.ARRAY_BUFFER, buffer
				.toVertexSize(allocation._offset) * 4,
				new Float32Array(normals));
		return true;
	}

	this._writeTextureDataForAllocation = function(allocation, textures) {
		if (allocation._freed)
			throw new VideoMemError(
					"Can't write data to collected allocation.", [ allocation ]);
		var buffer = this._heaps[allocation._bufferId];
		textures = this._flattenMultiMap(textures);
		assert(textures.length == buffer.toTextureSize(allocation._size),
				"Incorrect number of textures");
		var pointers = buffer._glptrs;
		this.gl.bindBuffer(this.gl.ARRAY_BUFFER, pointers.bufferTexCoords);
		console.log("_writeTextureDataForAllocation", buffer
				.toVertexSize(allocation._offset));
		this.gl.bufferSubData(this.gl.ARRAY_BUFFER, buffer
				.toTextureSize(allocation._offset) * 4, new Float32Array(
				textures));
		return true;
	}

	/**
	 * Render a buffer to the screen immediately.
	 * 
	 * @param buffer
	 *            which buffer, from g2d
	 */
	this.paintBufferOnScreen = function(buffer) {
		if (0 > buffer || buffer >= this._heaps.length)
			throw new VideoMemError("Buffer out of range.", [ buffer ]);
		var buffer = this._heaps[buffer];

		var gl = this.gl;
		gl.bindBuffer(gl.ARRAY_BUFFER, buffer._glptrs.bufferVertPos);
		gl.vertexAttribPointer(this.graphics._shader.vertexPositionAttribute,
				3, gl.FLOAT, false, 0, 0);

		gl.bindBuffer(gl.ARRAY_BUFFER, buffer._glptrs.bufferVertNormals);
		gl.vertexAttribPointer(this.graphics._shader.vertexNormalAttribute, 3,
				gl.FLOAT, false, 0, 0);

		gl.bindBuffer(gl.ARRAY_BUFFER, buffer._glptrs.bufferTexCoords);
		gl.vertexAttribPointer(this.graphics._shader.textureCoordAttributes[0],
				2, gl.FLOAT, false, 0, 0);

		gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffer._glptrs.bufferVertIndex);
		gl.drawElements(gl.TRIANGLES, buffer._size, gl.UNSIGNED_SHORT, 0);
	}
}

var VideoMemHeap = function(allocator, bufferId, glptrs, size) {
	this._allocator = allocator;
	this._bufferId = bufferId;
	this._glptrs = glptrs;
	this._size = size;
	this._allocations = new Array(size);
	this._saturation = 0;

	this.init = function() {
		assert(this._glptrs.bufferVertPos != null,
				"missing vertex buffer for heap");
		assert(this._glptrs.bufferVertNormals != null,
				"missing vertex normal buffer for heap");
		assert(this._glptrs.bufferTexCoords != null,
				"missing vertex texture data buffer for heap");
		assert(this._glptrs.bufferVertIndex != null,
				"missing vertex index buffer for heap");
		for (var i = 0; i < this._size; i++)
			this._allocations[i] = -1;
		assert(this._allocations.length == this._size,
				"incorrectly generated video allocation map");
	}

	this.toVertexSize = function(sizeof) {
		return sizeof * 3;
	}
	this.fromVertexSize = function(sizeof) {
		assert((sizeof % 3) == 0, "non multiple-of-three vertex size");
		return Math.ceil(sizeof / 3);
	}
	this.toTextureSize = function(sizeof) {
		return sizeof * 2;
	}
	this.fromTextureSize = function(sizeof) {
		assert((sizeof % 2) == 0, "non multiple-of-two texture size");
		return Math.ceil(sizeof / 2);
	}

	/**
	 * Allocate a region on this buffer. If the buffer does not have enough
	 * space, a VideoMemError is thrown.
	 * 
	 * @param allocId
	 *            the unique allocation gid
	 * @param size
	 *            the size of the request
	 * @returns the vma which was created to host the request
	 */
	this.allocRegion = function(allocId, size) {
		var zero = -1, space = 0;

		var density = this._size - this._saturation;
		if (size > density)
			throw new VideoMemError("Insufficient buffer space.", [ size,
					this._size, density ]);

		for (var i = 0; i < this._size; i++) {
			var state = this._allocations[i];
			if (state == -1) {
				if (zero == -1)
					zero = i;
				space++;
				if (space == size)
					break;
			} else {
				zero = -1;
				space = 0;
			}
		}

		if (zero != -1 && space == size) {
			var vma = new VideoMemAllocation(this._allocator, this._bufferId,
					allocId, this.fromVertexSize(zero), this
							.fromVertexSize(size));
			console.log("performing memory allocation", zero, space);
			for (var i = zero; i < zero + space; i++) {
				this._allocations[i] = allocId;
				this._saturation++;
			}
			return vma;
		} else
			throw new VideoMemError(
					"Cannot find contiguous region of specified size.",
					[ size ]);
	}

	/**
	 * Free a region on this buffer. If the region has been reallocated already,
	 * a VideoMemError is thrown.
	 * 
	 * @param alloc
	 *            The allocation to free
	 */
	this.freeRegion = function(alloc) {
		var o = this.toVertexSize(alloc._offset), s = this
				.toVertexSize(alloc._size);
		for (var i = o; i < o + s; i++) {
			if (this._allocations[i] != alloc._allocId)
				throw new VideoMemError(
						"Unable to deallocate already reallocated region.",
						[ alloc ]);
		}
		console.log("performing memory free", o, s);
		for (var i = o; i < o + s; i++) {
			this._allocations[i] = -1;
			this._saturation--;
		}
		alloc._freed = true;
	}

	this.getSize = function() {
		return this._size;
	}

	this.getSaturation = function() {
		return this._saturation;
	}

	this.getFreeSpace = function() {
		return this._size - this._saturation;
	}

}

/**
 * Video memory allocation
 */
var VideoMemAllocation = function(allocator, buffer, alloc, offset, size) {
	this._allocator = allocator;
	this._bufferId = buffer;
	this._allocId = alloc;

	this._offset = offset;
	this._size = size;

	this._freed = false;

	this.toString = function() {
		return "VideoMemAllocation {" + this._bufferId + ", " + this._allocId
				+ " (" + this._offset + ", " + this._size + ")}";
	}

	this.alive = function() {
		return !this._freed;
	}

	this.getSize = function() {
		return this._size;
	}
	this.getOffset = function() {
		return this._offset;
	}

	/**
	 * Write some vertex data vertexes to the buffer underlying this allocation.
	 * The data is immediately committed to the graphics card memory and will be
	 * rendered the next time the underlying buffer is repainted on the screen.
	 * 
	 * @param vertexes
	 *            The vertexarray to commit
	 */
	this.writeVertexData = function(vertexes) {
		return this._allocator._writeVertexDataForAllocation(this, vertexes);
	}

	/**
	 * Write some vertex normal data normals to the buffer underlying this
	 * allocation. The data is immediately committed to the graphics card memory
	 * and will be rendered the next time the underlying buffer is repainted on
	 * the screen.
	 * 
	 * @param normals
	 *            The normalsarray to commit
	 */
	this.writeVertexNormalData = function(normals) {
		return this._allocator._writeVertexNormalDataForAllocation(this,
				normals);
	}

	/**
	 * Write some texture data textures to the buffer underlying this
	 * allocation. The data is immediately committed to the graphics card memory
	 * and will be rendered the next time the underlying buffer is repainted on
	 * the screen.
	 * 
	 * @param textures
	 *            The texturesarray to commit
	 */
	this.writeTextureData = function(textures) {
		return this._allocator._writeTextureDataForAllocation(this, textures);
	}
}