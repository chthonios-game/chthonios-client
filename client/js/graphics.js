/**
 * OpenGL wrapper application for treating webgl as 2D environments
 */

"use strict";

var g2d = function(context) {

	/* Helper constants */
	this.GL_QUAD = "QUAD"; // the only thing we can do right now, sorry

	/* Graphics contexts */
	this.context = context;
	this.gl = null;
	this.camera = null;

	/* The model view matrix */
	this.mvMatrix = mat4.create();
	/* The projection matrix */
	this.pMatrix = mat4.create();
	/* The model view matrix stack (glPushMatrix/glPopMatrix) */
	this.mvMatrixStack = [];

	/* The GL buffers */
	this.cubeVertexPositionBuffer = null;
	this.cubeVertexNormalBuffer = null;
	this.cubeVertexTextureCoordBuffer = null;
	this.cubeVertexIndexBuffer = null;

	/* Tesselator-like buffering */
	this.inVertexBuffer = [];
	this.inTexCoordBuffer = [];

	this.init = function() {
		this.gl = this.context.getContext("experimental-webgl");
		this.gl.viewportWidth = this.context.width;
		this.gl.viewportHeight = this.context.height;

		this.camera = new g2d.camera();

		var gl = this.gl;
		gl.clearColor(0.0, 0.0, 0.0, 1.0);
		gl.enable(gl.DEPTH_TEST);

		this.cubeVertexPositionBuffer = gl.createBuffer();
		gl.bindBuffer(gl.ARRAY_BUFFER, this.cubeVertexPositionBuffer);
		var vertices = [ -1.0, -1.0, -1.0, -1.0, 1.0, -1.0, 1.0, 1.0, -1.0, 1.0, -1.0, -1.0 ];
		gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.DYNAMIC_DRAW);
		this.cubeVertexPositionBuffer.itemSize = 3;
		this.cubeVertexPositionBuffer.numItems = 4;

		this.cubeVertexTextureCoordBuffer = gl.createBuffer();
		gl.bindBuffer(gl.ARRAY_BUFFER, this.cubeVertexTextureCoordBuffer);
		var textureCoords = [ 0.0, 0.0, 0.0, 1.0, 1.0, 1.0, 1.0, 0.0 ];
		gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(textureCoords), gl.DYNAMIC_DRAW);
		this.cubeVertexTextureCoordBuffer.itemSize = 2;
		this.cubeVertexTextureCoordBuffer.numItems = 4;

		this.cubeVertexNormalBuffer = gl.createBuffer();
		gl.bindBuffer(gl.ARRAY_BUFFER, this.cubeVertexNormalBuffer);
		var vertexNormals = [ 0.0, 0.0, -1.0, 0.0, 0.0, -1.0, 0.0, 0.0, -1.0, 0.0, 0.0, -1.0 ];
		gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertexNormals), gl.DYNAMIC_DRAW);
		this.cubeVertexNormalBuffer.itemSize = 3;
		this.cubeVertexNormalBuffer.numItems = 4;

		this.cubeVertexIndexBuffer = gl.createBuffer();
		gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.cubeVertexIndexBuffer);
		var cubeVertexIndices = [ 0, 1, 2, 0, 2, 3 ];
		gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(cubeVertexIndices), gl.DYNAMIC_DRAW);
		this.cubeVertexIndexBuffer.itemSize = 1;
		this.cubeVertexIndexBuffer.numItems = 6;
	}

	/**
	 * Resize the viewport. g2d will assess the new context size and apply this
	 * to the projection matrix.
	 */
	this.resize = function() {
		this.gl.viewportWidth = this.context.width;
		this.gl.viewportHeight = this.context.height;
	}

	this.generateTexture = function(bitmap) {
		var texture = new g2d.texture(this, bitmap);
		texture.init();
		return texture;
	}

	/**
	 * Compile a single shader script.
	 * 
	 * @param program
	 *            The shader script
	 * @param type
	 *            The type of shader script (x-fragment or x-vertex)
	 */
	this.generateShaderScript = function(program, type) {
		var shader;
		if (type == "x-shader/x-fragment")
			shader = this.gl.createShader(this.gl.FRAGMENT_SHADER);
		else if (type == "x-shader/x-vertex")
			shader = this.gl.createShader(this.gl.VERTEX_SHADER);
		else
			throw new g2d.error("Unsupported shader type provided.");

		this.gl.shaderSource(shader, program);
		this.gl.compileShader(shader);

		if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
			console.error(this.gl.getShaderInfoLog(shader));
			throw new g2d.error("GL error compiling shader script, check log.");
		}

		return shader;
	}

	/**
	 * Compile a shader program.
	 * 
	 * @param fragment
	 *            The fragment script
	 * @param vertext
	 *            The vertex script
	 */
	this.generateShaderProgram = function(fragment, vertex) {
		var fragmentShader = this.generateShaderScript(fragment, "x-shader/x-fragment");
		var vertexShader = this.generateShaderScript(vertex, "x-shader/x-vertex");

		var p = this.gl.createProgram();
		this.gl.attachShader(p, vertexShader);
		this.gl.attachShader(p, fragmentShader);
		this.gl.linkProgram(p);

		if (!this.gl.getProgramParameter(p, this.gl.LINK_STATUS)) {
			console.error(this.gl.getProgramInfoLog(p));
			throw new g2d.error("GL error compiling shader program, check log.");
		}

		p.vertexPositionAttribute = this.gl.getAttribLocation(p, "aVertexPosition");
		p.vertexNormalAttribute = this.gl.getAttribLocation(p, "aVertexNormal");
		p.textureCoordAttribute = this.gl.getAttribLocation(p, "aTextureCoord");

		p.pMatrixUniform = this.gl.getUniformLocation(p, "uPMatrix");
		p.mvMatrixUniform = this.gl.getUniformLocation(p, "uMVMatrix");
		p.nMatrixUniform = this.gl.getUniformLocation(p, "uNMatrix");
		p.samplerUniform = this.gl.getUniformLocation(p, "uSampler");
		p.useLightingUniform = this.gl.getUniformLocation(p, "uUseLighting");
		p.ambientColorUniform = this.gl.getUniformLocation(p, "uAmbientColor");
		p.lightingDirectionUniform = this.gl.getUniformLocation(p, "uLightingDirection");
		p.directionalColorUniform = this.gl.getUniformLocation(p, "uDirectionalColor");
		p.alphaUniform = this.gl.getUniformLocation(p, "uAlpha");

		return p;
	}

	/**
	 * Switch to a GL shader program
	 * 
	 * @param program
	 *            The GL shader program
	 */
	this.useShaderProgram = function(program) {
		this._shader = program;
		this.gl.useProgram(this._shader);
		this.gl.enableVertexAttribArray(this._shader.vertexPositionAttribute);
		this.gl.enableVertexAttribArray(this._shader.vertexNormalAttribute);
		this.gl.enableVertexAttribArray(this._shader.textureCoordAttribute);
		this._updateShaderProgram();
	}

	this._mvUpdated = function() {
		this._updateShaderProgram();
	}

	this._updateShaderProgram = function() {
		if (this._shader == null)
			console.warn("_updateShaderProgram expected _shader to be configured, check useShaderProgram before gl* call");
		else {
			this.gl.uniformMatrix4fv(this._shader.pMatrixUniform, false, this.pMatrix);
			this.gl.uniformMatrix4fv(this._shader.mvMatrixUniform, false, this.mvMatrix);
			var normalMatrix = mat3.create();
			mat3.fromMat4(normalMatrix, this.mvMatrix)
			mat3.invert(normalMatrix, normalMatrix);
			this.gl.uniformMatrix3fv(this._shader.nMatrixUniform, false, normalMatrix);
		}
	}

	/**
	 * Push the model view matrix onto the stack (glPushMatrix).
	 */
	this.glPushMatrix = function() {
		var copy = mat4.create();
		mat4.copy(copy, this.mvMatrix);
		this.mvMatrixStack.push(copy);
	}

	/**
	 * Pop the model view matrix from the stack (glPopMatrix).
	 */
	this.glPopMatrix = function() {
		if (this.mvMatrixStack.length == 0)
			throw new g2d.error("Modelview stack underflow, too many pop() for push()!");
		this.mvMatrix = this.mvMatrixStack.pop();
		this._mvUpdated();
	}

	/**
	 * Translate the model view matrix (glTranslatef).
	 */
	this.glTranslatef = function(xf, yf, zf) {
		mat4.translate(this.mvMatrix, this.mvMatrix, [ xf, yf, zf ]);
		this._mvUpdated();
	}

	/**
	 * Scale the model view matrix (glScalef).
	 */
	this.glScalef = function(xs, ys, zs) {
		mat4.scale(this.mvMatrix, this.mvMatrix, [ xs, ys, zs ]);
		this._mvUpdated();
	}

	/**
	 * Start drawing
	 */
	this.beginDrawing = function() {
		this.gl.viewport(0, 0, this.gl.viewportWidth, this.gl.viewportHeight);
		var gl = this.gl;
		gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
		mat4.perspective(this.pMatrix, 45, this.gl.viewportWidth / this.gl.viewportHeight, 0.1, 100.0);
		mat4.identity(this.mvMatrix);
		this.camera.applyCamera(this);
		this._mvUpdated();

		gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
		gl.enable(gl.BLEND);
		gl.disable(gl.DEPTH_TEST);
		gl.uniform1f(this._shader.alphaUniform, 0.5);
		gl.uniform3f(this._shader.ambientColorUniform, 0.2, 0.2, 0.2);
		var lightingDirection = [ -0.25, -0.25, -1.0 ];
		var adjustedLD = vec3.create();
		vec3.normalize(adjustedLD, lightingDirection);
		vec3.scale(adjustedLD, adjustedLD, -1);
		gl.uniform3fv(this._shader.lightingDirectionUniform, adjustedLD);
		gl.uniform3f(this._shader.directionalColorUniform, 0.8, 0.8, 0.8);
	}

	/**
	 * Start drawing a shape stencil (glBegin). Supported modes are GL_TRIANGLE
	 * and GL_QUAD only.
	 */
	this.glBegin = function(amode) {
		if (this._mode != null)
			throw new g2d.error("Cannot glBegin() before glEnd()!");
		if (this._shader == null)
			throw new g2d.error("Missing shader program before glBegin()!");
		var gl = this.gl;
		if (amode == this.GL_QUAD) {
			gl.bindBuffer(gl.ARRAY_BUFFER, this.cubeVertexPositionBuffer);
			gl.vertexAttribPointer(this._shader.vertexPositionAttribute, this.cubeVertexPositionBuffer.itemSize, gl.FLOAT, false, 0, 0);

			gl.bindBuffer(gl.ARRAY_BUFFER, this.cubeVertexNormalBuffer);
			gl.vertexAttribPointer(this._shader.vertexNormalAttribute, this.cubeVertexNormalBuffer.itemSize, gl.FLOAT, false, 0, 0);

			gl.bindBuffer(gl.ARRAY_BUFFER, this.cubeVertexTextureCoordBuffer);
			gl.vertexAttribPointer(this._shader.textureCoordAttribute, this.cubeVertexTextureCoordBuffer.itemSize, gl.FLOAT, false, 0, 0);
			this._mode = amode;
		} else {
			throw new g2d.error("Unsupported mode!");
		}
	}

	this.glVertex3T = function(x, y, z, u, v) {
		this.inVertexBuffer.push(x, y, z);
		this.inTexCoordBuffer.push(u, v);
	}

	/**
	 * Paint the current shape stencil at the modelview matrix.
	 */
	this.glPaint = function() {
		if (this._mode == null)
			throw new g2d.error("Cannot glPaint() before glBegin()!");
		var gl = this.gl;
		if (this._mode == this.GL_QUAD) {
			gl.bindBuffer(gl.ARRAY_BUFFER, this.cubeVertexPositionBuffer);
			gl.bufferSubData(gl.ARRAY_BUFFER, 0, new Float32Array(this.inVertexBuffer));
			this.inVertexBuffer.splice(0, this.inVertexBuffer.length);

			gl.bindBuffer(gl.ARRAY_BUFFER, this.cubeVertexTextureCoordBuffer);
			gl.bufferSubData(gl.ARRAY_BUFFER, 0, new Float32Array(this.inTexCoordBuffer));
			this.inTexCoordBuffer.splice(0, this.inTexCoordBuffer.length);

			gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.cubeVertexIndexBuffer);
			gl.drawElements(gl.TRIANGLES, this.cubeVertexIndexBuffer.numItems, gl.UNSIGNED_SHORT, 0);
		} else {
			throw new g2d.error("Unsupported mode!");
		}
	}

	/**
	 * End drawing a shape stencil.
	 */
	this.glEnd = function() {
		if (this._mode == null)
			throw new g2d.error("Cannot glEnd() before glBegin()!");
		this._mode = null;
	}

	/**
	 * Finish drawing
	 */
	this.endDrawing = function() {

	},

	/**
	 * Update the camera projection matrix.
	 */
	this.updateLook = function(eye, target, upvec) {
		mat4.lookAt(this.mvMatrix, eye, target, upvec);
	}

	/**
	 * Unproject a ray.
	 */
	this.unproject = function(winx, winy, winz) {
		if (typeof (winz) == "number") {
			var m = mat4.create();
			mat4.copy(m, this.mvMatrix); /* copy mv -> m */
			mat4.multiply(m, this.pMatrix, m); /* mul project * m -> m */
			mat4.invert(m, m); /* invert m -> m */

			/*
			 * Normalize all the coordinates. Take (0, 0) -> (vw, vh) and turn
			 * (winx, winy, winz) into scaled fractions of (0, 0) -> (vw, vh).
			 */
			var viewport = [ 0, 0, this.gl.viewportWidth, this.gl.viewportHeight ];
			var inf = [ (winx - viewport[0]) / viewport[2] * 2.0 - 1.0, (winy - viewport[1]) / viewport[3] * 2.0 - 1.0, 2.0 * winz - 1.0,
					1.0 ];

			var out = vec4.create();
			vec4.transformMat4(out, inf, m); /* transform out by inf * m */
			if (out[3] == 0.0) /* bad raycast ? */
				return null;
			out[3] = 1.0 / out[3]; /* normalize dof */
			return [ out[0] * out[3], out[1] * out[3], out[2] * out[3] ];

		} else
			return [ /* dual project for both: */
			this.unproject(winx, winy, 0), /* project = minima */
			this.unproject(winx, winy, 1) /* project = maxima */
			];
	}

};

