// window.focus();

const CANNON = window.CANNON;

let world;
let camera, scene, renderer, controls, stats;
let stackArr;
let dropsArr;
let speed;
let isGameStarted;
let isGameOver;

const score = document.getElementById('score');
const highScore = document.getElementById('highscore');

const clickAudio = new Audio('./assets/click.wav');
const gameOverAudio = new Audio('./assets/gameOver.wav');
const perfectMatchAudio = new Audio('./assets/perfectMatch.wav');

const vertexShader = `
varying vec3 vNormal;
varying vec3 vViewPosition;
void main() {
    vNormal = normal;
    vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
    vViewPosition = viewPosition.xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
}`;

const fragmentShader = `
varying vec3 vNormal;
varying vec3 vViewPosition;

uniform vec3 lightPosition;
uniform vec3 lightColor;
uniform float shininess;
uniform vec3 colorArray;
uniform float metalness;


void main() {
  vec3 normal = normalize(vNormal);
  vec3 viewDirection = normalize(-vViewPosition);
  vec3 lightDirection = normalize(lightPosition - vViewPosition);
  
  // Diffuse Reflection
  float diffuse = max(dot(normal, lightDirection), 0.0);
  vec3 diffuseColor = diffuse * lightColor;
  
  // Specular Reflection
  vec3 reflectionDirection = reflect(-lightDirection, normal);
  float specular = pow(max(dot(reflectionDirection, viewDirection), 0.0), shininess);
  vec3 specularColor = specular * lightColor;

//   vec3 col;
//     col.r=(sin(gl_FragCoord.x)+1.0)/2.0;
//     col.g=(cos(gl_FragCoord.y)+1.0)/2.0;
//     col.b=(cos(gl_FragCoord.z*2.0)+1.0)/2.0;

  
  // Combine Diffuse and Specular
  vec3 finalColor = diffuseColor + specularColor+ colorArray;
  
  gl_FragColor = vec4(finalColor, 1.0);
}`;

const metalFragmentShader = `
varying vec3 vNormal;
varying vec3 vViewPosition;
    `;

init();

function init() {
  const aspectRatio = window.innerWidth / window.innerHeight;
  const width = 10;
  const height = width / aspectRatio;
  stackArr = [];
  dropsArr = [];
  scene = new THREE.Scene();
  camera = new THREE.OrthographicCamera(
    width / -2,
    width / 2,
    height / 2,
    height / -2,
    1,
    100
  );
  camera.position.set(4, 4, 4);
  camera.lookAt(scene.position);

  const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(ambientLight);

  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.6);
  directionalLight.position.set(10, 20, 0);
  scene.add(directionalLight);

  world = new CANNON.World();
  world.gravity.set(0, -10, 0);
  world.broadphase = new CANNON.NaiveBroadphase();
  world.solver.iterations = 40;

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setClearColor(0x000000);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setAnimationLoop(animation);
  document.body.appendChild(renderer.domElement);
}

function animation() {
  speed = 0.15;
  if (isGameStarted && !isGameOver) {
    const topBox = stackArr[stackArr.length - 1];
    topBox.threejsBox.position[topBox.dir] += speed + stackArr.length / 1000;

    const previousBox = stackArr[stackArr.length - 2];

    const offset =
      topBox.threejsBox.position[topBox.dir] -
      previousBox.threejsBox.position[topBox.dir];
    if (offset > 10) {
      fail();
    }
    if (camera.position.y < stackArr.length - 2 + 4) {
      camera.position.y += speed;
    }
    updateCannonjsWorld();
    renderer.render(scene, camera);
  }
}

