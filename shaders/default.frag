// default.frag: default fragment shader program.
precision mediump float;						// onlt medium precision

varying 	vec2 			vTextureCoord0;		// texture0 coordinate
varying 	vec2 			vTextureCoord1;		// texture1 coordinate
varying 	vec2 			vTextureCoord2;		// texture2 coordinate
varying 	vec3 			vLightWeighting;	// lighting weighting

uniform 	float 			uAlphaMask;			// alpha cull threshold
uniform		float 			uAlpha;				// alpha mask
uniform 	lowp vec4		uColorMultip;		// color mask
uniform 	lowp vec4 		uStaticColor;		// static color

uniform 	bool 			uUseStaticColor;	// static color mode flag
uniform 	bool			uMangleFillAlpha;	// ignore alpha color fill flag
uniform		bool			uUseTextureMask;	// texture masking mode flag
uniform		bool			uUseStaticMask;		// static graphics mask mode flag
uniform		bool			uUseTextureArrays;	// use texture arrays mode flag
uniform		int				uTexturePtr;		// texture arrays pointer

uniform 	sampler2D 		uSampler0;			// texture0 sampler
uniform 	sampler2D 		uSampler1;			// texture1 sampler
uniform 	sampler2D 		uSampler2;			// texture2 sampler
uniform		sampler2D		uSamplerArray[8];	// texture array sampler (use_texture_arrays)

uniform		vec2 			uResolution; 		// screen resolution
uniform		float			uGlobalTime;		// global osi time
uniform 	float			uFrameTime;			// frame time


float rand( in vec2 co ) {
    return fract( cos( sin( dot( co.xy, vec2( 12.9898,78.233 ) ) ) ) * 43758.5453 );
}

// applyNoise: apply static noise to fragments
vec4 applyNoise ( inout vec4 fragcolor ) {
	vec2 op = ( ( gl_FragCoord.xy / uResolution.xy ) - 0.5 ) * 2.0;
	vec2 p = op;
	float rtt = uGlobalTime / 1000.00;
	p.x *= uResolution.x / uResolution.y;
	float c = rand( vec2(
			sin( p.x + rtt * 1.01 ),
			cos( p.y + rtt * 0.99 )
		) );
    
    c *= 0.25 + ( 1.0 + sin( rtt ) ) * 0.5;
	c *= 1.0 - length( op * 0.777 );
	vec4 nperf = vec4 ( vec3 ( c ), 1.0 );
	fragcolor *= nperf;
	return nperf;
}

// mask: apply textureX & texture1 bitwise mask
void mask ( inout vec4 fragcolor ) {
	if ( uUseTextureMask ) {
		vec4 mask = texture2D( uSampler1, vec2( vTextureCoord1.s, vTextureCoord1.t ) );
		fragcolor *= mask;
	}
}

vec4 getBaseTexture ( in sampler2D preferred, in vec2 position ) {
	if ( uUseTextureArrays ) {
		if ( uTexturePtr == 0 ) return texture2D ( uSamplerArray[0], position );
		if ( uTexturePtr == 1 ) return texture2D ( uSamplerArray[1], position );
		if ( uTexturePtr == 2 ) return texture2D ( uSamplerArray[2], position );
		if ( uTexturePtr == 3 ) return texture2D ( uSamplerArray[3], position );
		if ( uTexturePtr == 4 ) return texture2D ( uSamplerArray[4], position );
		if ( uTexturePtr == 5 ) return texture2D ( uSamplerArray[5], position );
		if ( uTexturePtr == 6 ) return texture2D ( uSamplerArray[6], position );
		if ( uTexturePtr == 7 ) return texture2D ( uSamplerArray[7], position );
	}
	return texture2D( preferred,  position );
}

void main( void ) {
	vec4 premul;
	
	if ( uUseStaticColor && uMangleFillAlpha ) { // use_static_colors and ignore_texture_alpha mode
		// generate rgbafill over vLightWeighting / ualpha
		vec4 solColor = vec4( uStaticColor.rgb * vLightWeighting, uStaticColor.a * uAlpha );
		mask( solColor ); // mask it
		if ( solColor.a < uAlphaMask ) // culled?
			discard;
		premul = vec4 ( solColor.rgb * uColorMultip.rgb, solColor.a * uColorMultip.a );
	} else { // ignore_texture_alpha = off mode
		vec2 position = vec2( vTextureCoord0.s, vTextureCoord0.t );
		vec4 textureColor = getBaseTexture ( uSampler0, position );
		if ( uUseStaticColor && !uMangleFillAlpha ) // use_static_colors mode?
			textureColor = vec4( uStaticColor.rgb, textureColor.a ); // static color + tex alpha
		vec4 fragColor = vec4( textureColor.rgb * vLightWeighting, textureColor.a * uAlpha );
		mask( fragColor ); // mask it
		if ( fragColor.a < uAlphaMask ) // culled?
			discard;
		premul = vec4( fragColor.rgb * uColorMultip.rgb, fragColor.a * uColorMultip.a );
	}
	if ( uUseStaticMask ) // require noise mask?
		applyNoise( premul ); // overlay mask on finisher
	
	gl_FragColor = premul;
}