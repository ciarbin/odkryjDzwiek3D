//variables for scene in THREE JS
let sceneContainer = document.querySelector(".sandbox-canvas-holder");
let camera;
let renderer;
let loader = new THREE.GLTFLoader();
let scene;

//variables for raycasting in THREE JS
let raycaster = new THREE.Raycaster();
let mouse = new THREE.Vector2();

//variables for soundObjects 
let circles;
let head;
let soundObjects = [];
let selectedElement = null;
let colors = {
    "woda1": {"normal": 0x000066, "selected": 0x0000ff},
    "woda2": {"normal": 0x006600, "selected": 0x00ff00},
    "ptak": {"normal": 0x660000, "selected": 0xff0000},
    "zrodlo": {"normal": 0x666600, "selected": 0xffff00},
};

//variables for Web Audio API
let audioCtx;
let audioListener;
let audioLoadingPromise;
let background = {};
let sounds = {
    "woda1": "/sounds/woda1.mp3",
    "woda2": "/sounds/woda2.mp3",
    "ptak": "/sounds/ptak.mp3",
    "zrodlo": "/sounds/zrodelko.mp3",
    "bg": "/sounds/tlo.mp3",
};

/*//variables for Omnitone
const spatialAudioElement = document.createElement('audio');
spatialAudioElement.src = './../sounds/forestShort.wav';
let foaRenderer;
let spatialAudioSource;*/

//variables for backgroundAudioFiles
let backgrounds = new Object();
let recentlySelected = document.querySelector(".input-radio:checked");

//materials and constants for spheres and interaction
let transparentMaterial = new THREE.MeshPhysicalMaterial( { color: 0x1e2138, 
    transparent: true, 
    transmission: 0.35,
    side: THREE.DoubleSide} );

let normalMaterial = new THREE.MeshPhysicalMaterial( { color: 0x606060,
    side: THREE.DoubleSide} );