function addBox(x, y, z, xSize, zSize, isDropping) {
  const color = new THREE.Color(`hsl(${30 + stackArr.length * 4}, 100%, 50%)`);
  const colorArray = color.toArray();

  const geometry = new THREE.BoxGeometry(xSize, 1, zSize);
  const material = new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: {
      lightPosition: { value: new THREE.Vector3(10, 20, 0) },
      lightColor: { value: new THREE.Color(0xffffff) },
      shininess: { value: 9 },
      colorArray: { value: colorArray },
    },
  });
  //   const lambertMaterial = new THREE.MeshLambertMaterial({
  //     color: color,
  //   });
  const threejsBox = new THREE.Mesh(geometry, material);
  threejsBox.position.set(x, y, z);
  scene.add(threejsBox);

  const boxShape = new CANNON.Box(new CANNON.Vec3(xSize / 2, 0.5, zSize / 2));
  const mass = isDropping ? 1 + xSize * zSize : 0;
  const boxBody = new CANNON.Body({ mass, shape: boxShape });
  boxBody.position.set(x, y, z);
  world.addBody(boxBody);

  return {
    threejsBox: threejsBox,
    cannonjsBox: boxBody,
    xSize,
    zSize,
  };
}

function addLayer(x, z, xSize, zSize, dir) {
  const y = stackArr.length;
  const box = addBox(x, y, z, xSize, zSize, false);
  box.dir = dir;
  stackArr.push(box);
}

function addDrop(x, z, xSize, zSize) {
  const y = stackArr.length - 1;
  const box = addBox(x, y, z, xSize, zSize, true);
  dropsArr.push(box);
}

function updateCannonjsWorld() {
  world.step(1 / 60);
  dropsArr.forEach((e) => {
    e.threejsBox.position.copy(e.cannonjsBox.position);
    e.threejsBox.quaternion.copy(e.cannonjsBox.quaternion);
  });
}

const isMobile = getDeviceType();
console.log(isMobile);

if (isMobile) {
  window.addEventListener('click', (e) => {
    if (!isGameOver && isGameStarted) {
      eventHandler();
    } else {
      resetGame();
    }
    return;
  });
} else {
  window.addEventListener('keydown', (e) => {
    if (e.key === ' ') {
      e.preventDefault();
      eventHandler();
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      resetGame();
      return;
    }
  });
}

function eventHandler() {
  if (!isGameStarted) {
    resetGame();
    return;
  } else {
    continueGame();
    return;
  }
}

function resetGame() {
  isGameOver = false;
  isGameStarted = true;
  stackArr = [];
  dropsArr = [];
  if (score) {
    score.innerText = 0;
  }
  if (highScore) {
    highScore.innerText = localStorage.getItem('highscore') || 0;
  }

  if (world) {
    world.bodies.forEach((body) => {
      world.remove(body);
    });
  }
  if (scene) {
    for (let i = scene.children.length - 1; i >= 0; i--) {
      const obj = scene.children[i];
      if (obj.type === 'Mesh') {
        scene.remove(obj);
      }
    }
    addLayer(0, 0, 3, 3);
    addLayer(-10, 0, 3, 3, 'x');
  }
  if (camera) {
    camera.position.set(4, 4, 4);
    camera.lookAt(scene.position);
  }
}

function continueGame() {
  if (isGameOver) {
    return;
  }
  const topBox = stackArr[stackArr.length - 1];
  const previousBox = stackArr[stackArr.length - 2];

  const dir = topBox.dir;
  const size = topBox[dir === 'x' ? 'xSize' : 'zSize'];
  const delta =
    topBox.threejsBox.position[dir] - previousBox.threejsBox.position[dir];

  const dropSize = Math.abs(delta);

  const overlapSize = size - dropSize;

  //   almost perfect match
  if (overlapSize > 0.95 * size) {
    perfectMatch(topBox, previousBox);
    return;
  }

  if (overlapSize > 0) {
    spiltBox(topBox, delta, overlapSize);

    const dropOffset = (overlapSize / 2 + dropSize / 2) * Math.sign(delta);
    const dropX =
      dir === 'x'
        ? topBox.threejsBox.position.x + dropOffset
        : topBox.threejsBox.position.x;

    const dropZ =
      dir === 'z'
        ? topBox.threejsBox.position.z + dropOffset
        : topBox.threejsBox.position.z;

    const dropXSize = dir === 'x' ? dropSize : topBox.xSize;
    const dropZSize = dir === 'z' ? dropSize : topBox.zSize;

    clickAudio.play();

    addDrop(dropX, dropZ, dropXSize, dropZSize);

    const nextX = dir === 'x' ? topBox.threejsBox.position.x : -10;
    const nextZ = dir === 'z' ? topBox.threejsBox.position.z : -10;
    const nextXSize = topBox.xSize;
    const nextZSize = topBox.zSize;
    const nextDir = dir === 'x' ? 'z' : 'x';

    if (score) {
      score.innerText = parseInt(score.innerText) + 1;
    }

    addLayer(nextX, nextZ, nextXSize, nextZSize, nextDir);
  } else {
    fail();
  }
}

