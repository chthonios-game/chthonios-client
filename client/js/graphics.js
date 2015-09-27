/**
 * OpenGL wrapper application for treating webgl as 2D environments
 */

"use strict";

var g2d = function(context) {

	/* Helper constants */
	this.GL_TRIANGLE = "TRIANGLE";
	this.GL_QUAD = "QUAD";

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
	this.bufferVertPos = null;
	this.bufferVertNormals = null;
	this.bufferTexCoords = null;
	this.bufferVertIndex = null;

	this.init = function() {
		this.gl = this.context.getContext("webgl") || this.context.getContext("experimental-webgl");
		this.gl.viewportWidth = this.context.width;
		this.gl.viewportHeight = this.context.height;

		this.camera = new g2d.camera();

		var gl = this.gl;
		gl.clearColor(100.0 / 255.0, 149 / 255.0, 237 / 255.0, 1.0);
		gl.enable(gl.DEPTH_TEST);

		this.bufferVertPos = gl.createBuffer();
		this.bufferTexCoords = gl.createBuffer();
		this.bufferVertNormals = gl.createBuffer();
		this.bufferVertIndex = gl.createBuffer();

		/*
		 * Vertex index buffer. Controls vertex indexing; normally doesn't
		 * change, so we're going to initialize it here with working data.
		 */
		gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.bufferVertIndex);
		var vi = [ 0, 1, 2, 0, 2, 3 ];
		gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(vi), gl.DYNAMIC_DRAW);
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
			shader = this.gl.createShader(this.gl.FRAGMENT_SHADER); /* frag mode */
		else if (type == "x-shader/x-vertex")
			shader = this.gl.createShader(this.gl.VERTEX_SHADER); /* vert mode */
		else
			throw new g2d.error("Unsupported shader type provided.");

		this.gl.shaderSource(shader, program); /* source the shader */
		this.gl.compileShader(shader); /* compile the shader */

		if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
			console.error(this.gl.getShaderInfoLog(shader)); /* not okay :( */
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
		this.gl.attachShader(p, vertexShader); /* Bind vertex shader */
		this.gl.attachShader(p, fragmentShader); /* Bind fragment shader */
		this.gl.linkProgram(p); /* assemble program */

		if (!this.gl.getProgramParameter(p, this.gl.LINK_STATUS)) {
			console.error(this.gl.getProgramInfoLog(p));
			throw new g2d.error("GL error compiling shader program, check log.");
		}

		/*
		 * Grab a bunch of properties from the x-fragment and x-vertex shader
		 * scripts. The GLAtrributeLocation objects returned are like pointers,
		 * which we can later use to assign values to properties in our shader
		 * on the GPU directly.
		 */
		p.vertexPositionAttribute = this.gl.getAttribLocation(p, "aVertexPosition");
		p.vertexNormalAttribute = this.gl.getAttribLocation(p, "aVertexNormal");
		p.textureCoordAttribute = this.gl.getAttribLocation(p, "aTextureCoord");

		p.pMatrixUniform = this.gl.getUniformLocation(p, "uPMatrix");
		p.nMatrixUniform = this.gl.getUniformLocation(p, "uNMatrix");
		p.mvMatrixUniform = this.gl.getUniformLocation(p, "uMVMatrix");

		p.samplerUniform = this.gl.getUniformLocation(p, "uSampler");
		p.alphaUniform = this.gl.getUniformLocation(p, "uAlpha");
		p.alphaMask = this.gl.getUniformLocation(p, "uAlphaMask");
		p.useLightingUniform = this.gl.getUniformLocation(p, "uUseLighting");

		p.useStaticColor = this.gl.getUniformLocation(p, "uUseStaticColor");
		p.staticColorUniform = this.gl.getUniformLocation(p, "uStaticColor");
		p.colorMultiplierUniform = this.gl.getUniformLocation(p, "uColorMultip");

		p.ambientColorUniform = this.gl.getUniformLocation(p, "uAmbientColor");
		p.lightingDirectionUniform = this.gl.getUniformLocation(p, "uLightingDirection");
		p.directionalColorUniform = this.gl.getUniformLocation(p, "uDirectionalColor");

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
		/* Tell GL to switch to our shader */
		this.gl.useProgram(this._shader);
		/*
		 * Make sure our shader has vertex, normal and coordinate attributes set
		 * as array types, and enable them so we can bind values.
		 */
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
			/* Point the projection matrix shader uniform to the proj. matrix. */
			this.gl.uniformMatrix4fv(this._shader.pMatrixUniform, false, this.pMatrix);
			/* Point the modelview matrix shader uniform to the mv. matrix. */
			this.gl.uniformMatrix4fv(this._shader.mvMatrixUniform, false, this.mvMatrix);
			/*
			 * The normal matrix shader uniform is the inverse of the modelview
			 * matrix. Copy it, invert it and set it.
			 */
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

	this.glLighting = function(mode) {
		this.gl.uniform1i(this._shader.useLightingUniform, (mode ? 1 : 0));
	}

	this.glStaticColor = function(mode) {
		this.gl.uniform1i(this._shader.useStaticColor, (mode ? 1 : 0));
	}

	this.glAlphaCull = function(val) {
		this.gl.uniform1f(this._shader.alphaMask, val);
	}

	this.glColorFill = function(r, g, b, a) {
		this.gl.uniform4f(this._shader.staticColorUniform, r, g, b, a);
	}

	this.glColorMultiplier = function(r, g, b, a) {
		this.gl.uniform4f(this._shader.colorMultiplierUniform, r, g, b, a);
	}

	this.glAlphaWeighting = function(weight) {
		this.gl.uniform1f(this._shader.alphaUniform, weight);
	}

	this.glAmbientLight = function(r, g, b) {
		this.gl.uniform3f(this._shader.ambientColorUniform, r, g, b);
	}

	this.glSpotLight = function(x, y, z, r, g, b) {
		var lightingDirection = [ x, y, z ];
		var adjustedLD = vec3.create();
		vec3.normalize(adjustedLD, lightingDirection);
		vec3.scale(adjustedLD, adjustedLD, -1);
		/* Set light position */
		gl.uniform3fv(this._shader.lightingDirectionUniform, adjustedLD);
		/* Set light color uniform */
		gl.uniform3f(this._shader.directionalColorUniform, r, g, b);
	}

	/**
	 * Start drawing
	 */
	this.beginDrawing = function() {
		var gl = this.gl;
		gl.viewport(0, 0, gl.viewportWidth, gl.viewportHeight);
		gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
		mat4.perspective(this.pMatrix, 45, gl.viewportWidth / gl.viewportHeight, 0.1, 100.0);
		mat4.identity(this.mvMatrix);
		this.camera.applyCamera(this);
		this._mvUpdated();
		gl.enable(gl.BLEND);
		gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
		gl.disable(gl.DEPTH_TEST);
		gl.depthFunc(gl.LESS);

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
		if (amode == this.GL_TRIANGLE) {
			gl.bindBuffer(gl.ARRAY_BUFFER, this.bufferVertNormals);
			var vi = [ 0.0, 0.0, -1.0, 0.0, 0.0, -1.0, 0.0, 0.0, -1.0 ];
			gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vi), gl.DYNAMIC_DRAW);

			gl.bindBuffer(gl.ARRAY_BUFFER, this.bufferVertPos);
			gl.vertexAttribPointer(this._shader.vertexPositionAttribute, 3, gl.FLOAT, false, 0, 0);

			gl.bindBuffer(gl.ARRAY_BUFFER, this.bufferVertNormals);
			gl.vertexAttribPointer(this._shader.vertexNormalAttribute, 3, gl.FLOAT, false, 0, 0);

			gl.bindBuffer(gl.ARRAY_BUFFER, this.bufferTexCoords);
			gl.vertexAttribPointer(this._shader.textureCoordAttribute, 2, gl.FLOAT, false, 0, 0);
			this._mode = amode;
		} else if (amode == this.GL_QUAD) {
			gl.bindBuffer(gl.ARRAY_BUFFER, this.bufferVertNormals);
			var vi = [ 0.0, 0.0, -1.0, 0.0, 0.0, -1.0, 0.0, 0.0, -1.0, 0.0, 0.0, -1.0 ];
			gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vi), gl.DYNAMIC_DRAW);

			gl.bindBuffer(gl.ARRAY_BUFFER, this.bufferVertPos);
			gl.vertexAttribPointer(this._shader.vertexPositionAttribute, 3, gl.FLOAT, false, 0, 0);

			gl.bindBuffer(gl.ARRAY_BUFFER, this.bufferVertNormals);
			gl.vertexAttribPointer(this._shader.vertexNormalAttribute, 3, gl.FLOAT, false, 0, 0);

			gl.bindBuffer(gl.ARRAY_BUFFER, this.bufferTexCoords);
			gl.vertexAttribPointer(this._shader.textureCoordAttribute, 2, gl.FLOAT, false, 0, 0);
			this._mode = amode;
		} else {
			throw new g2d.error("Unsupported mode!");
		}
	}

	this.glWriteVertexMap = function(vertexes, texuvs) {
		if (this._mode == null)
			throw new g2d.error("Cannot glWriteVertexMap() before glBegin()!");
		var gl = this.gl;
		if (this._mode == this.GL_TRIANGLE) {
			gl.bindBuffer(gl.ARRAY_BUFFER, this.bufferVertPos);
			gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertexes), gl.DYNAMIC_DRAW);
			if (texuvs != null && texuvs.length != 0) {
				gl.bindBuffer(gl.ARRAY_BUFFER, this.bufferTexCoords);
				gl.bufferData(gl.ARRAY_BUFFER, 0, new Float32Array(texuvs), gl.DYNAMIC_DRAW);
			}
		} else if (this._mode == this.GL_QUAD) {
			gl.bindBuffer(gl.ARRAY_BUFFER, this.bufferVertPos);
			gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertexes), gl.DYNAMIC_DRAW);
			if (texuvs != null && texuvs.length != 0) {
				gl.bindBuffer(gl.ARRAY_BUFFER, this.bufferTexCoords);
				gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(texuvs), gl.DYNAMIC_DRAW);
			}
		} else {
			throw new g2d.error("Unsupported mode!");
		}
	}

	/**
	 * Paint the current shape stencil at the modelview matrix.
	 */
	this.glPaint = function() {
		if (this._mode == null)
			throw new g2d.error("Cannot glPaint() before glBegin()!");
		var gl = this.gl;
		if (this._mode == this.GL_TRIANGLE) {
			gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.bufferVertIndex);
			gl.drawElements(gl.TRIANGLES, 3, gl.UNSIGNED_SHORT, 0);
		} else if (this._mode == this.GL_QUAD) {
			gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.bufferVertIndex);
			gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
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
	 * Unproject a ray. Converts a set of on-screen coordinates (usually mouse)
	 * and projects them into camera space so that the coordinates of the cursor
	 * can be derived. If a z-depth is provided, the depth represents a position
	 * between [0, 1] where the depth is the position from the front (z=0) and
	 * back (z=1) planes of the camera frustum. If no z-depth is provided, the
	 * cast is performed between the minima (z=0) and the maxima (z=1).
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

