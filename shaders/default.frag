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

uniform 	sampler2D 		uSampler0;			// texture0 sampler
uniform 	sampler2D 		uSampler1;			// texture1 sampler
uniform 	sampler2D 		uSampler2;			// texture2 sampler

uniform		vec2 			uResolution; 		// screen resolution
uniform		float			uGlobalTime;		// global osi time
uniform 	float			uFrameTime;			// frame time


float rand( in vec2 co ) {
    return fract( cos( sin( dot( co.xy, vec2( 12.9898,78.233 ) ) ) ) * 43758.5453 );
}

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

void mask ( inout vec4 fragcolor ) {
	if ( uUseTextureMask ) {
		vec4 mask = texture2D( uSampler1, vec2( vTextureCoord1.s, vTextureCoord1.t ) );
		fragcolor *= mask;
	}
}

void main( void ) {
	vec4 premul;
	
	if ( uUseStaticColor && uMangleFillAlpha ) {
		vec4 solColor = vec4( uStaticColor.rgb * vLightWeighting, uStaticColor.a * uAlpha );
		mask( solColor );
		if ( solColor.a < uAlphaMask )
			discard;
		premul = vec4 ( solColor.rgb * uColorMultip.rgb, solColor.a * uColorMultip.a );
	} else {
		vec4 textureColor = texture2D( uSampler0, vec2( vTextureCoord0.s, vTextureCoord0.t ) );
		if ( uUseStaticColor && !uMangleFillAlpha )
			textureColor = vec4( uStaticColor.rgb, textureColor.a );
		vec4 fragColor = vec4( textureColor.rgb * vLightWeighting, textureColor.a * uAlpha );
		mask( fragColor );
		if ( fragColor.a < uAlphaMask )
			discard;
		premul = vec4( fragColor.rgb * uColorMultip.rgb, fragColor.a * uColorMultip.a );
	}
	if ( uUseStaticMask ) 
		applyNoise( premul );
	
	gl_FragColor = premul;
}