function perfectMatch(topBox, previousBox) {
  perfectMatchAudio.play();

  topBox.threejsBox.position[topBox.dir] =
    previousBox.threejsBox.position[topBox.dir];

  const dir = topBox.dir;

  const nextX = dir === 'x' ? topBox.threejsBox.position.x : -10;
  const nextZ = dir === 'z' ? topBox.threejsBox.position.z : -10;
  const nextXSize = topBox.xSize;
  const nextZSize = topBox.zSize;
  const nextDir = dir === 'x' ? 'z' : 'x';

  if (score) {
    score.innerText = parseInt(score.innerText) + 5;
  }

  addLayer(nextX, nextZ, nextXSize, nextZSize, nextDir);
}

function spiltBox(topBox, delta, overlapSize) {
  const dir = topBox.dir;
  const newXSize = dir === 'x' ? overlapSize : topBox.xSize;
  const newZSize = dir === 'z' ? overlapSize : topBox.zSize;

  const originalSize = topBox[dir === 'x' ? 'xSize' : 'zSize'];

  topBox.xSize = newXSize;
  topBox.zSize = newZSize;

  topBox.threejsBox.scale[dir] = overlapSize / originalSize;
  topBox.threejsBox.position[dir] -= delta / 2;

  topBox.cannonjsBox.position[dir] -= delta / 2;

  const shape = new CANNON.Box(
    new CANNON.Vec3(newXSize / 2, 0.5, newZSize / 2)
  );
  topBox.cannonjsBox.shapes = [];
  topBox.cannonjsBox.addShape(shape);
}

function fail() {
  gameOverAudio.play();

  const topBox = stackArr[stackArr.length - 1];

  addDrop(
    topBox.threejsBox.position.x,
    topBox.threejsBox.position.z,
    topBox.xSize,
    topBox.zSize
  );
  world.remove(topBox.cannonjsBox);
  scene.remove(topBox.threejsBox);

  if (score) {
    const scoreValue = parseInt(score.innerText);
    const highScoreValue = parseInt(highScore.innerText);
    if (scoreValue > highScoreValue) {
      localStorage.setItem('highscore', scoreValue);
      highScore.innerText = scoreValue;
    }
  }
  setTimeout(() => {
    isGameOver = true;
  }, 1000);

  return;
}

// function collapse(box) {
//   const xSize = box.xSize;
//   const zSize = box.zSize;
//   const fragments = [];

//   for (let i = 0; i < 4; i++) {
//     const geometry = new THREE.BoxGeometry(xSize / 2, 1 / 2, zSize / 2);
//     const material = new THREE.MeshLambertMaterial({ color: 0xffffff });
//     const fragment = new THREE.Mesh(geometry, material);
//     fragment.position.copy(box.threejsBox.position);
//     fragment.position.x += Math.random() * 0.4 - 0.2;
//     fragment.position.y += Math.random() * 0.4 - 0.2;
//     fragment.position.z += Math.random() * 0.4 - 0.2;
//     scene.add(fragment);
//     fragments.push(fragment);
//   }

//   fragments.forEach((fragment) => {
//     const boxShape = new CANNON.Box(
//       new CANNON.Vec3(
//         fragment.geometry.parameters.width / 2,
//         fragment.geometry.parameters.height / 2,
//         fragment.geometry.parameters.depth / 2
//       )
//     );
//     const mass = 1;
//     const boxBody = new CANNON.Body({ mass, shape: boxShape });
//     boxBody.position.copy(fragment.position);
//     world.addBody(boxBody);
//   });

//   scene.remove(box.threejsBox);
//   world.remove(box.cannonjsBox);
// }

function getDeviceType() {
  const userAgent = navigator.userAgent;

  // 检测是否是移动设备
  const isMobile =
    /Mobile|Android|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      userAgent
    );

  return isMobile;
}