var g2dutil = {
	saveProperties : function(obj) {
		var props = {};
		Object.keys(obj).forEach(function(key) {
			if (Object.getOwnPropertyDescriptor(obj, key).writable)
				props[key] = obj[key];
		});
		return props;
	},

	restoreProperties : function(props, obj) {
		Object.keys(props).forEach(function(key) {
			obj[key] = props[key];
		});
	},

	resizeCanvas : function(canvas, width, height) {
		/*
		 * Back up all the canvas properties: performing a resize on the canvas,
		 * the canvas context or the other size properties causes some (all?)
		 * browsers to reset everything about the canvas, which is *bad*.
		 */
		var __properties = g2dutil.saveProperties(canvas);
		canvas.canvas.width = width;
		canvas.canvas.height = height;
		g2dutil.restoreProperties(__properties, canvas);
	}
}

g2d.camera = function(g2d) {
	this.fx = 0;
	this.fy = 0;
	this.fz = 0;
	this.gimballX = 0;
	this.gimballY = 0;
	this.gimballZ = 0.1;
	this.zoom = 0.0;

	this.focusOnCoords = function(x, y, zoom) {
		this.fx = x;
		this.fy = y;
		if (zoom && typeof (zoom) == "number")
			this.zoom = zoom;
	}

	this.panCamera = function(x, y) {
		this.fx += x;
		this.fy += y;
	}

	this.zoomCamera = function(zoom) {
		if (this.zoom + zoom >= 0)
			this.zoom += zoom;
	};

	this.applyCamera = function(g2d) {
		g2d.updateLook([ this.gimballX, this.gimballY, this.gimballZ + this.zoom ], [ this.fx, this.fy, this.fz ], [ 0.0, 1.0, 0.0 ]);
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

	/** The underlying framebuffer */
	this.fbo = null;
	/** The renderbuffer */
	this.rb = null;
	/** The tex2d texture */
	this.texture = null;

	this.init = function() {
		var gl = this.g2d.gl;
		/* Populate the pointers */
		this.fbo = gl.createFramebuffer();
		this.texture = gl.createTexture();
		this.rb = gl.createRenderbuffer();

		/* Resize the FBO */
		this.fbo.width = this.width;
		this.fbo.height = this.height;

		gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo); /* fbo -> mem */
		gl.bindTexture(gl.TEXTURE_2D, this.texture); /* tex -> mem */
		/* tex->mag = linear */
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
		/* tex->min = use mipmap instead */
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_NEAREST);
		/* build a mipmap for this tex */
		gl.generateMipmap(gl.TEXTURE_2D);
		/* build the texture in rgba USB */
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, this.fbo.width, this.fbo.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);

		gl.bindRenderbuffer(gl.RENDERBUFFER, this.rb); /* rb -> mem */
		/* Put stencil and depth data onto the fbo */
		gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH24_STENCIL8, this.fbo.width, this.fbo.height);
		/* Put the fragshad out from fbo->tex */
		gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.texture, 0);
		/* Link up depth between framebuffer <-> renderbuffer */
		gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, this.rb);

		/* Clean up, we're done now. */
		gl.bindTexture(gl.TEXTURE_2D, null);
		gl.bindRenderbuffer(gl.RENDERBUFFER, null);
		gl.bindFramebuffer(gl.FRAMEBUFFER, null);
	}

	this.resize = function(width, height) {
		var gl = this.g2d.gl;
		this.fbo.width = this.width;
		this.fbo.height = this.height;
		gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo); /* fbo -> mem */
		gl.bindTexture(gl.TEXTURE_2D, this.texture); /* tex -> mem */
		gl.bindRenderbuffer(gl.RENDERBUFFER, this.rb); /* rb -> mem */

		/* build the texture in rgba USB */
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, this.fbo.width, this.fbo.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
		/* Put stencil and depth data onto the fbo */
		gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH24_STENCIL8, this.fbo.width, this.fbo.height);

		/* Clean up, we're done now. */
		gl.bindTexture(gl.TEXTURE_2D, null);
		gl.bindRenderbuffer(gl.RENDERBUFFER, null);
		gl.bindFramebuffer(gl.FRAMEBUFFER, null);
	}

	this.dispose = function() {
		/* Just delete everything */
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

};

