
/**
 * @file A simple WebGL example for viewing meshes read from OBJ files
 * @author Eric Shaffer <shaffer1@illinois.edu>
 */

/** @global The WebGL context */
var gl;

/** @global The HTML5 canvas we draw on */
var canvas;

/** @global A simple GLSL shader program */
var shaderProgram;

/** @global A simple GLSL shader program */
var skyboxProgram;

/** @global To take currently pressed keys */
var currentlyPressedKeys = {};

/** @global The Modelview matrix */
var mvMatrix = mat4.create();

/** @global The View matrix */
var vMatrix = mat4.create();

/** @global The Model matrix */
var mMatrix = mat4.create();

/** @global The Projection matrix */
var pMatrix = mat4.create();

/** @global The Normal matrix */
var nMatrix = mat3.create();

/** @global The matrix stack for hierarchical modeling */
var mvMatrixStack = [];

/** @global An object holding the geometry for a 3D mesh */
var myMesh;

/** @global An object holding the geometry for a skybox mesh */
var skybox;


// View parameters
/** @global Location of the camera in world coordinates */
var eyePt = vec3.fromValues(0.0,1.0,10.0);
/** @global Direction of the view in world coordinates */
var viewDir = vec3.fromValues(0.0,0.0,-1.0);
/** @global Up vector for view matrix creation, in world coordinates */
var up = vec3.fromValues(0.0,1.0,0.0);
/** @global Location of a point along viewDir in world coordinates */
var viewPt = vec3.fromValues(0.0,1.0,0.0);

//Light parameters
/** @global Light position in VIEW coordinates */
var lightPosition = [10,10,10];
/** @global Ambient light color/intensity for Phong reflection */
var lAmbient = [0,0,0];
/** @global Diffuse light color/intensity for Phong reflection */
var lDiffuse = [1,1,1];
/** @global Specular light color/intensity for Phong reflection */
var lSpecular =[1,1,1];

//Material parameters
/** @global Ambient material color/intensity for Phong reflection */
var kAmbient = [1.0,1.0,1.0];
/** @global Diffuse material color/intensity for Phong reflection */
var kTerrainDiffuse = [205.0/255.0,163.0/255.0,63.0/255.0];
/** @global Specular material color/intensity for Phong reflection */
var kSpecular = [0.5,0.5,0.5];
/** @global Shininess exponent for Phong reflection */
var shininess = 200;
/** @global Edge color fpr wireframeish rendering */
var kEdgeBlack = [0.0,0.0,0.0];
/** @global Edge color for wireframe rendering */
var kEdgeWhite = [1.0,1.0,1.0];
// Indicate reflective or refractive for vertex shader
var textureType;
// Indicate phong shading or texture mapping for fragment shader
var phong;

//-------------------------------------------------------------------------
function handleKeyDown(event) {
  console.log("Key down", event.key, " code ", event.code);
  if (event.key == "ArrowUp" || event.key == "ArrowDown" || event.key == "ArrowLeft" || event.key == "ArrowRight")
  {
  event.preventDefault();
  }
  currentlyPressedKeys[event.key] = true;
  if (currentlyPressedKeys["ArrowUp"])
  {
  vec3.rotateX(eyePt,eyePt,viewPt,degToRad(5));
  }
  else if (currentlyPressedKeys["ArrowDown"])
  {
  vec3.rotateX(eyePt,eyePt,viewPt,-degToRad(5));
  }
  else if (currentlyPressedKeys["ArrowLeft"])
  {
  vec3.rotateY(eyePt,eyePt,viewPt,-degToRad(5));
  }
  else if (currentlyPressedKeys["ArrowRight"])
  {
  vec3.rotateY(eyePt,eyePt,viewPt,degToRad(5));
  }
}

function handleKeyUp(event) {
        currentlyPressedKeys[event.key] = false;
}

//-------------------------------------------------------------------------
/**
 * Sends Modelview matrix to shader
 */
function uploadModelViewMatrixToShader() {
  gl.uniformMatrix4fv(shaderProgram.mvMatrixUniform, false, mvMatrix);
  gl.uniformMatrix4fv(shaderProgram.vMatrixUniform, false, vMatrix);
  gl.uniform3fv(shaderProgram.uniformEyeLoc, eyePt);
}

