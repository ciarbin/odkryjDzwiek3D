//variables and constants for scene in THREE JS
let loader = new THREE.GLTFLoader();

const DIST = 5;
const SIZE = 0.3;
let models = {
    "dragon" : "/models/dragonHead.glb",
    "test" : "",
};

//variables for Web Audio API
let audioCtx;
let audioListener;
let audioLoadingPromise;
let sounds = {
    "dragon" : "/sounds/water.mp3",
    "test" : "/sounds/water.mp3",
};

//variables for animating elements
let scenes = {};
let animatedScene;
let animationId;
let animationStart;
let animationButtonHolder;
let animations = 
{
    "test1": {
        "contains": {"d1":["test",-180,0]},
        "anim": {
            'length':16000,
            'description': {
                'd1':[[0,-180,0],[8000,180,0],[10000,180,90],[10001,360,90],[14000,360,-90],[14001,180,-90],[16000,180,0]],
            }
        }
    },
    "test2": {
        "contains": {"d1":["test",0,0]},
        "anim": {
            'length': 6300,
            'description': {
                'd1':[[0,0,0],[6000,-1080,0]]
            }
        }
    }
};

//materials and constants for spheres and interaction
let transparentMaterial = new THREE.MeshPhysicalMaterial( { color: 0x1e2138, 
    transparent: true, 
    transmission: 0.35,
    side: THREE.DoubleSide} );

let normalMaterial = new THREE.MeshPhysicalMaterial( { color: 0x909090,
    side: THREE.DoubleSide} );

let selectedMaterial = new THREE.MeshPhysicalMaterial( { color: 0x6060b0,
    side: THREE.DoubleSide} );

let sphereMaterial = new THREE.MeshPhysicalMaterial( { color: 0xD9B08C, 
    transparent: true, transmission: 0.4} );

var colorsArray = new Uint8Array( 8 );
for ( var c = 0; c <= colorsArray.length; c ++ ) {
    colorsArray[ c ] = ( c / colorsArray.length ) * 256;
}
var gradientMap = new THREE.DataTexture( colorsArray, colorsArray.length, 1, THREE.LuminanceFormat );
gradientMap.minFilter = THREE.NearestFilter;
gradientMap.magFilter = THREE.NearestFilter;
gradientMap.generateMipmaps = false;

let cartoonMaterial = new THREE.MeshToonMaterial( { color: 0x000000,
    side: THREE.DoubleSide,
    gradientMap: gradientMap
});

class sceneObject {
    constructor(container) {
        this.container = container;

        this.soundObjects = new Object();

        this.animation;

        this.button;

        this.renderer;
        this.scene;
        this.camera;
    }

    async initModels() {
        [this.renderer, this.scene, this.camera] = await initScene(this.container);
        this.renderer.render(this.scene, this.camera);
        
    }

    async initAudio() {
        {   let tmp = animations[this.container.attributes.name.value];
            for (const [id, values] of Object.entries(tmp.contains)) {
                this.soundObjects[id] = new soundObject(values[0]);
                this.soundObjects[id].azymut = values[1];
                this.soundObjects[id].height = values[2];
                this.soundObjects[id].camera = this.camera;
                await audioLoadingPromise;
                await this.soundObjects[id].init();
                this.scene.add(this.soundObjects[id].object);
                this.soundObjects[id].update();
                this.renderer.render(this.scene, this.camera);
            }
            this.animation = tmp.anim;
        }
    }

    rerender() {
        this.renderer.render(this.scene, this.camera);
    }
}

class scene2dObject {
    constructor() {
        this.is2d = true;

        this.objectName = "dragon";
    }

    async play() {
        await audioLoadingPromise;
        this.source = audioCtx.createBufferSource();
        this.source.buffer = sounds[this.objectName];
        this.source.loop = true;
        this.gainNode = audioCtx.createGain();
        this.gainNode.gain.setValueAtTime(0.15, audioCtx.currentTime);
        
        this.source.connect(this.gainNode);
        this.gainNode.connect(audioCtx.destination);

        this.source.start();
    }
}

class soundObject {
    constructor(objectName) {
        this.objectName = objectName;
        this.object;
        this.azymut = 180;
        this.height = 0;
        this.source;
        this.animationStage = 0;
    }

