function grad(x, y, z) {
	this.x = x;
	this.y = y;
	this.z = z;

	this.dot2 = function(x, y) {
		return this.x * x + this.y * y;
	};

	this.dot3 = function(x, y, z) {
		return this.x * x + this.y * y + this.z * z;
	};
}

var noise = {
	grad3 : [ new grad(1, 1, 0), new grad(-1, 1, 0), new grad(1, -1, 0), new grad(-1, -1, 0), new grad(1, 0, 1), new grad(-1, 0, 1),
			new grad(1, 0, -1), new grad(-1, 0, -1), new grad(0, 1, 1), new grad(0, -1, 1), new grad(0, 1, -1), new grad(0, -1, -1) ],

	p : [ 151, 160, 137, 91, 90, 15, 131, 13, 201, 95, 96, 53, 194, 233, 7, 225, 140, 36, 103, 30, 69, 142, 8, 99, 37, 240, 21, 10, 23,
			190, 6, 148, 247, 120, 234, 75, 0, 26, 197, 62, 94, 252, 219, 203, 117, 35, 11, 32, 57, 177, 33, 88, 237, 149, 56, 87, 174, 20,
			125, 136, 171, 168, 68, 175, 74, 165, 71, 134, 139, 48, 27, 166, 77, 146, 158, 231, 83, 111, 229, 122, 60, 211, 133, 230, 220,
			105, 92, 41, 55, 46, 245, 40, 244, 102, 143, 54, 65, 25, 63, 161, 1, 216, 80, 73, 209, 76, 132, 187, 208, 89, 18, 169, 200,
			196, 135, 130, 116, 188, 159, 86, 164, 100, 109, 198, 173, 186, 3, 64, 52, 217, 226, 250, 124, 123, 5, 202, 38, 147, 118, 126,
			255, 82, 85, 212, 207, 206, 59, 227, 47, 16, 58, 17, 182, 189, 28, 42, 223, 183, 170, 213, 119, 248, 152, 2, 44, 154, 163, 70,
			221, 153, 101, 155, 167, 43, 172, 9, 129, 22, 39, 253, 19, 98, 108, 110, 79, 113, 224, 232, 178, 185, 112, 104, 218, 246, 97,
			228, 251, 34, 242, 193, 238, 210, 144, 12, 191, 179, 162, 241, 81, 51, 145, 235, 249, 14, 239, 107, 49, 192, 214, 31, 181, 199,
			106, 157, 184, 84, 204, 176, 115, 121, 50, 45, 127, 4, 150, 254, 138, 236, 205, 93, 222, 114, 67, 29, 24, 72, 243, 141, 128,
			195, 78, 66, 215, 61, 156, 180 ],
	perm : new Array(512),
	gradP : new Array(512)

};

noise.seed = function(seed) {
	if (seed > 0 && seed < 1)
		seed *= 65536;

	seed = Math.floor(seed);
	if (seed < 256)
		seed |= seed << 8;

	for (var i = 0; i < 256; i++) {
		var v;
		if (i & 1)
			v = noise.p[i] ^ (seed & 255);
		else
			v = noise.p[i] ^ ((seed >> 8) & 255);

		noise.perm[i] = noise.perm[i + 256] = v;
		noise.gradP[i] = noise.gradP[i + 256] = noise.grad3[v % 12];
	}
};

noise.seed(0);