g2d.font = function(g2d, style) {
	this.texture = null;
	this.g2d = g2d;
	this.style = style;
	this.properties = {};

	this.init = function() {
		var gl = this.g2d.gl;

		var ctx = document.createElement("canvas").getContext("2d");
		ctx.font = style;
		ctx.imageSmoothingEnabled = false;
		ctx.fillStyle = "white";
		var maxTextureWidth = 256;
		var letters = "0123456789.,abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";

		this.properties.letterHeight = 22;
		this.properties.baseline = 16;
		this.properties.padding = 1;
		this.properties.spaceWidth = 5;
		this.properties.glyphInfos = this.__paintGlyphCtx(ctx, maxTextureWidth, this.properties.letterHeight, this.properties.baseline,
				this.properties.padding, letters);
		this.properties.textureWidth = ctx.canvas.width;
		this.properties.textureHeight = ctx.canvas.height;

		this.texture = gl.createTexture();
		gl.bindTexture(gl.TEXTURE_2D, this.texture);
		gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, ctx.canvas);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);

		gl.bindTexture(gl.TEXTURE_2D, null); /* clean up */
		gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
	}

	this.__genMPVertMap = function(str) {
		var len = str.length;
		var positions = [];
		var normals = [];
		var texcoords = [];
		var offsetP = 0;
		var offsetT = 0;

		var x = 0;
		for (var ii = 0; ii < len; ++ii) {
			var letter = str[ii];
			var glyphInfo = this.properties.glyphInfos[letter];
			if (glyphInfo) {
				var x2 = x + glyphInfo.width;
				var u1 = glyphInfo.x / this.properties.textureWidth;
				var v1 = (glyphInfo.y + this.properties.letterHeight) / this.properties.textureHeight;
				var u2 = (glyphInfo.x + glyphInfo.width) / this.properties.textureWidth;
				var v2 = glyphInfo.y / this.properties.textureHeight;

				positions.push(x, 0, 0);
				normals.push(0.0, 0.0, -1.0);
				texcoords.push(u1, v1);

				positions.push(x2, 0, 0);
				normals.push(0.0, 0.0, -1.0);
				texcoords.push(u2, v1);

				positions.push(x, this.properties.letterHeight, 0);
				normals.push(0.0, 0.0, -1.0);
				texcoords.push(u1, v2);

				positions.push(x, this.properties.letterHeight, 0);
				normals.push(0.0, 0.0, -1.0);
				texcoords.push(u1, v2);

				positions.push(x2, 0, 0);
				normals.push(0.0, 0.0, -1.0);
				texcoords.push(u2, v1);

				positions.push(x2, this.properties.letterHeight, 0);
				normals.push(0.0, 0.0, -1.0);
				texcoords.push(u2, v2);

				x += glyphInfo.width;
				offsetP += 18;
				offsetT += 12;
			} else {
				// we don't have this character so just advance
				x += this.properties.spaceWidth;
			}
		}

		// return ArrayBufferViews for the portion of the TypedArrays
		// that were actually used.
		return {
			arrays : {
				position : new Float32Array(positions, 0, offsetP),
				normals : new Float32Array(normals, 0, offsetP),
				texcoord : new Float32Array(texcoords, 0, offsetT),
			},
			numVertices : offsetP / 3,
		};
	}

	this.__paintGlyphCtx = function(ctx, maxWidthOfTexture, heightOfLetters, baseLine, padding, letters) {
		var rows = 1;
		var x = 0;
		var y = 0;
		var glyphInfos = {};

		for (var ii = 0; ii < letters.length; ++ii) {
			var letter = letters[ii];
			var t = ctx.measureText(letter);
			if (x + t.width + padding > maxWidthOfTexture) {
				x = 0;
				y += heightOfLetters;
				++rows;
			}
			glyphInfos[letter] = {
				x : x,
				y : y,
				width : t.width
			};
			x += t.width + padding;
		}

		g2dutil.resizeCanvas(ctx, (rows == 1) ? x : maxWidthOfTexture, rows * heightOfLetters);

		for (var ii = 0; ii < letters.length; ++ii) {
			var letter = letters[ii];
			var glyphInfo = glyphInfos[letter];
			var t = ctx.fillText(letter, glyphInfo.x, glyphInfo.y + baseLine);
		}

		return glyphInfos;
	}

	this.__bind = function() {
		this.g2d.gl.activeTexture(this.g2d.gl.TEXTURE0); /* turn ON tex0 */
		this.g2d.gl.bindTexture(this.g2d.gl.TEXTURE_2D, this.texture);
	}

	this.__release = function() {
		this.g2d.gl.bindTexture(this.g2d.gl.TEXTURE_2D, null);
	}

	this.paintText = function(str) {
		var gl = this.g2d.gl;
		var mxp = this.__genMPVertMap(str);
		/*
		 * We're going to be naughty and do our I/O directly, rather than
		 * delegating back to g2d to do it for us. Ssssh. :)
		 */
		gl.bindBuffer(gl.ARRAY_BUFFER, this.g2d.bufferVertPos);
		gl.bufferData(gl.ARRAY_BUFFER, mxp.arrays.position, gl.DYNAMIC_DRAW);

		gl.bindBuffer(gl.ARRAY_BUFFER, this.g2d.bufferTexCoords);
		gl.bufferData(gl.ARRAY_BUFFER, mxp.arrays.texcoord, gl.DYNAMIC_DRAW);

		gl.bindBuffer(gl.ARRAY_BUFFER, this.g2d.bufferVertNormals);
		gl.bufferData(gl.ARRAY_BUFFER, mxp.arrays.normals, gl.DYNAMIC_DRAW);

		this.__bind();
		gl.drawArrays(gl.TRIANGLES, 0, mxp.numVertices);
		this.__release();
	}

	this.erase = function() {
		this.g2d.gl.deleteTexture(this.texture);
	}
}