let selectedMaterial = new THREE.MeshPhysicalMaterial( { color: 0x0000bb,
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

const DIST = 5;
const SIZE = 0.3;

//HTML elements holders
let buttonUpHolder = document.querySelector(".up");
let buttonDownHolder = document.querySelector(".down");
let buttonLeftHolder = document.querySelector(".left");
let buttonRightHolder = document.querySelector(".right");
let buttonStateHolder = document.querySelector(".state");
let buttonAddHolder = document.querySelector(".add");
let buttonDelHolder = document.querySelector(".del");
let buttonStartHolder = document.querySelector(".start");
let buttonPauseHolder = document.querySelector(".pause");
let newElementMenuHolder = document.querySelector(".new-element-menu");
let newElementButtonsHolders = document.querySelectorAll(".new-element");
let backgroundToggleHolder = document.querySelector(".background-toggle");

class soundObject {
    constructor(objectName) {
        this.objectName = objectName;
        this.object;
        this.azymut = 180;
        this.height = 0;
        this.source;
    }

    init() {
        this.object = createSphere();
        let materialNormal = cartoonMaterial.clone();
        materialNormal.color = new THREE.Color(colors[this.objectName].normal);
        let materialSelected = cartoonMaterial.clone();
        materialSelected.color = new THREE.Color(colors[this.objectName].selected);
        this.materials = {"normal" : materialNormal, "selected" : materialSelected};
        this.object.scale.set(SIZE, SIZE, SIZE);
        this.panner = audioCtx.createPanner();
        this.panner.panningModel = 'HRTF';
        this.panner.setPosition(0,0,-DIST);
        this.gainNode = audioCtx.createGain();
        this.changeVolume(1);
        this.gainNode.connect(this.panner);
        this.panner.connect(audioCtx.destination);
        this.update();
        scene.add(this.object);
        renderer.render(scene,camera);
    }

    update() {
        let position = positionFromAngles(this.azymut, this.height);
        this.object.position.set(position[0],position[1],position[2]);
        this.object.lookAt(0,0,0);
        this.panner.positionX.setValueAtTime(position[0], audioCtx.currentTime);
        this.panner.positionY.setValueAtTime(position[1], audioCtx.currentTime);
        this.panner.positionZ.setValueAtTime(position[2], audioCtx.currentTime);
        renderer.render(scene,camera);
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

function createSphere() {
    var sphereGeom = new THREE.SphereGeometry(2.5, 32, 16);
    return new THREE.Mesh(sphereGeom, cartoonMaterial);
}

function modelLoader(url) {
    return new Promise((resolve, reject) => {
        loader.load(url, data=> resolve(data), null, reject);
    }).then(object => object.scene);
}

async function loadAudioApi() {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    audioListener = audioCtx.listener;
    audioListener.setOrientation(0,0,-1,0,1,0);
    let promises = [];

    for ([name, path] of Object.entries(sounds)) {
        let nameVar = name;
        promises.push(window.fetch(path)
        .then(response => response.arrayBuffer())
        .then(arrayBuffer => audioCtx.decodeAudioData(arrayBuffer))
        .then(audioBuffer => sounds[nameVar] = audioBuffer));
    }
    background.gainNode = audioCtx.createGain();
    background.gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
    background.gainNode.connect(audioCtx.destination);
    await Promise.all(promises);
}

async function initScene() {
    scene = new THREE.Scene();

    const CANVAS_SIZE = Math.min(sceneContainer.clientWidth, sceneContainer.clientHeight);

    //camera settings
    const fov = 40;
    const aspect = 1;
    const nearClipping = 0.1;
    const farClipping = 500;
    camera = new THREE.PerspectiveCamera(fov,aspect,nearClipping,farClipping);
    camera.position.set(1, 1.5, 18);
    camera.lookAt(0,0,0);

    //light settings
    let ambient = new THREE.AmbientLight(0xffffff, 0.25);
    scene.add(ambient); 

    let light = new THREE.DirectionalLight(0xffffff, 0.75);
    light.position.set(50, 20, 50);
    scene.add(light);

    //renderer settings
    renderer = new THREE.WebGLRenderer({antialias:true, alpha:true});
    renderer.setSize(CANVAS_SIZE, CANVAS_SIZE);
    renderer.setPixelRatio(window.devicePixelRatio);

    //adding scene into html
    sceneContainer.appendChild(renderer.domElement);

    //loading head
    let headLoader = modelLoader('/models/head2.glb').then(function(gltf) {
        scene.add(gltf);
        let head = gltf.children;
        head[0].material = transparentMaterial;
        head[1].material = transparentMaterial;
        head[0].notSelectable = true;
        head[1].notSelectable = true;
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

    await headLoader;

    renderer.render(scene, camera);

    return 0;
}

function init() {
    initScene();
    audioLoadingPromise = loadAudioApi();
    $("#tutorialModal").modal();
}

init();

function positionFromAngles(azymut, height) {
    let position = [0,0,0];

    azymut = azymut / 180 * Math.PI;
    height = height / 180 * Math.PI;

    position[0] = Math.round(Math.sin(azymut) * Math.cos(height) * DIST * 1000) / 1000;
    position[2] = Math.round(Math.cos(azymut) * Math.cos(height) * DIST * 1000) / 1000;
    position[1] = Math.round(Math.sin(height) * DIST * 1000) / 1000;

    return position;
}

///////////////// Functions for interaction //////////////////////////////////////

function onWindowResize() {
    const SIZE = Math.min(sceneContainer.clientHeight, sceneContainer.clientWidth);
    renderer.setSize(SIZE, SIZE);
    renderer.render(scene, camera);
}

async function addNewElement(event) {
    let newObject = new soundObject(event.currentTarget.value)
    soundObjects.push(newObject);
    await newObject.init();
    newObject.play();
    changeSelectedElement(newObject);
}

function deleteSelectedElement() {
    selectedElement.object.geometry.dispose();
    selectedElement.object.material.dispose();
    selectedElement.source.stop();
    scene.remove(selectedElement.object);
    for(let i = 0; i < soundObjects.length; i++) {
        if(soundObjects[i] == selectedElement) {
            soundObjects.splice(i,1);
        }
    }
    delete selectedElement;
    changeSelectedElement(null);
    renderer.render(scene, camera);
}

function changeSelectedElement(newSelectedElement) {
    if (selectedElement != null) {
        selectedElement.object.material = selectedElement.materials.normal;
        hideElementControls();
    }
    if (newSelectedElement != null) {
        newSelectedElement.object.material = newSelectedElement.materials.selected;
        showElementControls();
    }
    renderer.render(scene, camera);
    selectedElement = newSelectedElement;
    hideNewElementMenu();
}

async function toggleBackground() {
    if(backgroundToggleHolder.classList.contains("active")) {
        background.source.stop();
    } else {
        await audioLoadingPromise;
        background.source = audioCtx.createBufferSource();
        background.source.buffer = sounds["bg"];
        background.source.loop = true;
        background.source.connect(background.gainNode);
        background.source.start();
    }
}

function up() {
    if (selectedElement != null) {
        if (selectedElement.height < 90) {
            selectedElement.height += 5;
        }
        selectedElement.update()
    }
}

function down() {
    if (selectedElement != null) {
        if (selectedElement.height > -90) {
            selectedElement.height -= 5;
        }
        selectedElement.update();
    }
}

function left() {
    if (selectedElement != null) {
        selectedElement.azymut += 5;
        selectedElement.update();
    }
}

function right() {
    if (selectedElement != null) {
        selectedElement.azymut -= 5;
        selectedElement.update();
    }
}

function onScreenClick(event) {
    event.preventDefault();

    mouse.x = (event.layerX /sceneContainer.childNodes[1].clientWidth) * 2 - 1;
    mouse.y = - (event.layerY / sceneContainer.childNodes[1].clientHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);

    let intersects = raycaster.intersectObjects(scene.children, true);
    let newSelection = null;

    for (let i = 0; i < intersects.length; i++) {
        
        if(!intersects[i].object.notSelectable) {
            newSelection = soundObjects.find(soundObjectEl => soundObjectEl.object === intersects[i].object);
            break;
        }
    }

    changeSelectedElement(newSelection);
}

function showNewElementMenu() {
    buttonStateHolder.classList.add("hidden");
    newElementMenuHolder.classList.remove("hidden");
}

function hideNewElementMenu() {
    newElementMenuHolder.classList.add("hidden");
    buttonStateHolder.classList.remove("hidden");
}

function hideElementControls() {
    buttonDelHolder.disabled = true;
    buttonDownHolder.disabled = true;
    buttonRightHolder.disabled = true;
    buttonLeftHolder.disabled = true;
    buttonUpHolder.disabled = true;
}

function showElementControls() {
    buttonDelHolder.disabled = false;
    buttonDownHolder.disabled = false;
    buttonRightHolder.disabled = false;
    buttonLeftHolder.disabled = false;
    buttonUpHolder.disabled = false;
}

function handleVisibilityChange() {
    if (document.hidden) {
      audioCtx.suspend();
    } else  {
      audioCtx.resume();
    }
  }
  
document.addEventListener("visibilitychange", handleVisibilityChange, false);

window.addEventListener("resize", onWindowResize);
buttonUpHolder.addEventListener("mousedown", up);
buttonDownHolder.addEventListener("click", down);
buttonLeftHolder.addEventListener("click", left);
buttonRightHolder.addEventListener("click", right);
sceneContainer.addEventListener("click", onScreenClick);
buttonAddHolder.addEventListener("click", showNewElementMenu);
buttonDelHolder.addEventListener("click", deleteSelectedElement);
backgroundToggleHolder.addEventListener("click", toggleBackground);

for(let i = 0; i < newElementButtonsHolders.length; i++) {
    newElementButtonsHolders[i].addEventListener("click", addNewElement);
}

/*



function switchElement() {
    if (selectedElement == null && soundObjects.length != 0) {
        changeSelectedElement(soundObjects[0]);
    } else if (selectedElement != null) {
        changeSelectedElement(soundObjects[(soundObjects.indexOf(selectedElement) + 1) % soundObjects.length]);
    }
}

function pauseApp() {
    audioCtx.suspend();
    buttonPauseHolder.classList.add("hidden");
    buttonStartHolder.classList.remove("hidden");
}

function toggleBackground() {
    if (radioNoneHolder.checked) {
        recentlySelected.checked = true;
        backgrounds[recentlySelected.value].play();
    } else {
        radioNoneHolder.checked = true;
        backgrounds[recentlySelected.value].pause();
    }
}

function changeBackground(e) {
    console.log(e);
    if (recentlySelected != null) {
        backgrounds[recentlySelected.value].pause();
    }
    switch(e.currentTarget.value) {
        case "none":
            break;
        case "forest":
            backgrounds["forest"].play();
            recentlySelected = e.currentTarget;
            break;
    }
}

function updateVolume(event) {
    selectedElement.changeVolume(event.currentTarget.value / 100);
}

buttonStartHolder.addEventListener("click", startApp);
buttonPauseHolder.addEventListener("click", pauseApp);

volumeSliderHolder.oninput = updateVolume;

for(let i = 0; i < radioHolders.length; i++) {
    radioHolders[i].addEventListener("change", changeBackground);
}

for(let i = 0; i < newElementButtonsHolders.length; i++) {
    newElementButtonsHolders[i].addEventListener("click", addNewElement);
}

document.addEventListener('keydown', function(e) {
    switch (e.keyCode) {
        case 9: // tab
            switchElement();
            break;
        case 13: // enter
            addNewElement();
            break;
        case 32: // space
            toggleBackground();
            break;
        case 8: // backspace
            deleteSelectedElement();
            break;
        case 37: // left
            left();
            break;
        case 38: // up
            up();
            break;
        case 39: // right
            right();
            break;
        case 40: // down
            down();
            break;
    }
    e.preventDefault();
});

// Links:
// https://www.kirupa.com/html5/press_and_hold.htm*/