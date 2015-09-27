precision mediump float;

varying vec2 vTextureCoord;
varying vec3 vLightWeighting;

uniform float uAlpha;
uniform float uAlphaMask;
uniform sampler2D uSampler;

uniform bool uUseStaticColor;

uniform lowp vec4 uColorMultip;
uniform lowp vec4 uStaticColor;

void main(void) {
	if (uUseStaticColor) {
		vec4 solColor = vec4(uStaticColor.rgb * vLightWeighting, uStaticColor.a * uAlpha);
		if (solColor.a < uAlphaMask)
			discard;
		gl_FragColor = solColor;
	} else {
		vec4 textureColor = texture2D(uSampler, vec2(vTextureCoord.s, vTextureCoord.t));
		vec4 fragColor = vec4(textureColor.rgb * vLightWeighting, textureColor.a * uAlpha);
		if (fragColor.a < uAlphaMask)
			discard;
		gl_FragColor = vec4(fragColor.rgb * uColorMultip.rgb, fragColor.a * uColorMultip.a);
	}
}