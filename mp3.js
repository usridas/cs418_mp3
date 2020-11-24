
/**
 * @file A simple WebGL example drawing central Illinois style terrain
 * @author Eric Shaffer <shaffer1@illinois.edu>
 */

/** @global The WebGL context */
var gl;

/** @global The HTML5 canvas we draw on */
var canvas;

/** @global A simple GLSL shader program */
var shaderProgram;

/** @global The Modelview matrix */
var mvMatrix = glMatrix.mat4.create();

/** @global The Projection matrix */
var pMatrix = glMatrix.mat4.create();

/** @global The Normal matrix */
var nMatrix = glMatrix.mat3.create();

/** @global An object holding the geometry for a 3D terrain */
var myTerrain;

/** @global To take currently pressed keys */
var currentlyPressedKeys = {};

/** @global Quat for viewing */
var currQuat = glMatrix.quat.create();

/** @global Speed over terrain */
var speed = 0.001;

/** @global Upwards and downwards tilt */
var moving = glMatrix.vec3.create();

/** @global Spin using arrows*/
var eulerX = 0;

/** @global Spin using arrows*/
var eulerY = 0;

/** @global mvMatrix stack*/
var mvMatrixStack = [];


// View parameters
/** @global Location of the camera in world coordinates */
var eyePt = glMatrix.vec3.fromValues(0.0,0.0,3.0);
/** @global Direction of the view in world coordinates */
var viewDir = glMatrix.vec3.fromValues(0.0,0.0,-3.0);
/** @global Up vector for view matrix creation, in world coordinates */
var up = glMatrix.vec3.fromValues(0.0,1.0,0.0);
/** @global Location of a point along viewDir in world coordinates */
var viewPt = glMatrix.vec3.fromValues(0.0,0.0,0.0);

//Light parameters
/** @global Light position in VIEW coordinates */
var lightPosition = [0,3,3];
/** @global Ambient light color/intensity for Phong reflection */
var lAmbient = [0,0,0];
/** @global Diffuse light color/intensity for Phong reflection */
var lDiffuse = [1,1,1];
/** @global Specular light color/intensity for Phong reflection */
var lSpecular =[0,0,0];

//Material parameters
/** @global Ambient material color/intensity for Phong reflection */
var kAmbient = [1.0,1.0,1.0];
/** @global Diffuse material color/intensity for Phong reflection */
var kTerrainDiffuse = [205.0/255.0,163.0/255.0,63.0/255.0];
/** @global Specular material color/intensity for Phong reflection */
var kSpecular = [0.0,0.0,0.0];
/** @global Shininess exponent for Phong reflection */
var shininess = 23;
/** @global Edge color fpr wireframeish rendering */
var kEdgeBlack = [0.0,0.0,0.0];
/** @global Edge color for wireframe rendering */
var kEdgeWhite = [1.0,1.0,1.0];

var currQuat = glMatrix.quat.create();
var skybox;

//-------------------------------------------------------------------------
/**
 * Checks keys pressed
 */
function handleKeyDown(event) {
  console.log("Key down", event.key, " code ", event.code);
  if (event.key == "ArrowUp" || event.key == "ArrowDown" || event.key == "ArrowLeft" || event.key == "ArrowRight")
  {
    event.preventDefault();
  }
  currentlyPressedKeys[event.key] = true;
  if (currentlyPressedKeys["ArrowUp"])
  {
   eulerY = (eulerY + 5) % 360;
  }
  else if (currentlyPressedKeys["ArrowDown"])
  {
   eulerY = (eulerY - 5) % 360;
  }
  else if (currentlyPressedKeys["ArrowLeft"])
  {
   eulerX = (eulerX - 5) % 360;
  }
  else if (currentlyPressedKeys["ArrowRight"])
  {
   eulerX = (eulerX + 5) % 360;
  }
}

//-------------------------------------------------------------------------
/**
 * Checks keys unpressed
 */
function handleKeyUp(event) {
  console.log("Key up", event.key, " code ", event.code);
  currentlyPressedKeys[event.key] = false;
}

//-------------------------------------------------------------------------
/**
 * Sends Modelview matrix to shader
 */
function uploadModelViewMatrixToShader() {
  gl.uniformMatrix4fv(shaderProgram.mvMatrixUniform, false, mvMatrix);
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
  glMatrix.mat3.fromMat4(nMatrix,mvMatrix);
  glMatrix.mat3.transpose(nMatrix,nMatrix);
  glMatrix.mat3.invert(nMatrix,nMatrix);
  gl.uniformMatrix3fv(shaderProgram.nMatrixUniform, false, nMatrix);
}