//-------------------------------------------------------------------------
/**
 * Sends projection matrix to shader
 */
function uploadProjectionMatrixToShader() {
  gl.uniformMatrix4fv(shaderProgram.pMatrixUniform,
                      false, pMatrix);
}

//-------------------------------------------------------------------------
/**
 * Generates and sends the normal matrix to the shader
 */
function uploadNormalMatrixToShader() {
  mat3.fromMat4(nMatrix,mvMatrix);
  mat3.transpose(nMatrix,nMatrix);
  mat3.invert(nMatrix,nMatrix);
  gl.uniformMatrix3fv(shaderProgram.nMatrixUniform, false, nMatrix);
}

//----------------------------------------------------------------------------------
/**
 * Sends parameters indicating which texture and shading to apply
 */
function uploadParametersToShader() {
  gl.uniform1i(shaderProgram.uniformTextureTypeLoc, textureType);
  gl.uniform1i(shaderProgram.uniformPhongLoc, phong);
}

//----------------------------------------------------------------------------------
/**
 * Sends projection/modelview matrices to shader
 */
function setMatrixUniforms() {
    gl.useProgram(shaderProgram);
    uploadParametersToShader();
    uploadModelViewMatrixToShader();
    uploadNormalMatrixToShader();
    uploadProjectionMatrixToShader();
}

//----------------------------------------------------------------------------------
/**
 * Sends projection/modelview matrices to shader
 */
function setSkyBoxMatrixUniforms() {
  gl.useProgram(skyboxProgram);
  gl.uniformMatrix4fv(skyboxProgram.vMatrixUniform, false, vMatrix);
  gl.uniformMatrix4fv(skyboxProgram.pMatrixUniform, false, pMatrix);
}

//----------------------------------------------------------------------------------
/**
 * Pushes matrix onto modelview matrix stack
 */
function mvPush() {
    var copy = mat4.clone(mvMatrix);
    mvMatrixStack.push(copy);
}


//----------------------------------------------------------------------------------
/**
 * Pops matrix off of modelview matrix stack
 */
function mvPop() {
    if (mvMatrixStack.length != 0) {
        mvMatrix = mvMatrixStack.pop();
    }
}

//----------------------------------------------------------------------------------
/**
 * Translates degrees to radians
 * @param {Number} degrees Degree input to function
 * @return {Number} The radians that correspond to the degree input
 */
function degToRad(degrees) {
        return degrees * Math.PI / 180;
}

//----------------------------------------------------------------------------------
/**
 * Creates a context for WebGL
 * @param {element} canvas WebGL canvas
 * @return {Object} WebGL context
 */
function createGLContext(canvas) {
  var names = ["webgl", "experimental-webgl"];
  var context = null;
  for (var i=0; i < names.length; i++) {
    try {
      context = canvas.getContext(names[i]);
    } catch(e) {}
    if (context) {
      break;
    }
  }
  if (context) {
    context.viewportWidth = canvas.width;
    context.viewportHeight = canvas.height;
  } else {
    alert("Failed to create WebGL context!");
  }
  return context;
}

//----------------------------------------------------------------------------------
/**
 * Loads Shaders
 * @param {string} id ID string for shader to load. Either vertex shader/fragment shader
 */
function loadShaderFromDOM(id) {
  var shaderScript = document.getElementById(id);

  // If we don't find an element with the specified id
  // we do an early exit
  if (!shaderScript) {
    return null;
  }

  // Loop through the children for the found DOM element and
  // build up the shader source code as a string
  var shaderSource = "";
  var currentChild = shaderScript.firstChild;
  while (currentChild) {
    if (currentChild.nodeType == 3) { // 3 corresponds to TEXT_NODE
      shaderSource += currentChild.textContent;
    }
    currentChild = currentChild.nextSibling;
  }

  var shader;
  if (shaderScript.type == "x-shader/x-fragment") {
    shader = gl.createShader(gl.FRAGMENT_SHADER);
  } else if (shaderScript.type == "x-shader/x-vertex") {
    shader = gl.createShader(gl.VERTEX_SHADER);
  } else {
    return null;
  }

  gl.shaderSource(shader, shaderSource);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    alert(gl.getShaderInfoLog(shader));
    return null;
  }
  return shader;
}