    async init() {
        if (models[this.objectName != ""]){
            this.object = await modelLoader(models[this.objectName]);
        } else {
            this.object = createSphere();
            this.object.material.color = new THREE.Color("#c7af6b");
        }
        this.object.scale.set(SIZE, SIZE, SIZE);
        await audioLoadingPromise;
        this.panner = audioCtx.createPanner();
        this.panner.panningModel = 'HRTF';
        this.panner.setPosition(0,0,-DIST);
        this.gainNode = audioCtx.createGain();
        this.changeVolume(1);
        this.gainNode.connect(this.panner);
        this.panner.connect(audioCtx.destination);
    }

    update() {
        let position = positionFromAngles(this.azymut, this.height);
        this.object.position.set(position[0],position[1],position[2]);
        this.object.lookAt(0,0,0);
        this.panner.positionX.setValueAtTime(position[0], audioCtx.currentTime);
        this.panner.positionY.setValueAtTime(position[1], audioCtx.currentTime);
        this.panner.positionZ.setValueAtTime(position[2], audioCtx.currentTime);
    }

    async play() {
        await audioLoadingPromise;
        this.source = audioCtx.createBufferSource();
        this.source.buffer = sounds[this.objectName];
        this.source.loop = true;
        this.source.connect(this.gainNode);
        this.source.start();
    }

    changeVolume(value) {
        this.gainNode.gain.setValueAtTime(value, audioCtx.currentTime);
    }
};

async function initScene(container) {
    let scene = new THREE.Scene();

    const CANVAS_WIDTH = 300;
    const CANVAS_HEIGHT = 300;

    //camera settings
    const fov = 40;
    const aspect = CANVAS_WIDTH / CANVAS_HEIGHT;
    const nearClipping = 0.1;
    const farClipping = 500;
    let camera = new THREE.PerspectiveCamera(fov,aspect,nearClipping,farClipping);
    camera.position.set(1, 1.5, 17);
    camera.lookAt(0,0,0);

    //light settings
    let ambient = new THREE.AmbientLight(0xffffff, 0.25);
    scene.add(ambient); 

    let light = new THREE.DirectionalLight(0xffffff, 0.75);
    light.position.set(50, 20, 50);
    scene.add(light);

    //renderer settings
    let renderer = new THREE.WebGLRenderer({antialias:true, alpha:true});
    renderer.setSize(CANVAS_WIDTH, CANVAS_HEIGHT);
    renderer.setPixelRatio(window.devicePixelRatio);

    //adding scene into html
    container.appendChild(renderer.domElement);

    //loading head
    let headLoader = modelLoader('./../models/head2.glb').then(function(gltf) {
        scene.add(gltf);
        let head = gltf.children;
        head[0].material = transparentMaterial;
        head[1].material = transparentMaterial;
    });

    //making circles
    let circles = new THREE.Object3D();
    let circle = new THREE.Mesh( new THREE.TorusGeometry(DIST, 0.02, 6, 50), sphereMaterial);
    circle.notSelectable = true;
    circles.add(circle);
    circle = circle.clone();
    circle.notSelectable = true;
    circle.rotation.x = Math.PI / 2;
    circles.add(circle);
    circle = circle.clone();
    circle.notSelectable = true;
    circle.rotation.y = Math.PI / 2;
    circles.add(circle);
    scene.add(circles);
    
    renderer.domElement.style.zIndex = "1";

    await headLoader;

    return [renderer, scene, camera];
}

async function loadAudioApi() {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    audioListener = audioCtx.listener;
    audioListener.setOrientation(0,0,-1,0,1,0);
    for ([name, path] of Object.entries(sounds)) {
        sounds[name] = window.fetch(path)
        .then(response => response.arrayBuffer())
        .then(arrayBuffer => audioCtx.decodeAudioData(arrayBuffer))
        .then((audioBuffer) => {return audioBuffer});
    }
    for ([name, soundPromise] of Object.entries(sounds)) {
        sounds[name] =  await soundPromise;
    }

    let containers = document.querySelectorAll(".canvas-3d");
    for (let i = 0; i < containers.length; i++) {
        scenes[containers[i].parentNode.id].initAudio();
    }
}

function init() {
    let containers = document.querySelectorAll(".canvas-3d");
    for (let i = 0; i < containers.length; i++) {
        let newObject = new sceneObject(containers[i]);
        newObject.initModels();
        scenes[containers[i].parentNode.id] = newObject;
    }
    let container = document.querySelector(".canvas-2d");
    if (container) scenes[container.parentNode.id] = new scene2dObject();
}

