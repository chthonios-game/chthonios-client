"use strict";

var g2d = function(context) {

	/* Helper constants */
	this.GL_TRIANGLE = "TRIANGLE";
	this.GL_QUAD = "QUAD";

	/* Graphics contexts */
	this.context = context;
	this.gl = null;
	this.camera = null;
	this.allocator = null;
	this.perf = null;

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

	/* A track of all the buffers we've created */
	this.buffers = [];

	this.init = function() {
		this.gl = this.context.getContext("webgl") || this.context.getContext("experimental-webgl");
		this.gl.viewportWidth = this.context.width;
		this.gl.viewportHeight = this.context.height;

		this.camera = new g2d.camera();
		this.perf = new g2d.perf(this);
		this.allocator = new g2d.allocator(this);
		this.perf.init();

		var gl = this.gl;

		this.bufferVertPos = gl.createBuffer();
		this.bufferTexCoords = gl.createBuffer();
		this.bufferVertNormals = gl.createBuffer();
		this.bufferVertIndex = gl.createBuffer();

		/*
		 * Vertex index buffer. Controls vertex indexing; normally doesn't
		 * change, so we're going to initialize it here with working data.
		 */
		gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.bufferVertIndex);
		gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array([ 0, 1, 2, 0, 2, 3 ]), gl.DYNAMIC_DRAW);
	}

	/**
	 * Resize the viewport. g2d will assess the new context size and apply this
	 * to the projection matrix.
	 */
	this.resize = function() {
		this.gl.viewportWidth = this.context.width;
		this.gl.viewportHeight = this.context.height;
	}

	this.panic = function(message) {
		throw new g2d.error(message);
	}

	this.generateTextureBuffer = function(width, height) {
		var buffer = new g2d.texturebuffer(this, width, height);
		buffer.init();
		this.buffers.push(buffer);
		return buffer;
	}

	this.generateTexture = function(path, maskpath) {
		return new g2d.texture(this, path, maskpath);
	}

	this.releaseTextureBuffer = function(buffer) {
		buffer.dispose();
		var idx = -1;
		while ((idx = this.buffers.indexOf(buffer)) != -1)
			this.buffers.splice(idx, 1);
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

		p.textureCoordAttributes = [ this.gl.getAttribLocation(p, "aTextureCoord0"), // TEXTURE0+0
		this.gl.getAttribLocation(p, "aTextureCoord1"), // TEXTURE0+1
		this.gl.getAttribLocation(p, "aTextureCoord2") // TEXTURE0+2
		];

		p.pMatrixUniform = this.gl.getUniformLocation(p, "uPMatrix");
		p.nMatrixUniform = this.gl.getUniformLocation(p, "uNMatrix");
		p.mvMatrixUniform = this.gl.getUniformLocation(p, "uMVMatrix");

		p.useLightingUniform = this.gl.getUniformLocation(p, "uUseLighting");
		p.ambientColorUniform = this.gl.getUniformLocation(p, "uAmbientColor");
		p.lightingDirectionUniform = this.gl.getUniformLocation(p, "uLightingDirection");
		p.directionalColorUniform = this.gl.getUniformLocation(p, "uDirectionalColor");

		p.alphaMask = this.gl.getUniformLocation(p, "uAlphaMask");
		p.alphaUniform = this.gl.getUniformLocation(p, "uAlpha");
		p.colorMultiplierUniform = this.gl.getUniformLocation(p, "uColorMultip");
		p.staticColorUniform = this.gl.getUniformLocation(p, "uStaticColor");

		p.useStaticColor = this.gl.getUniformLocation(p, "uUseStaticColor");
		p.mangleFillAlpha = this.gl.getUniformLocation(p, "uMangleFillAlpha");
		p.useTextureMask = this.gl.getUniformLocation(p, "uUseTextureMask");
		p.useStaticMask = this.gl.getUniformLocation(p, "uUseStaticMask");

		p.samplerUniforms = [ this.gl.getUniformLocation(p, "uSampler0"), // TEXTURE0+0
		this.gl.getUniformLocation(p, "uSampler1"), // TEXTURE0+1
		this.gl.getUniformLocation(p, "uSampler2") // TEXTURE0+2
		];

		p.resolutionUniform = this.gl.getUniformLocation(p, "uResolution");
		p.globalTimeUniform = this.gl.getUniformLocation(p, "uGlobalTime");
		p.frameTimeUniform = this.gl.getUniformLocation(p, "uFrameTime");
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
		this.gl.enableVertexAttribArray(this._shader.textureCoordAttributes[0]);

		for (var i = 0; i < this._shader.samplerUniforms.length; i++)
			this.gl.uniform1i(this._shader.samplerUniforms[i], i);

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

	/**
	 * Enables or disables lighting support in the shader.
	 */
	this.glLighting = function(mode) {
		this.gl.uniform1i(this._shader.useLightingUniform, (mode ? 1 : 0));
	}

	/**
	 * Disables texture sampling and substitutes for solid colors in the shader.
	 * If alpha-mangling is turned on, the alpha value is replaced with the
	 * fill, else the alpha value is preserved from the texture sampling.
	 */
	this.glStaticColor = function(mode) {
		this.gl.uniform1i(this._shader.useStaticColor, (mode ? 1 : 0));
	}

	/**
	 * Sets the alpha-mangling mode of the static-color filll mode. If
	 * alpha-mangling is turned on, the alpha value is replaced with the fill,
	 * else the alpha value is preserved from the texture sampling.
	 */
	this.glStaticColorMangleAlpha = function(mode) {
		this.gl.uniform1i(this._shader.mangleFillAlpha, (mode ? 1 : 0));
	}

	/**
	 * Sets the noise overlay mode in the shader.
	 */
	this.glApplyStatic = function(mode) {
		this.gl.uniform1i(this._shader.useStaticMask, (mode ? 1 : 0));
	}

	/**
	 * Sets the alpha culling threshold for drawn fragments - fragment cells
	 * whose alpha value falls below the minimum provided won't be rendered
	 * (cutout objects).
	 */
	this.glAlphaCull = function(val) {
		this.gl.uniform1f(this._shader.alphaMask, val);
	}

	/**
	 * Sets the color-only mode fill color.
	 */
	this.glColorFill = function(r, g, b, a) {
		this.gl.uniform4f(this._shader.staticColorUniform, r, g, b, a);
	}

	/**
	 * Sets the color multiplier (glColor4f).
	 */
	this.glColorMultiplier = function(r, g, b, a) {
		this.gl.uniform4f(this._shader.colorMultiplierUniform, r, g, b, a);
	}

	/**
	 * Sets the alpha weighting value. All alpha values from solid colors and
	 * textures will be resampled as fractions of the weight provided.
	 */
	this.glAlphaWeighting = function(weight) {
		this.gl.uniform1f(this._shader.alphaUniform, weight);
	}

	/**
	 * Configures the color of the ambient lighting.
	 */
	this.glAmbientLight = function(r, g, b) {
		this.gl.uniform3f(this._shader.ambientColorUniform, r, g, b);
	}

	/**
	 * Configures the direction and color of the spot light.
	 */
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
		this.perf.start();
		var gl = this.gl;

		gl.clearColor(100.0 / 255.0, 149 / 255.0, 237 / 255.0, 1.0);
		gl.enable(gl.DEPTH_TEST);
		/* Initialize the viewport */
		gl.viewport(0, 0, gl.viewportWidth, gl.viewportHeight);
		gl.uniform2f(this._shader.resolutionUniform, gl.viewportWidth, gl.viewportHeight);
		gl.uniform1f(this._shader.globalTimeUniform, this.perf.rt());
		gl.uniform1f(this._shader.frameTimeUniform, this.perf.frame());

		gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT); /* clean up */
		mat4.perspective(this.pMatrix, 45, gl.viewportWidth / gl.viewportHeight, 0.1, 100.0);
		this.glIdentityMatrix();
		this.camera.applyCamera(this);
		this._mvUpdated();
		gl.enable(gl.BLEND);
		gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
		gl.disable(gl.DEPTH_TEST);
		gl.depthFunc(gl.LESS);
	}

	this.glIdentityMatrix = function() {
		mat4.identity(this.mvMatrix);
	}

	/**
	 * Finish drawing
	 */
	this.endDrawing = function() {
		this.perf.finish();
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
	},

	findNPoT : function(v) {
		return Math.pow(2, Math.round(Math.log(v) / Math.log(2)));
	}
}