//----------------------------------------------------------------------------------
/**
 * Setup the fragment and vertex shaders
 */
function setupShaders() {
  var vertexShader = loadShaderFromDOM("shader-vs");
  var fragmentShader = loadShaderFromDOM("shader-fs");

  shaderProgram = gl.createProgram();
  gl.attachShader(shaderProgram, vertexShader);
  gl.attachShader(shaderProgram, fragmentShader);
  gl.linkProgram(shaderProgram);

  if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
    alert("Failed to setup shaders");
  }

  gl.useProgram(shaderProgram);

  shaderProgram.vertexPositionAttribute = gl.getAttribLocation(shaderProgram, "aVertexPosition");
  gl.enableVertexAttribArray(shaderProgram.vertexPositionAttribute);

  shaderProgram.vertexNormalAttribute = gl.getAttribLocation(shaderProgram, "aVertexNormal");
  gl.enableVertexAttribArray(shaderProgram.vertexNormalAttribute);

  shaderProgram.mvMatrixUniform = gl.getUniformLocation(shaderProgram, "uMVMatrix");
  shaderProgram.vMatrixUniform = gl.getUniformLocation(shaderProgram, "uVMatrix");
  shaderProgram.pMatrixUniform = gl.getUniformLocation(shaderProgram, "uPMatrix");
  shaderProgram.nMatrixUniform = gl.getUniformLocation(shaderProgram, "uNMatrix");
  shaderProgram.uniformLightPositionLoc = gl.getUniformLocation(shaderProgram, "uLightPosition");
  shaderProgram.uniformAmbientLightColorLoc = gl.getUniformLocation(shaderProgram, "uAmbientLightColor");
  shaderProgram.uniformDiffuseLightColorLoc = gl.getUniformLocation(shaderProgram, "uDiffuseLightColor");
  shaderProgram.uniformSpecularLightColorLoc = gl.getUniformLocation(shaderProgram, "uSpecularLightColor");
  shaderProgram.uniformShininessLoc = gl.getUniformLocation(shaderProgram, "uShininess");
  shaderProgram.uniformAmbientMaterialColorLoc = gl.getUniformLocation(shaderProgram, "uKAmbient");
  shaderProgram.uniformDiffuseMaterialColorLoc = gl.getUniformLocation(shaderProgram, "uKDiffuse");
  shaderProgram.uniformSpecularMaterialColorLoc = gl.getUniformLocation(shaderProgram, "uKSpecular");
  shaderProgram.uniformTextureLoc = gl.getUniformLocation(shaderProgram, "uTexture");
  shaderProgram.uniformEyeLoc = gl.getUniformLocation(shaderProgram, "uEye");
  shaderProgram.uniformTextureTypeLoc = gl.getUniformLocation(shaderProgram, "uTextureType");
  shaderProgram.uniformPhongLoc = gl.getUniformLocation(shaderProgram, "uPhong");
}

//----------------------------------------------------------------------------------
/**
 * Setup the fragment and vertex shaders for skybox
 */
function setupSkyboxShaders() {
  var vertexShader = loadShaderFromDOM("skybox-vs");
  var fragmentShader = loadShaderFromDOM("skybox-fs");

  skyboxProgram = gl.createProgram();
  gl.attachShader(skyboxProgram, vertexShader);
  gl.attachShader(skyboxProgram, fragmentShader);
  gl.linkProgram(skyboxProgram);

  if (!gl.getProgramParameter(skyboxProgram, gl.LINK_STATUS)) {
    alert("Failed to setup shaders");
  }

  gl.useProgram(skyboxProgram);

  skyboxProgram.vMatrixUniform = gl.getUniformLocation(skyboxProgram, "uVMatrix");
  skyboxProgram.pMatrixUniform = gl.getUniformLocation(skyboxProgram, "uPMatrix");

  skyboxProgram.vertexPositionAttribute = gl.getAttribLocation(skyboxProgram, "aVertexPosition");
  gl.enableVertexAttribArray(skyboxProgram.vertexPositionAttribute);
}