var simplex = {
	F2 : 0.5 * (Math.sqrt(3) - 1),
	F3 : 1 / 3,

	G2 : (3 - Math.sqrt(3)) / 6,
	G3 : 1 / 6,
	// 2D simplex noise
	simplex2 : function(xin, yin) {
		var n0, n1, n2; // Noise contributions from the three corners
		// Skew the input space to determine which simplex cell we're in
		var s = (xin + yin) * simplex.F2; // Hairy factor for 2D
		var i = Math.floor(xin + s);
		var j = Math.floor(yin + s);
		var t = (i + j) * simplex.G2;
		var x0 = xin - i + t; // The x,y distances from the cell origin,
		// unskewed.
		var y0 = yin - j + t;
		// For the 2D case, the simplex shape is an equilateral triangle.
		// Determine which simplex we are in.
		var i1, j1; // Offsets for second (middle) corner of simplex in (i,j)
		// coords
		if (x0 > y0) { // lower triangle, XY order: (0,0)->(1,0)->(1,1)
			i1 = 1;
			j1 = 0;
		} else { // upper triangle, YX order: (0,0)->(0,1)->(1,1)
			i1 = 0;
			j1 = 1;
		}
		// A step of (1,0) in (i,j) means a step of (1-c,-c) in (x,y), and
		// a step of (0,1) in (i,j) means a step of (-c,1-c) in (x,y), where
		// c = (3-sqrt(3))/6
		var x1 = x0 - i1 + simplex.G2; // Offsets for middle corner in (x,y)
		// unskewed
		// coords
		var y1 = y0 - j1 + simplex.G2;
		var x2 = x0 - 1 + 2 * simplex.G2; // Offsets for last corner in (x,y)
		// unskewed
		// coords
		var y2 = y0 - 1 + 2 * simplex.G2;
		// Work out the hashed gradient indices of the three simplex corners
		i &= 255;
		j &= 255;
		var gi0 = noise.gradP[i + noise.perm[j]];
		var gi1 = noise.gradP[i + i1 + noise.perm[j + j1]];
		var gi2 = noise.gradP[i + 1 + noise.perm[j + 1]];
		// Calculate the contribution from the three corners
		var t0 = 0.5 - x0 * x0 - y0 * y0;
		if (t0 < 0) {
			n0 = 0;
		} else {
			t0 *= t0;
			n0 = t0 * t0 * gi0.dot2(x0, y0); // (x,y) of grad3 used for 2D
			// gradient
		}
		var t1 = 0.5 - x1 * x1 - y1 * y1;
		if (t1 < 0) {
			n1 = 0;
		} else {
			t1 *= t1;
			n1 = t1 * t1 * gi1.dot2(x1, y1);
		}
		var t2 = 0.5 - x2 * x2 - y2 * y2;
		if (t2 < 0) {
			n2 = 0;
		} else {
			t2 *= t2;
			n2 = t2 * t2 * gi2.dot2(x2, y2);
		}
		// Add contributions from each corner to get the final noise value.
		// The result is scaled to return values in the interval [-1,1].
		return 70 * (n0 + n1 + n2);
	},

	simplex3 : function(xin, yin, zin) {
		var n0, n1, n2, n3; // Noise contributions from the four corners

		// Skew the input space to determine which simplex cell we're in
		var s = (xin + yin + zin) * simplex.F3; // Hairy factor for 2D
		var i = Math.floor(xin + s);
		var j = Math.floor(yin + s);
		var k = Math.floor(zin + s);

		var t = (i + j + k) * simplex.G3;
		var x0 = xin - i + t; // The x,y distances from the cell origin,
		// unskewed.
		var y0 = yin - j + t;
		var z0 = zin - k + t;

		// For the 3D case, the simplex shape is a slightly irregular
		// tetrahedron.
		// Determine which simplex we are in.
		var i1, j1, k1; // Offsets for second corner of simplex in (i,j,k)
		// coords
		var i2, j2, k2; // Offsets for third corner of simplex in (i,j,k) coords
		if (x0 >= y0) {
			if (y0 >= z0) {
				i1 = 1;
				j1 = 0;
				k1 = 0;
				i2 = 1;
				j2 = 1;
				k2 = 0;
			} else if (x0 >= z0) {
				i1 = 1;
				j1 = 0;
				k1 = 0;
				i2 = 1;
				j2 = 0;
				k2 = 1;
			} else {
				i1 = 0;
				j1 = 0;
				k1 = 1;
				i2 = 1;
				j2 = 0;
				k2 = 1;
			}
		} else {
			if (y0 < z0) {
				i1 = 0;
				j1 = 0;
				k1 = 1;
				i2 = 0;
				j2 = 1;
				k2 = 1;
			} else if (x0 < z0) {
				i1 = 0;
				j1 = 1;
				k1 = 0;
				i2 = 0;
				j2 = 1;
				k2 = 1;
			} else {
				i1 = 0;
				j1 = 1;
				k1 = 0;
				i2 = 1;
				j2 = 1;
				k2 = 0;
			}
		}
		// A step of (1,0,0) in (i,j,k) means a step of (1-c,-c,-c) in (x,y,z),
		// a step of (0,1,0) in (i,j,k) means a step of (-c,1-c,-c) in (x,y,z),
		// and
		// a step of (0,0,1) in (i,j,k) means a step of (-c,-c,1-c) in (x,y,z),
		// where
		// c = 1/6.
		var x1 = x0 - i1 + simplex.G3; // Offsets for second corner
		var y1 = y0 - j1 + simplex.G3;
		var z1 = z0 - k1 + simplex.G3;

		var x2 = x0 - i2 + 2 * simplex.G3; // Offsets for third corner
		var y2 = y0 - j2 + 2 * simplex.G3;
		var z2 = z0 - k2 + 2 * simplex.G3;

		var x3 = x0 - 1 + 3 * simplex.G3; // Offsets for fourth corner
		var y3 = y0 - 1 + 3 * simplex.G3;
		var z3 = z0 - 1 + 3 * simplex.G3;

		// Work out the hashed gradient indices of the four simplex corners
		i &= 255;
		j &= 255;
		k &= 255;
		var gi0 = noise.gradP[i + noise.perm[j + perm[k]]];
		var gi1 = noise.gradP[i + i1 + noise.perm[j + j1 + noise.perm[k + k1]]];
		var gi2 = noise.gradP[i + i2 + noise.perm[j + j2 + noise.perm[k + k2]]];
		var gi3 = noise.gradP[i + 1 + noise.perm[j + 1 + noise.perm[k + 1]]];

		// Calculate the contribution from the four corners
		var t0 = 0.6 - x0 * x0 - y0 * y0 - z0 * z0;
		if (t0 < 0) {
			n0 = 0;
		} else {
			t0 *= t0;
			n0 = t0 * t0 * gi0.dot3(x0, y0, z0); // (x,y) of grad3 used for
			// 2D
			// gradient
		}
		var t1 = 0.6 - x1 * x1 - y1 * y1 - z1 * z1;
		if (t1 < 0) {
			n1 = 0;
		} else {
			t1 *= t1;
			n1 = t1 * t1 * gi1.dot3(x1, y1, z1);
		}
		var t2 = 0.6 - x2 * x2 - y2 * y2 - z2 * z2;
		if (t2 < 0) {
			n2 = 0;
		} else {
			t2 *= t2;
			n2 = t2 * t2 * gi2.dot3(x2, y2, z2);
		}
		var t3 = 0.6 - x3 * x3 - y3 * y3 - z3 * z3;
		if (t3 < 0) {
			n3 = 0;
		} else {
			t3 *= t3;
			n3 = t3 * t3 * gi3.dot3(x3, y3, z3);
		}
		// Add contributions from each corner to get the final noise value.
		// The result is scaled to return values in the interval [-1,1].
		return 32 * (n0 + n1 + n2 + n3);
	}
};

