var $ = require('jquery');
var FloorplannerView = require('./floorplanner_view')
var utils = require('../utils/utils')

/**
 * canvas : 画面上的画布对象ID。
 * floorplan : model.floorplan对象。为了给它设置回调函数而传过来。
 */
var Floorplanner = function(canvas, floorplan) {
  var scope = this;
  var floorplan = floorplan;

  this.modes = {
    MOVE: 0,
    DRAW: 1,
    DELETE: 2
  };
  this.mode = 0;
  var mouseDown = false;
  var mouseMoved = false;
  this.activeWall = null;
  this.activeCorner = null;

  this.originX = 0;
  this.originY = 0;

  // how much will we move a corner to make a wall axis aligned (cm)
  var snapTolerance = 25;

  // these are in threeJS coords（横纵坐标）
  var mouseX = 0;
  var mouseY = 0;
  var rawMouseX = 0;
  var rawMouseY = 0;

  // mouse position at last click
  var lastX = 0;
  var lastY = 0;

  // drawing state
  this.targetX = 0;  // 发生鼠标事件时鼠标位置的X轴坐标
  this.targetY = 0;  // 发生鼠标事件时鼠标位置的Y轴坐标
  this.lastNode = null;  // 在绘制状态下，最后一次鼠标点击的位置。

  this.modeResetCallbacks = $.Callbacks();

  // 获取画布对象
  var canvasElement = $("#" + canvas);

  var view = new FloorplannerView(floorplan, this, canvas);

  var cmPerFoot = 30.48;
  var pixelsPerFoot = 15.0;
  var cmPerPixel = cmPerFoot * (1.0 / pixelsPerFoot);
  var pixelsPerCm = 1.0 / cmPerPixel;
  this.wallWidth = 10.0 * pixelsPerCm;

  function init() {
    // 设置初始默认模式。
    scope.setMode(scope.modes.MOVE);
    // 注册鼠标事件
    canvasElement.mousedown(mousedown);
    canvasElement.mousemove(mousemove);
    canvasElement.mouseup(mouseup);
    canvasElement.mouseleave(mouseleave);
    // Esc键处理函数
    $(document).keyup(function(e) {
      if (e.keyCode == 27) { 
        escapeKey();
      }
    });
    floorplan.roomLoadedCallbacks.add(scope.reset);
  }

  function escapeKey() {
    scope.setMode(scope.modes.MOVE);
  }

  function updateTarget() {
    if (scope.mode == scope.modes.DRAW && scope.lastNode) { 
      if (Math.abs(mouseX - scope.lastNode.x) < snapTolerance) {
        scope.targetX = scope.lastNode.x;
      } else {
        scope.targetX = mouseX;
      }
      if (Math.abs(mouseY - scope.lastNode.y) < snapTolerance) {
        scope.targetY = scope.lastNode.y;
      } else {
        scope.targetY = mouseY;
      }
    } else {
      scope.targetX = mouseX;
      scope.targetY = mouseY;      
    }

    view.draw();
  }

  function mousedown() {
    mouseDown = true;
    mouseMoved = false;
    lastX = rawMouseX;
    lastY = rawMouseY;

    // delete
    if (scope.mode == scope.modes.DELETE) {
      if (scope.activeCorner) {
        scope.activeCorner.removeAll();
      } else if (scope.activeWall) {
        scope.activeWall.remove();
      } else {
        scope.setMode(scope.modes.MOVE);
      }
    }
  }

  function mousemove(event) {
    mouseMoved = true;

    // update mouse
    rawMouseX = event.clientX;
    rawMouseY = event.clientY;

    mouseX = (event.clientX - canvasElement.offset().left) * cmPerPixel + scope.originX * cmPerPixel;
    mouseY = (event.clientY - canvasElement.offset().top) * cmPerPixel + scope.originY * cmPerPixel;

    // update target (snapped position of actual mouse)
    if (scope.mode == scope.modes.DRAW || (scope.mode == scope.modes.MOVE && mouseDown)) {
      updateTarget();
    }

    // update object target
    // 非绘图状态，并且鼠标没有被押下的情况下。
    if (scope.mode != scope.modes.DRAW && !mouseDown) {
      // 判断鼠标是不是停留在角落上。
      var hoverCorner = floorplan.overlappedCorner(mouseX, mouseY);
      // 判断鼠标是不是停留在墙壁上。
      var hoverWall = floorplan.overlappedWall(mouseX, mouseY);
      // 是否需要重绘的标记。
      var draw = false;
      // 设置当前的“激活角落”。
      if (hoverCorner != scope.activeCorner) {
        scope.activeCorner = hoverCorner;
        draw = true;
      }
      // corner takes precendence
      // 设置当前的“激活墙”。
      if (scope.activeCorner == null) {
        if (hoverWall != scope.activeWall) {
          scope.activeWall = hoverWall;
          draw = true;
        }  
      } else {
        scope.activeWall = null;
      }
      if (draw) {
        view.draw();
      }
    }

    // panning
    if (mouseDown && !scope.activeCorner && !scope.activeWall) {
      scope.originX += (lastX - rawMouseX);
      scope.originY += (lastY - rawMouseY);
      lastX = rawMouseX;
      lastY = rawMouseY;
      view.draw();
    }

    // dragging
    if (scope.mode == scope.modes.MOVE && mouseDown) {
      if (scope.activeCorner) {
        // 移动角落（带动墙壁一起移动）
        scope.activeCorner.move(mouseX, mouseY);
        // 如果与别的角落坐标的x、y轴在一定距离内，则调整自己的坐标与之重合。
        scope.activeCorner.snapToAxis(snapTolerance);
      } else if (scope.activeWall) {
        scope.activeWall.relativeMove(
          (rawMouseX - lastX) * cmPerPixel, 
          (rawMouseY - lastY) * cmPerPixel
        );
        scope.activeWall.snapToAxis(snapTolerance);
        lastX = rawMouseX;
        lastY = rawMouseY;
      }
      view.draw();
    }
  }

  function mouseup() {
    mouseDown = false;

    // drawing
    if (scope.mode == scope.modes.DRAW && !mouseMoved) {
      // 在floorplan对象中新生成一个Corner对象
      var corner = floorplan.newCorner(scope.targetX, scope.targetY);
      if (scope.lastNode != null) {
        // 在floorplan对象中新生成一个Wall对象
        floorplan.newWall(scope.lastNode, corner);  
      }
      if (corner.mergeWithIntersected() && scope.lastNode != null) {
        scope.setMode(scope.modes.MOVE);
      } 
      scope.lastNode = corner;  
    }
  }

  function mouseleave() {
    mouseDown = false;
    //scope.setMode(scope.modes.MOVE);
  }

  this.reset = function() {
    scope.resizeView();
    scope.setMode(scope.modes.MOVE);
    resetOrigin();
    view.draw();
  }

  this.resizeView = function() {
    view.handleWindowResize();
  }

  this.setMode = function(mode) {
    scope.lastNode = null;
    scope.mode = mode;
    scope.modeResetCallbacks.fire(mode);
    updateTarget();
  }

  function resetOrigin() {
    // sets the origin so that floorplan is centered
    var canvasSel = $("#"+canvas);
    var centerX = canvasSel.innerWidth() / 2.0;
    var centerY = canvasSel.innerHeight() / 2.0;
    var centerFloorplan = floorplan.getCenter();
    scope.originX = centerFloorplan.x * pixelsPerCm - centerX;
    scope.originY = centerFloorplan.z * pixelsPerCm - centerY;
  }

  this.convertX = function(x) {
    // convert from THREEjs coords to canvas coords
    return (x - scope.originX * cmPerPixel) * pixelsPerCm;
  }

  this.convertY = function(y) {
    // convert from THREEjs coords to canvas coords
    return (y - scope.originY * cmPerPixel) * pixelsPerCm;
  }

  init();
}

module.exports = Floorplanner;