//-------------------------------------------------------------------------
/**
 * Sends material information to the shader
 * @param {Float32} alpha shininess coefficient
 * @param {Float32Array} a Ambient material color
 * @param {Float32Array} d Diffuse material color
 * @param {Float32Array} s Specular material color
 */
function setMaterialUniforms(alpha,a,d,s) {
  // Tell the shader to use texture unit 0 for uTexture
  gl.uniform1i(shaderProgram.uniformTextureLoc, 0);
  gl.uniform1f(shaderProgram.uniformShininessLoc, alpha);
  gl.uniform3fv(shaderProgram.uniformAmbientMaterialColorLoc, a);
  gl.uniform3fv(shaderProgram.uniformDiffuseMaterialColorLoc, d);
  gl.uniform3fv(shaderProgram.uniformSpecularMaterialColorLoc, s);
}

//-------------------------------------------------------------------------
/**
 * Sends light information to the shader
 * @param {Float32Array} loc Location of light source
 * @param {Float32Array} a Ambient light strength
 * @param {Float32Array} d Diffuse light strength
 * @param {Float32Array} s Specular light strength
 */
function setLightUniforms(loc,a,d,s) {
  gl.uniform3fv(shaderProgram.uniformLightPositionLoc, loc);
  gl.uniform3fv(shaderProgram.uniformAmbientLightColorLoc, a);
  gl.uniform3fv(shaderProgram.uniformDiffuseLightColorLoc, d);
  gl.uniform3fv(shaderProgram.uniformSpecularLightColorLoc, s);
}

//----------------------------------------------------------------------------------
/**
 * Draw call that applies matrix transformations to model and draws model in frame
 */
function draw() {
    //console.log("function draw()")

    gl.viewport(0, 0, gl.viewportWidth, gl.viewportHeight);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // We'll use perspective
    mat4.perspective(pMatrix,degToRad(45),
                     gl.viewportWidth / gl.viewportHeight,
                     0.1, 500.0);

    // Then generate the lookat matrix and initialize the view matrix to that view
    mat4.lookAt(vMatrix,eyePt,viewPt,up);

    //Draw Mesh
    //ADD an if statement to prevent early drawing of myMesh
    if (myMesh.loaded()) {
        mvPush();
        mat4.multiply(mvMatrix,vMatrix,mvMatrix);
        setMatrixUniforms();
        setLightUniforms(lightPosition,lAmbient,lDiffuse,lSpecular);
        setMaterialUniforms(shininess,kAmbient,
                            kTerrainDiffuse,kSpecular);
        myMesh.drawTriangles();
        setSkyBoxMatrixUniforms();
        drawTriangles(skybox);
        mvPop();
    }
}

//----------------------------------------------------------------------------------
/**
 * Populate buffers with data
 */
function setupMesh(filename) {
  myMesh = new TriMesh();
  myPromise = asyncGetFile(filename);

  myPromise.then((retrievedText) => {
    myMesh.loadFromOBJ(retrievedText);
    console.log("Yay! got the file");
  })
  .catch(
    (reason) => {
      console.log(`Handle rejected promise (${reason}) here.`);
  })
}

//-------------------------------------------------------------------------
/**
 * Asynchronously read a server-side text file
 */
function asyncGetFile(url) {
  console.log("Getting text file");
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("GET", url);
    xhr.onload = () => resolve(xhr.responseText);
    xhr.onerror = () => reject(xhr.statusText);
    xhr.send();
    console.log("Made promise");
  });
}

//----------------------------------------------------------------------------------
/**
 * Create a texture with cubebox in WebGL
 */