//----------------------------------------------------------------------------------
/**
 * Sends projection/modelview matrices to shader
 */
function setMatrixUniforms() {
    gl.useProgram(shaderProgram);
    uploadModelViewMatrixToShader();
    uploadNormalMatrixToShader();
    uploadProjectionMatrixToShader();
}

//----------------------------------------------------------------------------------
/**
 * Sends skybox matrices to shader (I don't think we need a normal matrix)
 */
function setSkyboxUniforms() {
    gl.useProgram(skyboxProgram);
    gl.uniformMatrix4fv(skyboxProgram.mvMatrixUniform, false, mvMatrix);
    gl.uniformMatrix4fv(skyboxProgram.pMatrixUniform, false, pMatrix);
}

//----------------------------------------------------------------------------------
/**
 * Push onto mvMatrix
 */
function mvPush() {
  var copyStack = mat4.clone(mvMatrix);
  mvMatrixStack.push(copyStack);
}

//----------------------------------------------------------------------------------
/**
 * Pop off mvMatrix
 */
function mvPop() {
  if(mvMatrixStack.length != 0)
  {
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
/**
 * Creates a context for WebGL
 * @param {element} canvas WebGL canvas
 * @return {Object} WebGL context
 */
function createGLContext(canvas) {
  var context = null;
  context = canvas.getContext("webgl");
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

  var shaderSource = shaderScript.text;

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
}
//----------------------------------------------------------------------------------
/**
 * Setup the fragment and vertex shaders
 */
function setupSkyBoxShaders() {
  var vertexShader = loadShaderFromDOM("skybox-vs");
  var fragmentShader = loadShaderFromDOM("skybox-fs");

  skyboxProgram = gl.createProgram();
  gl.attachShader(skyboxProgram, vertexShader);
  gl.attachShader(skyboxProgram, fragmentShader);
  gl.linkProgram(skyboxProgram);

  if (!gl.getProgramParameter(skyboxProgram, gl.LINK_STATUS)) {
    alert("Failed to setup skybox shaders");
  }

  gl.useProgram(skyboxProgram);

  skyboxProgram.mvMatrixUniform = gl.getUniformLocation(skyboxProgram, "uMVMatrix");
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

    gl.viewport(0, 0, gl.viewportWidth, gl.viewportHeight);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // We'll use perspective
    glMatrix.mat4.perspective(pMatrix,degToRad(45),
                     gl.viewportWidth / gl.viewportHeight,
                     0.5, 200.0);

    if(myMesh.loaded())
    {
      mvPush();
      glMatrix.mat4.rotateX(mvMatrix, mvMatrix, eulerX);
      glMatrix.mat4.rotateY(mvMatrix, mvMatrix, eulerY);

      // Then generate the lookat matrix and initialize the MV matrix to that view
      glMatrix.mat4.lookAt(mvMatrix,eyePt,viewPt,up);

      setMatrixUniforms();
      setLightUniforms(lightPosition,lAmbient,lDiffuse,lSpecular);
      setSkyboxUniforms();
      drawTriangles();

      if(document.getElementById("reflective").checked) //Mirror effect
      {
        gl.uniform1i(shaderProgram.uniformTextureLoc, 0);
      }
      else if(document.getElementById("refractive").checked) //Glass effect
      {
        gl.uniform1i(shaderProgram.uniformTextureLoc, 1);
      }
      else if (document.getElementById("solid").checked) //Blinn-Phong Shading
      {
        gl.uniform1i(shaderProgram.uniformTextureLoc, 2);
      }
      mvPop();
    }

    requestAnimationFrame(draw);

}
//----------------------------------------------------------------------------------
/**
* Set up meshes, populate buffers with data
*/
function setupMesh(filename)
{
  myMesh = new TriMesh();
  myPromise = new asyncGetFile(filename);
  myPromise.then((retrievedText) =>
  {
    myMesh.loadFromOBJ(retrievedText);
    console.log("Received file.");
  })
  .catch(
    (reason)=>
    {
      console.log('Handle rejected promise ('+ reason +') here.');
    });
}
//----------------------------------------------------------------------------------
/**
* Asynchronously read a server-side text file
*/
function asyncGetFile(url)
{
  console.log("Getting text file.");
  return new Promise((resolve, reject) =>
  {
    const xhr = new XMLHttpRequest();
    xhr.open("GET", url);
    xhr.onload = () => resolve(xhr.responseText);
    xhr.onerror = () => reject(xhr.statusText);
    xhr.send();
    console.log("Made promise.");
  });
}

//----------------------------------------------------------------------------------
/**
* Set up skybox texture
*/
function setupTexture()
{
  var texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_CUBE_MAP, texture);

  const faceInfos = [
    {
      target: gl.TEXTURE_CUBE_MAP_POSITIVE_X,
      url: 'London/pos-x.jpg',
    },
    {
      target: gl.TEXTURE_CUBE_MAP_NEGATIVE_X,
      url: 'London/neg-x.jpg',
    },
    {
      target: gl.TEXTURE_CUBE_MAP_POSITIVE_Y,
      url: 'London/pos-y.jpg',
    },
    {
      target: gl.TEXTURE_CUBE_MAP_NEGATIVE_Y,
      url: 'London/neg-y.jpg',
    },
    {
      target: gl.TEXTURE_CUBE_MAP_POSITIVE_Z,
      url: 'London/pos-z.jpg',
    },
    {
      target: gl.TEXTURE_CUBE_MAP_NEGATIVE_Z,
      url: 'London/neg-z.jpg',
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
      // Now that the image has loaded upload it to the texture.
      gl.bindTexture(gl.TEXTURE_CUBE_MAP, texture);
      gl.texImage2D(target, level, internalFormat, format, type, image);
      gl.generateMipmap(gl.TEXTURE_CUBE_MAP);
    });
  });
  gl.generateMipmap(gl.TEXTURE_CUBE_MAP);
  gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
}

