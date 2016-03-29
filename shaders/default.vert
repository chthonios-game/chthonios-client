// default.vert: default vertex shader program.
// Only change this if you need to pass different
// vertex attributes to a fragment shader!

attribute 	vec3 	aVertexPosition;	// vertex position
attribute 	vec3 	aVertexNormal;		// vertex normal

attribute 	vec2 	aTextureCoord0;		// texture0 coordinate
attribute	vec2	aTextureCoord1;		// texture1 coordinate
attribute	vec2	aTextureCoord2;		// texture2 coordinate

uniform 	mat4 	uMVMatrix;			// modelview matrix
uniform 	mat4	uPMatrix;			// projection matrix
uniform 	mat3	uNMatrix;			// normal matrix

uniform 	bool 	uUseLighting;		// vertex lighting mode flag
uniform 	vec3 	uAmbientColor;		// ambient light color
uniform 	vec3 	uLightingDirection;	// static light direction vec
uniform 	vec3 	uDirectionalColor;	// static light direction col

varying 	vec2 	vTextureCoord0;		// out texture0 coordinate
varying 	vec2 	vTextureCoord1;		// out texture1 coordinate
varying 	vec2 	vTextureCoord2;		// out texture2 coordinate
varying 	vec3 	vLightWeighting;	// out lighting weighting

void main( void ) {
	gl_Position = uPMatrix * uMVMatrix * vec4( aVertexPosition, 1.0 );
	
	vTextureCoord0 = aTextureCoord0; // don't transform!
	vTextureCoord1 = aTextureCoord1; // don't transform!
	vTextureCoord2 = aTextureCoord2; // don't transform!

	if ( !uUseLighting ) {
		vLightWeighting = vec3( 1.0, 1.0, 1.0 ); // static light
	} else {
		vec3 transformedNormal = uNMatrix * aVertexNormal;
		float directionalLightWeighting = max( dot( transformedNormal, uLightingDirection ), 0.0 );
		vLightWeighting = uAmbientColor + uDirectionalColor * directionalLightWeighting;
	}
}