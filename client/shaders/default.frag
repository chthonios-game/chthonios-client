precision mediump float;

varying vec2 vTextureCoord;
varying vec3 vLightWeighting;

uniform float uAlpha;
uniform sampler2D uSampler;

uniform bool uUseStaticColor;

uniform lowp vec4 uColorMultip;
uniform lowp vec4 uStaticColor;

void main(void) {
	if (uUseStaticColor) {
		gl_FragColor = vec4(uStaticColor.rgb * vLightWeighting, uStaticColor.a * uAlpha);
	} else {
		vec4 textureColor = texture2D(uSampler, vec2(vTextureCoord.s, vTextureCoord.t));
		gl_FragColor = uColorMultip * vec4(textureColor.rgb * vLightWeighting, textureColor.a * uAlpha);
	}
}