//----------------------------------------------------------------------------------
/**
 * Startup function called from html code to start program.
 */
function setSkyboxMesh()
{
  var skyVertices =
  [-50, -50, 50,
    50, -50, 50,
    50, 50, 50,
    -50, 50, 50,
    -50, -50, -50,
    50, -50, -50,
    50, 50, -50,
    -50, 50, -50];
  var skyFaces = [];
  var currFace = [];
  currFace = [0, 1, 2, 0, 3, 2];
  skyFaces.push(currFace);
  currFace = [4, 5, 6, 4, 7, 6];
  skyFaces.push(currFace);
  currFace = [3, 2, 6, 3, 7, 6];
  skyFaces.push(currFace);
  currFace = [0, 1, 5, 0, 4, 5];
  skyFaces.push(currFace);
  currFace = [2, 1, 5, 2, 6, 5];
  skyFaces.push(currFace);
  currFace = [4, 0, 3, 4, 7, 35];
  skyFaces.push(currFace);

  // Specify normals to be able to do lighting calculations
  this.VertexPositionBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, this.VertexPositionBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(skyVertices), gl.STATIC_DRAW);
  this.VertexPositionBuffer.itemSize = 3;
  this.VertexPositionBuffer.numItems = this.numVertices;
  console.log("Loaded ", this.VertexPositionBuffer.numItems, " vertices");

  // Specify faces of the terrain
  this.IndexTriBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.IndexTriBuffer);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint32Array(skyFaces),
            gl.STATIC_DRAW);
  this.IndexTriBuffer.itemSize = 1;
  this.IndexTriBuffer.numItems = this.fBuffer.length;
  console.log("Loaded ", this.IndexTriBuffer.numItems, " triangles");
}

/**
* Render the triangles
*/
function drawTriangles(){
    gl.bindBuffer(gl.ARRAY_BUFFER, this.VertexPositionBuffer);
    gl.vertexAttribPointer(shaderProgram.vertexPositionAttribute, this.VertexPositionBuffer.itemSize,
                     gl.FLOAT, false, 0, 0);

    //Draw
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.IndexTriBuffer);
    gl.drawElements(gl.TRIANGLES, this.IndexTriBuffer.numItems, gl.UNSIGNED_INT,0);
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
  setSkyboxMesh();
  setupSkyBoxShaders();
  setupTexture();
  gl.clearColor(0.0, 0.0, 0.0, 1.0);
  gl.enable(gl.DEPTH_TEST);
  document.onkeydown = handleKeyDown;
  document.onkeyup = handleKeyUp;
  requestAnimationFrame(draw);
}