g2d.perf = function(g2d) {
	this.g2d = g2d;
	this.hw = {
		renderer : '',
		vendor : ''
	};
	this.clock = {
		start : 0,
		end : 0
	};
	this.counters = {
		begin : 0,
		frames : 0,
		matime : 0
	};
	this.frames = 0;
	this.epoch = 0;

	this._peekSysPerf = function() {
		var q = (performance.now || performance.mozNow || performance.msNow || performance.oNow || performance.webkitNow || function() {
			return new Date().getTime(); /* no nperf! */
		});
		return q.apply((window.performance) ? window.performance : window);
	}

	this.init = function(desiredFrames) {
		var gl = this.g2d.gl;
		this.frames = desiredFrames;
		this.epoch = this._peekSysPerf();
		var dbgRenderInfo = gl.getExtension("WEBGL_debug_renderer_info");
		if (dbgRenderInfo != null) {
			this.hw.renderer = gl.getParameter(dbgRenderInfo.UNMASKED_RENDERER_WEBGL);
			this.hw.vendor = gl.getParameter(dbgRenderInfo.UNMASKED_VENDOR_WEBGL);
		}
		console.log("g2d.perf.stat:", this.hw);
	}

	this.start = function() {
		this.clock.start = this._peekSysPerf();
	}

	this.frame = function() {
		return this.counters.frames / this.frames;
	}

	this.rt = function() {
		return this._peekSysPerf() - this.epoch;
	}

	this.finish = function() {
		this.clock.end = this._peekSysPerf();
		this.counters.frames++;
		this.counters.matime += (this.clock.end - this.clock.start) / this.counters.frames;
	}

	this.sample = function() {
		var now = this._peekSysPerf();
		if (now - 1000 > this.counters.begin) {
			var ctx = this.counters;
			this.counters = {
				begin : now,
				frames : 0,
				matime : 0
			};
			return ctx;
		}
		return null;
	}

};

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
		this.gimballX += x;
		this.gimballY += y;
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
		assert(this.fbo == null, "fbo already defined");

		/* Populate the pointers */
		this.fbo = gl.createFramebuffer();
		this.texture = gl.createTexture();
		this.rb = gl.createRenderbuffer();

		/* Resize the FBO */
		this.fbo.width = this.width;
		this.fbo.height = this.height;

		gl.activeTexture(gl.TEXTURE0);
		gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo); /* fbo -> mem */
		gl.bindTexture(gl.TEXTURE_2D, this.texture); /* tex -> mem */
		/* build the texture in rgba USB */
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, this.fbo.width, this.fbo.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
		/* tex->mag = linear */
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
		/* tex->min = nearest */
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);

		gl.bindRenderbuffer(gl.RENDERBUFFER, this.rb); /* rb -> mem */
		/* Put stencil and depth data onto the fbo */
		gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, this.fbo.width, this.fbo.height);
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
		gl.activeTexture(gl.TEXTURE0);
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
		if (this.fbo != null) {
			gl.deleteRenderbuffer(this.rb);
			this.rb = null;
			gl.deleteTexture(this.texture);
			this.texture = null;
			gl.deleteFramebuffer(this.fbo);
			this.fbo = null;
		}
	}

	this.bindBuffer = function() {
		if (this.fbo == null)
			this.g2d.panic("FRAMEBUFFER not prepared!");
		this.g2d.gl.bindFramebuffer(this.g2d.gl.FRAMEBUFFER, this.fbo);
	}
	this.releaseBuffer = function() {
		this.g2d.gl.bindFramebuffer(this.g2d.gl.FRAMEBUFFER, null);
	}

	this.bind = function() {
		/*
		 * Going to safely assume we don't have a mask set on TEX0+1, else the
		 * buffer texture layer is going to be painted with mask TEX0+1.
		 */
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
		ctx.fillStyle = "white";
		ctx.textBaseline = "alphabetic";
		ctx.textAlign = "left";
		var letters = "0123456789.,abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";

		this.properties.letterHeight = 22;
		this.properties.baseline = 16;
		this.properties.padding = 1;
		this.properties.spaceWidth = 5;
		this.properties.glyphInfos = this.__paintGlyphCtx(ctx, 256, letters);
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
		var positions = [], normals = [], texcoords = [];
		var offsetP = 0, offsetT = 0;

		var x = 0;
		for (var ii = 0; ii < len; ++ii) {
			var letter = str[ii];
			var glyphInfo = this.properties.glyphInfos[letter];
			if (glyphInfo) {
				var x2 = x + glyphInfo.right;
				var u1 = glyphInfo.x / this.properties.textureWidth;
				var v1 = (glyphInfo.y + this.properties.letterHeight) / this.properties.textureHeight;
				var u2 = (glyphInfo.x + glyphInfo.right) / this.properties.textureWidth;
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

				x += glyphInfo.right;
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

	this.__paintGlyphCtx = function(ctx, mw, letters) {
		var rows = 1, x = 0, y = 0;
		var glyphInfos = {};

		for (var ii = 0; ii < letters.length; ++ii) {
			var letter = letters[ii];
			var t = ctx.measureText(letter);
			if (x + t.width + this.properties.padding > mw) {
				x = 0;
				y = Math.ceil(y) + this.properties.letterHeight;
				++rows;
			}
			glyphInfos[letter] = {
				x : Math.floor(x),
				y : Math.floor(y),
				width : t.width
			};
			x = Math.ceil(x) + Math.ceil(t.width) + this.properties.padding;
		}

		var nw = (rows == 1) ? x : mw, nh = rows * this.properties.letterHeight;

		g2dutil.resizeCanvas(ctx, nw, nh);
		ctx.mozImageSmoothingEnabled = false;
		ctx.webkitImageSmoothingEnabled = false;
		ctx.msImageSmoothingEnabled = false;
		ctx.imageSmoothingEnabled = false;

		for (var ii = 0; ii < letters.length; ++ii) {
			var letter = letters[ii];
			var glyphInfo = glyphInfos[letter];
			ctx.fillText(letter, glyphInfo.x, glyphInfo.y + this.properties.baseline);
		}

		glyphInfos = this.__flatten(ctx, glyphInfos, nw, nh);

		return glyphInfos;
	}

	this.__flatten = function(ctx, glyphs, w, h) {
		for ( var char in glyphs) {
			if (glyphs.hasOwnProperty(char)) {
				var glyphInfo = glyphs[char];
				var width = Math.ceil(glyphInfo.width), height = Math.ceil(this.properties.letterHeight);
				var idx = ctx.getImageData(glyphInfo.x, glyphInfo.y, width, height);
				var pix = idx.data;
				var x = 0;
				main: while (x < width) {
					for (var y = 0; y < height; y++) {
						var ptr = 4 * (x + (y * width));
						if (pix[ptr + 3] > 0)
							break main;
					}
					x++;
				}
				glyphs[char].left = x;

				x = width - 1;
				main: while (x >= 0) {
					for (var y = height - 1; y >= 0; y--) {
						var ptr = 4 * (x + (y * width));
						if (pix[ptr + 3] > 0)
							break main;
					}
					x--;
				}
				glyphs[char].right = x + 1;
			}
		}

		return glyphs;
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

g2d.texture = function(g2d, bitmap, bitmask) {
	this.bitmap = bitmap;
	this.bitmask = bitmask;
	this.texture = null;
	this.texmask = null;
	this.g2d = g2d;

	this.__generate = function(b) {
		var gl = this.g2d.gl;
		var tex = gl.createTexture();
		/* webgl mangles the y-axis, so flip over y-axis */
		gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
		gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
		gl.bindTexture(gl.TEXTURE_2D, tex); /* tex -> mem */
		/* paint the bitmap in rgba USB */
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, g2d.gl.RGBA, gl.UNSIGNED_BYTE, b);

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
		return tex;
	}

	this.init = function() {
		this.texture = this.__generate(bitmap);
		if (this.bitmask != null)
			this.texmask = this.__generate(bitmask);
	}

	this.bind = function() {
		this.g2d.gl.activeTexture(this.g2d.gl.TEXTURE0 + 0);
		this.g2d.gl.bindTexture(this.g2d.gl.TEXTURE_2D, this.texture);
		if (this.texmask != null) {
			this.g2d.gl.activeTexture(this.g2d.gl.TEXTURE0 + 1);
			this.g2d.gl.bindTexture(this.g2d.gl.TEXTURE_2D, this.texmask);
		}
	}

	this.release = function() {
		this.g2d.gl.activeTexture(this.g2d.gl.TEXTURE0 + 0);
		this.g2d.gl.bindTexture(this.g2d.gl.TEXTURE_2D, null);
		if (this.texmask != null) {
			this.g2d.gl.activeTexture(this.g2d.gl.TEXTURE0 + 1);
			this.g2d.gl.bindTexture(this.g2d.gl.TEXTURE_2D, null);
		}
	}

	this.erase = function() {
		this.g2d.gl.deleteTexture(this.texture);
		if (this.texmask != null)
			this.g2d.gl.deleteTexture(this.texmask);
	}
};

g2d.atlas = function() {

	this.subtex = {};
	this.coords = {};
	this.bitmap = null;

	this.addSubTex = function(name, bitmap) {
		console.log(this.toString(), "registering atlas texture: " + name);
		this.subtex[name] = bitmap;
	}

	this.packSubTex = function(graphics) {
		/* this.subtex contains a map of all textures to atlas */
		var ww = -1, wh = -1, ul = 0;
		for ( var tex in this.subtex) {
			if (this.subtex.hasOwnProperty(tex)) {
				var imgsrc = this.subtex[tex];
				if (ww == -1 || wh == -1) {
					ww = imgsrc.naturalWidth;
					wh = imgsrc.naturalHeight;
				} else {
					if (imgsrc.naturalWidth != ww)
						throw new g2d.error("Can't blit non-constant image dimensions to atlas!");
					if (imgsrc.naturalHeight != wh)
						throw new g2d.error("Can't blit non-constant image dimensions to atlas!");
				}
				ul++;
			}
		}

		/*
		 * Determine exactly how much space we need to build the atlas. We do
		 * this by figuring out the total number of paintable pixels, converting
		 * it to a square region and then finding the npot.
		 */
		var allpix = (ww * wh) * ul;
		var dvu = Math.ceil(Math.sqrt(allpix));
		var dvpt = g2dutil.findNPoT(dvu);

		var canvas = document.createElement("canvas");
		var c2d = canvas.getContext("2d");
		/* Canvas will be (dvpt x dvpt) px. */
		g2dutil.resizeCanvas(c2d, dvpt, dvpt);

		/*
		 * Now we know the canvas size, figure out how many texture units we can
		 * fit in a row.
		 */
		var carry = Math.floor(dvpt / ww);

		var u = 0;
		for ( var tex in this.subtex) {
			if (this.subtex.hasOwnProperty(tex)) {
				var imgsrc = this.subtex[tex];
				var col = (u % carry), row = Math.floor(u / carry);
				c2d.drawImage(imgsrc, row * wh, col * ww);
				this.coords[tex] = [ row * wh, col * ww ];
				u++;
			}
		}

		this.bitmap = new g2d.texture(graphics, c2d.canvas, null);
	}

	this.deleteAtlas = function() {
		if (this.bitmap == null)
			return;
		this.bitmap.erase();
		this.bitmap = null;
	}
};

g2d.allocator = function(g2d) {
	this.g2d = g2d;
	this.textures = {};

	this.texture = function(name, path, mask) {
		if (this.textures[name] == null)
			this.textures[name] = this.g2d.generateTexture(path, mask);
		return this.textures[name]
	}

};
