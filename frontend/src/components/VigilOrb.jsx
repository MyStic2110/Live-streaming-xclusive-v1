import { useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import * as THREE from "three";

// ── Simplex noise ─────────────────────────────────────────────────────────
const NOISE = `
vec3 mod289v3(vec3 x){return x-floor(x*(1./289.))*289.;}
vec4 mod289v4(vec4 x){return x-floor(x*(1./289.))*289.;}
vec4 permute(vec4 x){return mod289v4(((x*34.)+1.)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C=vec2(1./6.,1./3.);
  const vec4 D=vec4(0.,.5,1.,2.);
  vec3 i=floor(v+dot(v,C.yyy));
  vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz);
  vec3 l=1.-g;
  vec3 i1=min(g.xyz,l.zxy);
  vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx;
  vec3 x2=x0-i2+C.yyy;
  vec3 x3=x0-D.yyy;
  i=mod289v3(i);
  vec4 p=permute(permute(permute(
    i.z+vec4(0.,i1.z,i2.z,1.))
    +i.y+vec4(0.,i1.y,i2.y,1.))
    +i.x+vec4(0.,i1.x,i2.x,1.));
  float n_=.142857142857;
  vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.*floor(p*ns.z*ns.z);
  vec4 x_=floor(j*ns.z);
  vec4 y_=floor(j-7.*x_);
  vec4 x=x_*ns.x+ns.yyyy;
  vec4 y=y_*ns.x+ns.yyyy;
  vec4 h=1.-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy);
  vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.+1.;
  vec4 s1=floor(b1)*2.+1.;
  vec4 sh=-step(h,vec4(0.));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;
  vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x);
  vec3 p1=vec3(a0.zw,h.y);
  vec3 p2=vec3(a1.xy,h.z);
  vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
  vec4 m=max(.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.);
  m=m*m;
  return 42.*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}`;

// ── Vertex shader ──────────────────────────────────────────────────────────
const vert = `${NOISE}
uniform float uTime;
uniform float uAmplitude;
varying vec3 vNormal;
varying vec3 vPos;
varying float vNoise;
void main(){
  vNormal=normalize(normalMatrix*normal);
  float n=snoise(position*1.5+uTime*.2) + snoise(position*3.0+uTime*.1)*.3;
  vNoise=(n+1.0)/2.0;
  float d=n*(0.04+uAmplitude*0.15);
  vec3 pos=position+normal*d;
  vPos=(modelViewMatrix*vec4(pos,1.)).xyz;
  gl_Position=projectionMatrix*modelViewMatrix*vec4(pos,1.);
}`;

// ── Fragment shader (Advanced Auditor Polish) ──────────────────────────────
const frag = `${NOISE}
uniform float uTime;
uniform float uAmplitude;
uniform vec3 uPrimary;
uniform vec3 uRim;
uniform vec3 uCore;
varying vec3 vNormal;
varying vec3 vPos;
varying float vNoise;

// Hexagonal grid function
float hexGrid(vec2 p) {
    p *= 12.0;
    vec2 q = vec2( p.x * 1.1547, p.y + p.x * 0.57735 );
    vec2 pi = floor(q);
    vec2 pf = fract(q);
    float v = mod(pi.x + pi.y, 3.0);
    float d = 0.0;
    if (v < 1.0) d = distance(pf, vec2(1.0));
    else if (v < 2.0) d = distance(pf, vec2(0.0));
    else d = distance(pf, vec2(0.5));
    return smoothstep(0.44, 0.46, d);
}

void main(){
  vec3 view=normalize(-vPos);
  float fresnel=pow(1.-max(dot(normalize(vNormal),view),0.0),2.8);
  
  // Base Colors
  vec3 core=mix(uCore, uPrimary, vNoise * 0.5);
  vec3 rim=uRim * (1.6 + uAmplitude * 2.5);
  
  // Hex Grid Overlay
  float grid = hexGrid(vNormal.xy + vNormal.yz);
  vec3 gridCol = uRim * (0.2 + uAmplitude * 0.8) * grid;
  
  // Advanced Scanning Line
  float scanSpeed = 1.2 + uAmplitude * 2.0;
  float scanPos = sin(uTime * scanSpeed) * 1.4;
  float dist = abs(vPos.y - scanPos);
  float scanLine = smoothstep(0.08, 0.0, dist);
  vec3 scanner = uRim * scanLine * 2.0;
  
  // Composite
  vec3 col = mix(core, rim, pow(fresnel, 1.8));
  col += gridCol * 0.4;
  col += scanner;
  
  // Specular Highlight
  float spec=pow(max(dot(normalize(vNormal),normalize(vec3(.5,1.,.8))),0.),30.0);
  col += vec3(0.8, 1.0, 1.0) * spec * 0.2;
  
  gl_FragColor=vec4(col, 1.0);
}`;

const THEMES = {
  idle:      { primary:"#1e40af", rim:"#3b82f6", core:"#020617" },
  listening: { primary:"#3b82f6", rim:"#60a5fa", core:"#082f49" },
  thinking:  { primary:"#0ea5e9", rim:"#7dd3fc", core:"#0c4a6e" },
  speaking:  { primary:"#06b6d4", rim:"#67e8f9", core:"#155e75" },
};

function VigilOrbMesh({ amplitude, agentState }) {
  const mat = useRef();
  const t = THEMES[agentState] || THEMES.idle;

  useFrame(({ clock }) => {
    if (!mat.current) return;
    const u = mat.current.uniforms;
    u.uTime.value = clock.getElapsedTime();
    u.uAmplitude.value = amplitude;
    u.uPrimary.value.set(t.primary);
    u.uRim.value.set(t.rim);
    u.uCore.value.set(t.core);
  });

  return (
    <mesh>
      <sphereGeometry args={[1.5, 128, 128]} />
      <shaderMaterial
        ref={mat}
        vertexShader={vert}
        fragmentShader={frag}
        uniforms={{
          uTime:      { value: 0 },
          uAmplitude: { value: 0 },
          uPrimary:   { value: new THREE.Color(t.primary) },
          uRim:       { value: new THREE.Color(t.rim) },
          uCore:      { value: new THREE.Color(t.core) },
        }}
      />
    </mesh>
  );
}

export default function VigilOrb({ amplitude, agentState }) {
  return (
    <Canvas
      camera={{ position: [0, 0, 4], fov: 45 }}
      gl={{ antialias: true, alpha: true }}
      style={{ position: "absolute", inset: 0 }}
    >
      <VigilOrbMesh amplitude={amplitude} agentState={agentState} />
      <EffectComposer>
        <Bloom
          intensity={2.0}
          luminanceThreshold={0.01}
          luminanceSmoothing={0.9}
          mipmapBlur
        />
      </EffectComposer>
    </Canvas>
  );
}