var perlin = {

	fade : function(t) {
		return t * t * t * (t * (t * 6 - 15) + 10);
	},

	lerp : function(a, b, t) {
		return (1 - t) * a + t * b;
	},

	perlin2 : function(x, y) {
		var X = Math.floor(x), Y = Math.floor(y);

		x = x - X;
		y = y - Y;

		X = X & 255;
		Y = Y & 255;

		// Calculate noise contributions from each of the four corners
		var n00 = noise.gradP[X + noise.perm[Y]].dot2(x, y);
		var n01 = noise.gradP[X + noise.perm[Y + 1]].dot2(x, y - 1);
		var n10 = noise.gradP[X + 1 + noise.perm[Y]].dot2(x - 1, y);
		var n11 = noise.gradP[X + 1 + noise.perm[Y + 1]].dot2(x - 1, y - 1);

		// Compute the fade curve value for x
		var u = perlin.fade(x);

		// Interpolate the four results
		return perlin.lerp(perlin.lerp(n00, n10, u), perlin.lerp(n01, n11, u), perlin.fade(y));
	},

	perlin3 : function(x, y, z) {
		var X = Math.floor(x), Y = Math.floor(y), Z = Math.floor(z);
		x = x - X;
		y = y - Y;
		z = z - Z;

		X = X & 255;
		Y = Y & 255;
		Z = Z & 255;

		// Calculate noise contributions from each of the eight corners
		var n000 = noise.gradP[X + perm[Y + noise.perm[Z]]].dot3(x, y, z);
		var n001 = noise.gradP[X + perm[Y + noise.perm[Z + 1]]].dot3(x, y, z - 1);
		var n010 = noise.gradP[X + perm[Y + 1 + noise.perm[Z]]].dot3(x, y - 1, z);
		var n011 = noise.gradP[X + perm[Y + 1 + noise.perm[Z + 1]]].dot3(x, y - 1, z - 1);
		var n100 = noise.gradP[X + 1 + perm[Y + noise.perm[Z]]].dot3(x - 1, y, z);
		var n101 = noise.gradP[X + 1 + perm[Y + noise.perm[Z + 1]]].dot3(x - 1, y, z - 1);
		var n110 = noise.gradP[X + 1 + perm[Y + 1 + noise.perm[Z]]].dot3(x - 1, y - 1, z);
		var n111 = noise.gradP[X + 1 + perm[Y + 1 + noise.perm[Z + 1]]].dot3(x - 1, y - 1, z - 1);

		// Compute the fade curve value for x, y, z
		var u = perlin.fade(x);
		var v = perlin.fade(y);
		var w = perlin.fade(z);

		// Interpolate
		return perlin.lerp(perlin.lerp(perlin.lerp(n000, n100, u), perlin.lerp(n001, n101, u), w), perlin.lerp(lerp(n010, n110, u), perlin
				.lerp(n011, n111, u), w), v);
	}
};

module.exports = {
	noise : noise,
	grad : grad,
	perlin : perlin,
	simplex : simplex
}