g2d.camera = function(g2d) {
	this.x = 0;
	this.y = 0;
	this.zoom = 0.0;

	this.focusOnCoords = function(x, y, zoom) {
		this.x = x;
		this.y = y;
		if (zoom && typeof (zoom) == "number")
			this.zoom = zoom;
	}

	this.panCamera = function(x, y) {
		this.x += x;
		this.y += y;
	}

	this.zoomCamera = function(zoom) {
		if (this.zoom + zoom >= 0)

			this.zoom += zoom;
	};

	this.applyCamera = function(g2d) {
		g2d.updateLook([ this.x, this.y, 0.01 + this.zoom ], [ this.x, this.y, 0.0 ], [ 0.0, 1.0, 0.0 ]);
	}
};

g2d.error = function(message) {
	this.name = 'g2d.error';
	this.message = message;
	this.stack = (new Error()).stack;
}
g2d.error.prototype = new Error;

g2d.texturebuffer = function(g2d, width, height) {

	this.g2d = g2d;
	this.width = width;
	this.height = height;

	this.fbo = null;
	this.rb = null;
	this.texture = null;

	this.init = function() {
		var gl = this.g2d.gl;
		this.fbo = gl.createFramebuffer();
		this.texture = gl.createTexture();
		this.rb = gl.createRenderbuffer();

		this.fbo.width = this.width;
		this.fbo.height = this.height;

		gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
		gl.bindTexture(gl.TEXTURE_2D, this.texture);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_NEAREST);
		gl.generateMipmap(gl.TEXTURE_2D);
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, this.fbo.width, this.fbo.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
		gl.bindRenderbuffer(gl.RENDERBUFFER, this.rb);
		gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH24_STENCIL8, this.fbo.width, this.fbo.height);
		gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.texture, 0);
		gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, this.rb);
		gl.bindTexture(gl.TEXTURE_2D, null);
		gl.bindRenderbuffer(gl.RENDERBUFFER, null);
		gl.bindFramebuffer(gl.FRAMEBUFFER, null);
	}

	this.resize = function(width, height) {
		var gl = this.g2d.gl;
		this.fbo.width = this.width;
		this.fbo.height = this.height;
		gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
		gl.bindTexture(gl.TEXTURE_2D, this.texture);
		gl.bindRenderbuffer(gl.RENDERBUFFER, this.rb);

		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, this.fbo.width, this.fbo.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
		gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH24_STENCIL8, this.fbo.width, this.fbo.height);

		gl.bindTexture(gl.TEXTURE_2D, null);
		gl.bindRenderbuffer(gl.RENDERBUFFER, null);
		gl.bindFramebuffer(gl.FRAMEBUFFER, null);
	}

	this.dispose = function() {
		gl.deleteRenderbuffer(this.rb);
		gl.deleteTexture(this.texture);
		gl.deleteFramebuffer(this.fbo);
	}

	this.bind = function() {
		this.g2d.gl.bindFramebuffer(this.g2d.gl.FRAMEBUFFER, this.fbo);
	}
	this.release = function() {
		this.g2d.gl.bindFramebuffer(this.g2d.gl.FRAMEBUFFER, null);
	}

	this.bind = function() {
		this.g2d.gl.activeTexture(this.g2d.gl.TEXTURE0);
		this.g2d.gl.bindTexture(this.g2d.gl.TEXTURE_2D, this.texture);
	}

	this.release = function() {
		this.g2d.gl.bindTexture(this.g2d.gl.TEXTURE_2D, null);
	}

}

g2d.texture = function(g2d, bitmap) {
	this.bitmap = bitmap;
	this.texture = null;
	this.g2d = g2d;

	this.init = function() {
		var gl = this.g2d.gl;
		this.texture = gl.createTexture();
		gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
		gl.bindTexture(gl.TEXTURE_2D, this.texture);
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, g2d.gl.RGBA, gl.UNSIGNED_BYTE, this.bitmap);

		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
		gl.bindTexture(gl.TEXTURE_2D, null);
	}

	this.bind = function() {
		this.g2d.gl.activeTexture(this.g2d.gl.TEXTURE0);
		this.g2d.gl.bindTexture(this.g2d.gl.TEXTURE_2D, this.texture);
	}

	this.release = function() {
		this.g2d.gl.bindTexture(this.g2d.gl.TEXTURE_2D, null);
	}
}