/* GharSetu — animated brand background for public form pages.
 * A subtle, transparent WebGL overlay that adds slow-moving brand-tinted
 * (navy / royal-blue / saffron) flow over the EXISTING light surface — it does
 * NOT change the page colour, it only layers gentle motion behind the content.
 *
 * Used by: login.html · forgot-password.html · reset-password.html · contact.html
 *   <script src="assets/auth-bg.js"></script>
 *
 * Host resolution:
 *   - if a .auth-shell exists  → canvas is absolutely positioned inside it (auth pages)
 *   - otherwise (contact)      → canvas is fixed behind the page, content raised above it
 *
 * Graceful: no WebGL / context-loss → the script removes the canvas and the
 * page keeps its current static background. Honours prefers-reduced-motion
 * (renders a single still frame, no animation loop).
 */
(function () {
  function init() {
    var shell = document.querySelector('.auth-shell');
    var bodyHosted = !shell;

    /* Layout CSS (injected once). */
    if (!document.getElementById('gs-aurora-style')) {
      var st = document.createElement('style');
      st.id = 'gs-aurora-style';
      st.textContent = [
        '.gs-aurora-canvas { pointer-events:none; }',
        '.auth-shell .gs-aurora-canvas { position:absolute; inset:0; width:100%; height:100%; z-index:0; }',
        'body > .gs-aurora-canvas { position:fixed; inset:0; width:100%; height:100%; z-index:0; }',
        /* contact (body-hosted): keep content above the fixed canvas */
        'body.gs-aurora-on > main { position:relative; z-index:1; }',
        'body.gs-aurora-on .gs-footer { position:relative; z-index:1; }'
      ].join('\n');
      document.head.appendChild(st);
    }

    var canvas = document.createElement('canvas');
    canvas.className = 'gs-aurora-canvas';
    canvas.setAttribute('aria-hidden', 'true');

    var gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (!gl) return; /* no WebGL → leave the static background as-is */

    if (bodyHosted) { document.body.classList.add('gs-aurora-on'); document.body.appendChild(canvas); }
    else { shell.insertBefore(canvas, shell.firstChild); }

    var vsSource =
      'attribute vec2 aPos; void main(){ gl_Position = vec4(aPos, 0.0, 1.0); }';

    /* Original flowing-noise field, tinted to GharSetu brand hues, output at low
       alpha so the existing light surface stays the dominant colour. */
    var fsSource = [
      'precision mediump float;',
      'uniform float uTime;',
      'uniform vec2 uRes;',
      'float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }',
      'float noise(vec2 p){',
      '  vec2 i=floor(p), f=fract(p);',
      '  vec2 u=f*f*(3.0-2.0*f);',
      '  return mix(mix(hash(i),hash(i+vec2(1.0,0.0)),u.x), mix(hash(i+vec2(0.0,1.0)),hash(i+vec2(1.0,1.0)),u.x), u.y);',
      '}',
      'float fbm(vec2 p){',
      '  float v=0.0, a=0.5;',
      '  for(int i=0;i<4;i++){ v+=a*noise(p); p*=2.0; a*=0.5; }',
      '  return v;',
      '}',
      'void main(){',
      '  vec2 uv = gl_FragCoord.xy / uRes.xy;',
      '  vec2 p = uv * 3.0;',
      '  float t = uTime * 0.05;',
      '  float f = fbm(p + vec2(t, t*0.5) + fbm(p - vec2(t*0.3, 0.0)));',
      '  vec3 royal   = vec3(0.082, 0.396, 0.753);', /* #1565C0 */
      '  vec3 saffron = vec3(1.0,   0.435, 0.0);',   /* #FF6F00 */
      '  vec3 navy    = vec3(0.102, 0.137, 0.494);', /* #1A237E */
      '  vec3 col = mix(royal, saffron, smoothstep(0.30, 0.80, f));',
      '  col = mix(col, navy, smoothstep(0.50, 1.0, fbm(p*0.7 - t)));',
      '  float band = 0.5 + 0.5*sin((uv.x + uv.y)*3.0 + t*4.0 + f*4.0);',
      '  float alpha = (0.08 + 0.12*band) * (0.55 + 0.45*f) * 0.6;',
      '  gl_FragColor = vec4(col, alpha);',
      '}'
    ].join('\n');

    function compile(type, src) {
      var s = gl.createShader(type);
      gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { return null; }
      return s;
    }
    var vs = compile(gl.VERTEX_SHADER, vsSource);
    var fs = compile(gl.FRAGMENT_SHADER, fsSource);
    if (!vs || !fs) { canvas.remove(); return; }

    var prog = gl.createProgram();
    gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { canvas.remove(); return; }
    gl.useProgram(prog);

    var buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);
    var aPos = gl.getAttribLocation(prog, 'aPos');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    var uTime = gl.getUniformLocation(prog, 'uTime');
    var uRes  = gl.getUniformLocation(prog, 'uRes');

    gl.clearColor(0, 0, 0, 0);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    var DPR = Math.min(window.devicePixelRatio || 1, 1.5);
    function size() {
      var w = canvas.clientWidth || window.innerWidth;
      var h = canvas.clientHeight || window.innerHeight;
      canvas.width = Math.max(1, Math.floor(w * DPR));
      canvas.height = Math.max(1, Math.floor(h * DPR));
      gl.viewport(0, 0, canvas.width, canvas.height);
    }
    window.addEventListener('resize', size, { passive: true });
    size();

    function draw(t) {
      gl.uniform1f(uTime, t);
      gl.uniform2f(uRes, canvas.width, canvas.height);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }

    var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) { draw(0); return; }  /* single still frame, no loop */

    var start = null;
    function loop(now) {
      if (start === null) start = now;
      draw((now - start) / 1000);
      requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