g2d.texture = function(g2d, bitmap) {
	this.bitmap = bitmap;
	this.texture = null;
	this.g2d = g2d;

	this.init = function() {
		var gl = this.g2d.gl;
		this.texture = gl.createTexture();
		/* webgl mangles the y-axis, so flip over y-axis */
		gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
		gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
		gl.bindTexture(gl.TEXTURE_2D, this.texture); /* tex -> mem */
		/* paint the bitmap in rgba USB */
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, g2d.gl.RGBA, gl.UNSIGNED_BYTE, this.bitmap);

		/*
		 * WRAP_[S|T] in mode CLAMP_TO_EDGE to prevent silly, [MAG|MIN]_FILTER
		 * in mode LINEAR to avoid artifacts
		 */
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);

		gl.bindTexture(gl.TEXTURE_2D, null); /* clean up */
		gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
		gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
	}

	this.bind = function() {
		this.g2d.gl.activeTexture(this.g2d.gl.TEXTURE0); /* turn ON tex0 */
		this.g2d.gl.bindTexture(this.g2d.gl.TEXTURE_2D, this.texture);
	}

	this.release = function() {
		this.g2d.gl.bindTexture(this.g2d.gl.TEXTURE_2D, null);
	}

	this.erase = function() {
		this.g2d.gl.deleteTexture(this.texture);
	}
};