function setTexture() {
  // Create a texture.
  var texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_CUBE_MAP, texture);

  const faceInfos = [
  {
      target: gl.TEXTURE_CUBE_MAP_POSITIVE_X,
      url: 'London/pos-x.png',
  },
  {
      target: gl.TEXTURE_CUBE_MAP_NEGATIVE_X,
      url: 'London/neg-x.png',
  },
  {
      target: gl.TEXTURE_CUBE_MAP_POSITIVE_Y,
      url: 'London/pos-y.png',
  },
  {
      target: gl.TEXTURE_CUBE_MAP_NEGATIVE_Y,
      url: 'London/neg-y.png',
  },
  {
      target: gl.TEXTURE_CUBE_MAP_POSITIVE_Z,
      url: 'London/pos-z.png',
  },
  {
      target: gl.TEXTURE_CUBE_MAP_NEGATIVE_Z,
      url: 'London/neg-z.png',
  },
  ];
  faceInfos.forEach((faceInfo) => {
      const {target, url} = faceInfo;

      // Upload the canvas to the cubemap face.
      const level = 0;
      const internalFormat = gl.RGBA;
      const width = 512;
      const height = 512;
      const format = gl.RGBA;
      const type = gl.UNSIGNED_BYTE;

      // setup each face so it's immediately renderable
      gl.texImage2D(target, level, internalFormat, width, height, 0, format, type, null);

      // Asynchronously load an image
      const image = new Image();
      image.src = url;
      image.addEventListener('load', function() {
          // Now that the image has loaded make copy it to the texture.
          gl.bindTexture(gl.TEXTURE_CUBE_MAP, texture);
          gl.texImage2D(target, level, internalFormat, format, type, image);
          gl.generateMipmap(gl.TEXTURE_CUBE_MAP);
      });
  });
  gl.generateMipmap(gl.TEXTURE_CUBE_MAP);
  gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
}

/**
 * Create a skybox
 */
function setSkyboxMesh() {

 var skyVertices =
 [ -30,30,30,  30,30,30, -30,-30,30, 30,-30,30,
   30,30,-30,  -30,30,-30, 30,-30,-30, -30,-30,-30
 ];
 var vertexCount = skyVertices.length;
 var skyFaces =
 [ 0,1,2,1,2,3,  //front
   5,0,7,0,7,2,  //left
   1,4,3,4,3,6,  //right
   7,6,2,6,2,3,  //bottom
   4,5,6,5,6,7,  //back
   5,4,0,4,0,1   //top
 ]
 var faceCount = skyFaces.length;

   var model = {};
   model.vertexPositions = new Float32Array(skyVertices);
   model.indices = new Uint32Array(skyFaces);
   model.coordsBuffer = gl.createBuffer();
   model.indexBuffer = gl.createBuffer();
   model.count = model.indices.length;
   gl.bindBuffer(gl.ARRAY_BUFFER, model.coordsBuffer);
   gl.bufferData(gl.ARRAY_BUFFER, model.vertexPositions, gl.STATIC_DRAW);
   gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, model.indexBuffer);
   gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, model.indices, gl.STATIC_DRAW);
   drawTriangles(model);
   return model;
}

function drawTriangles(model){
   gl.bindBuffer(gl.ARRAY_BUFFER, model.coordsBuffer);
   gl.vertexAttribPointer(skyboxProgram.vertexPositionAttribute, 3, gl.FLOAT, false, 0, 0);
   //Draw
   gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, model.indexBuffer);
   gl.drawElements(gl.TRIANGLES, model.count, gl.UNSIGNED_INT,0);
}

//----------------------------------------------------------------------------------
/**
 * Startup function called from html code to start program.
 */
 function startup() {
  canvas = document.getElementById("myGLCanvas");
  gl = createGLContext(canvas);
  setupShaders();
  setupMesh("teapot.obj");
  setupSkyboxShaders();
  skybox = setSkyboxMesh();
  setTexture();
  gl.clearColor(0.0, 0.0, 0.0, 1.0);
  gl.enable(gl.DEPTH_TEST);
  document.onkeydown = handleKeyDown;
  document.onkeyup = handleKeyUp;
  tick();
}


//----------------------------------------------------------------------------------
/**
  * Update any model transformations
  */
function animate() {
  if ((document.getElementById("phong").checked))
  {
    textureType = 0;
    phong = true;
  }
  else
  {
    if ((document.getElementById("reflective").checked))
    {
      textureType = 1;
    }
    else if ((document.getElementById("refractive").checked))
    {
      textureType = 2;
    }
    phong = false;
  }
}


//----------------------------------------------------------------------------------
/**
 * Keeping drawing frames.
 */
function tick() {
    requestAnimFrame(tick);
    animate();
    draw();
}
