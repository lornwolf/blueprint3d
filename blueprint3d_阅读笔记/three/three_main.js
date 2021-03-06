var THREE = require('three')
var JQUERY = require('jquery');
var ThreeController = require('./three_controller');
var ThreeFloorplan = require('./three_floorplan');
var ThreeLights = require('./three_lights');
var ThreeSkybox = require('./three_skybox');
var ThreeControls = require('./three_controls');
//var ThreeCanvas = require('./three_canvas')
var ThreeHUD = require('./three_hud.js')

/**
 * model   : 包含房间平面图数据和3D场景对象的model对象；
 * element : 画面右侧的DIV区域;
 * canvasElement : 
 * opts    : 空
 */
var ThreeMain = function(model, element, canvasElement, opts) {
  var scope = this;

  var options = {
    resize: true,
    pushHref: false,
    spin: true,
    spinSpeed: .00002,
    clickPan: true,
    canMoveFixedItems: false
  }

  // override with manually set options
  for (var opt in options) {
    if (options.hasOwnProperty(opt) && opts.hasOwnProperty(opt)) {
      options[opt] = opts[opt]
    }
  }

  var scene = model.scene;

  var model = model;
  // 把Div的DOM对象封装成jQuery对象。
  this.element = JQUERY(element);
  var domElement;

  var camera;
  var renderer;
  // var定义的只是函数内部的变量，外界不能访问。this定义的是生成对象的属性，外界可以访问。
  this.controls;
  var canvas;
  var controller;
  var floorplan;

  // var canvas;
  // var canvasElement = canvasElement;

  var needsUpdate = false;

  var lastRender = Date.now();
  var mouseOver = false;
  var hasClicked = false;

  var hud;

  this.heightMargin;
  this.widthMargin;
  this.elementHeight;
  this.elementWidth;

  this.itemSelectedCallbacks = JQUERY.Callbacks(); // item
  this.itemUnselectedCallbacks = JQUERY.Callbacks(); 
  this.wallClicked = JQUERY.Callbacks(); // wall
  this.floorClicked = JQUERY.Callbacks(); // floor
  this.nothingClicked = JQUERY.Callbacks();

  /**
   * 初始化相机、渲染器、控制器、灯光、skybox等。
   */
  function init() {
    THREE.ImageUtils.crossOrigin = "";

    domElement = scope.element.get(0) // Container
    camera = new THREE.PerspectiveCamera(45, 1, 1, 10000);
    renderer = new THREE.WebGLRenderer({
      antialias: true,
      preserveDrawingBuffer: true // required to support .toDataURL()
    });
    renderer.autoClear = false,
    renderer.shadowMapEnabled = true;
    renderer.shadowMapSoft = true;
    renderer.shadowMapType = THREE.PCFSoftShadowMap;

    var skybox = new ThreeSkybox(scene);

    scope.controls = new ThreeControls(camera, domElement);

    hud = new ThreeHUD(scope);

    // ThreeController对象会处理场景中物体的鼠标选中、拖拽、旋转等事件。
    controller = new ThreeController(scope, model, camera, scope.element, scope.controls, hud);

    domElement.appendChild(renderer.domElement);

    // handle window resizing
    scope.updateWindowSize();
    if (options.resize) {
      JQUERY(window).resize(scope.updateWindowSize);
    }

    // setup camera nicely
    scope.centerCamera();
    model.floorplan.fireOnUpdatedRooms(scope.centerCamera);

    var lights = new ThreeLights(scene, model.floorplan);

    // 创建ThreeFloorplan对象的作用就是给model.floorplan设置了一个room_update回调函数。
    floorplan = new ThreeFloorplan(scene, model.floorplan, scope.controls);

    animate();

    scope.element.mouseenter(function() {
      mouseOver = true;
    }).mouseleave(function() {
      mouseOver = false;
    }).click(function() {
      hasClicked = true;
    });

    //canvas = new ThreeCanvas(canvasElement, scope);
  }

  // 使场景旋转。
  function spin() {
    if (options.spin && !mouseOver && !hasClicked) {
      var theta = 2 * Math.PI * options.spinSpeed * (Date.now() - lastRender);
      scope.controls.rotateLeft(theta);
      scope.controls.update()
    }
  }

  this.dataUrl = function() {
    var dataUrl = renderer.domElement.toDataURL("image/png");
    return dataUrl;
  }

  this.stopSpin = function() {
    hasClicked = true;
  }

  this.options = function() {
    return options;
  }

  this.getModel = function() {
    return model;
  }

  this.getScene = function() {
    return scene;
  }

  this.getController = function() {
    return controller;
  }

  this.getCamera = function() {
    return camera;
  }

  this.needsUpdate = function() {
    needsUpdate = true;
  }

  function shouldRender() {
    // Do we need to draw a new frame
    if (scope.controls.needsUpdate || controller.needsUpdate || needsUpdate || model.scene.needsUpdate) {
      scope.controls.needsUpdate = false;
      controller.needsUpdate = false;
      needsUpdate = false;
      model.scene.needsUpdate = false;
      return true;
    } else {
      return false;
    }
  }

  function render() {
    spin();
    if (shouldRender()) {
      renderer.clear();
      renderer.render(scene.getScene(), camera);
      renderer.clearDepth();
      renderer.render(hud.getScene(), camera); 
    }
    lastRender = Date.now();
  };

  function animate() {
    var delay = 50;
    setTimeout(function() { 
      requestAnimationFrame(animate);
      }, delay);
    render();
  };

  this.rotatePressed = function() {
    controller.rotatePressed();
  }

  this.rotateReleased = function() {
    controller.rotateReleased();
  }

  this.setCursorStyle = function(cursorStyle) {
    domElement.style.cursor = cursorStyle;
  };

  this.updateWindowSize = function() {
    scope.heightMargin = scope.element.offset().top;
    scope.widthMargin = scope.element.offset().left;

    scope.elementWidth = scope.element.innerWidth();
    if (options.resize) {
      scope.elementHeight = window.innerHeight - scope.heightMargin;
    } else {
      scope.elementHeight = scope.element.innerHeight();
    }

    camera.aspect = scope.elementWidth / scope.elementHeight;
    camera.updateProjectionMatrix();

    renderer.setSize(scope.elementWidth, scope.elementHeight);
    needsUpdate = true;
  }

  this.centerCamera = function() {
    var yOffset = 150.0;

    var pan = model.floorplan.getCenter();
    pan.y = yOffset;

    scope.controls.target = pan;

    var distance = model.floorplan.getSize().z * 1.5;

    var offset = pan.clone().add(
      new THREE.Vector3(0, distance, distance));
    //scope.controls.setOffset(offset);
    camera.position.copy(offset);

    scope.controls.update();
  }

  // projects the object's center point into x,y screen coords
  // x,y are relative to top left corner of viewer
  this.projectVector = function(vec3, ignoreMargin) {
    ignoreMargin = ignoreMargin || false;

    var widthHalf = scope.elementWidth / 2;
    var heightHalf = scope.elementHeight / 2;

    var vector = new THREE.Vector3();
    vector.copy(vec3);
    vector.project(camera);

    var vec2 = new THREE.Vector2();

    vec2.x = ( vector.x * widthHalf ) + widthHalf;
    vec2.y = - ( vector.y * heightHalf ) + heightHalf;

    if (!ignoreMargin) {
       vec2.x += scope.widthMargin;
       vec2.y += scope.heightMargin;
    }

    return vec2;
  }

  init();
}

module.exports = ThreeMain;