init();

function positionFromAngles(azymut, height) {
    let position = [0,0,0];

    azymut = azymut / 180 * Math.PI;
    height = height / 180 * Math.PI;

    position[0] = Math.sin(azymut) * Math.cos(height) * DIST;
    position[2] = Math.cos(azymut) * Math.cos(height) * DIST;
    position[1] = Math.sin(height) * DIST;

    return position;
}

function modelLoader(url) {
    if (url == "") {
        var sphereGeom = new THREE.SphereGeometry(1, 32, 16);
        return new THREE.Mesh( sphereGeom, selectedMaterial );
    } else {
        return new Promise((resolve, reject) => {
            loader.load(url, data=> resolve(data), null, reject);
        }).then(object => object.scene);
    }
}

function createSphere() {
    var sphereGeom = new THREE.SphereGeometry(2.5, 32, 16);
    return new THREE.Mesh(sphereGeom, cartoonMaterial);
}

function startAnimator(timestamp) {
    for ([id, object] of Object.entries(animatedScene.soundObjects)) {
        object.play();
    }
    animationStart = timestamp;
    animationId = requestAnimationFrame(animator);
    animationButtonHolder.classList.add("hidden");
}

function animator(timestamp) {
    let anim = animatedScene.animation;
    if (timestamp - animationStart > anim.length) {
        endAnimator();
    } else {
        for ([id, movements] of Object.entries(anim.description)) {
            let lastMovement, currentMovement = movements[0], i = 0;
            while (currentMovement[0] < timestamp - animationStart && ++i != movements.length) {
                lastMovement = currentMovement;
                currentMovement =  movements[i];
            }
            if (i != movements.length) {
                let step = (timestamp - animationStart - lastMovement[0]) / (currentMovement[0] - lastMovement[0]);
                animatedScene.soundObjects[id].azymut = lastMovement[1] + ((currentMovement[1] - lastMovement[1]) * step);
                animatedScene.soundObjects[id].height = lastMovement[2] + ((currentMovement[2] - lastMovement[2]) * step);
            } else {
                animatedScene.soundObjects[id].azymut = currentMovement[1];
                animatedScene.soundObjects[id].height = currentMovement[2];
            }
            animatedScene.soundObjects[id].update();
            
        }
        animatedScene.rerender();
        animationId = requestAnimationFrame(animator);
    }
}

async function endAnimator() {
    let anim = animatedScene.animation;
    cancelAnimationFrame(animationId);
    for ([id, movements] of Object.entries(anim.description)) {
        animatedScene.soundObjects[id].azymut = movements[0][1];
        animatedScene.soundObjects[id].height = movements[0][2];
        animatedScene.soundObjects[id].update();
    }
    for ([id, object] of Object.entries(animatedScene.soundObjects)) {
        object.source.stop();
    }
    animatedScene.rerender();
    animationStart = null;
    animationId = null;
    animationButtonHolder.classList.remove("hidden");
    animatedScene = null;
}

async function animationToggle() {
    if (!audioLoadingPromise) {
        audioLoadingPromise = loadAudioApi();
    }else {
    await audioLoadingPromise;
    let theSame = animatedScene == scenes[this.parentNode.id];
    if (animatedScene && animatedScene.is2d) {
        animatedScene.source.stop();
        animatedScene = null;
        animationButtonHolder.classList.remove("hidden");
    } else if (animatedScene) {
        endAnimator();
    }
    if (!theSame && scenes[this.parentNode.id].is2d) {
        scenes[this.parentNode.id].play();
        animatedScene = scenes[this.parentNode.id];
        animationButtonHolder = this;
        animationButtonHolder.classList.add("hidden");
    } else if (!theSame) {
        animatedScene = scenes[this.parentNode.id];
        animationButtonHolder = this;
        requestAnimationFrame(startAnimator);
    }
    }   
}

for (let buttonHolder of document.querySelectorAll(".start")) {
    buttonHolder.addEventListener("click", animationToggle);
}

function handleVisibilityChange() {
    if (document.hidden) {
      audioCtx.suspend();
    } else  {
      audioCtx.resume();
    }
  }
  
document.addEventListener("visibilitychange", handleVisibilityChange, false);