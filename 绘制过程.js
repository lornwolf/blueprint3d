floorplanner.js

鼠标左键释放事件处理函数中：
// 在floorplan对象中新生成一个Corner对象
var corner = floorplan.newCorner(scope.targetX, scope.targetY);
// 在floorplan对象中新生成一个Wall对象
floorplan.newWall(scope.lastNode, corner); 
 
floorplan.js
this.newWall = function(start, end) {
  var wall = new Wall(start, end);
  walls.push(wall)
  wall.fireOnDelete(removeWall);
  new_wall_callbacks.fire(wall);
  scope.update();
  return wall;
}

this.update = function() {
  utils.forEach(walls, function(wall) {
    wall.resetFrontBack(); // 把frontEdge和backEdge都设置成null
  });
  // 创建房间
  var roomCorners = findRooms(corners);
  rooms = [];
  utils.forEach(roomCorners, function(corners) {
    rooms.push(new Room(scope, corners));
  });
  // 处理单独的墙面
  assignOrphanEdges();
  updateFloorTextures();
  updated_rooms.fire(); --> 该处调用ThreeFloorplan的redraw()方法，重新绘制房间的三维图
}
 
Room.js
updateWalls();
updateInteriorCorners();
generatePlane();

// 生成一个首尾相连的HalfEdge对象链表。
function updateWalls() {
  var prevEdge = null;
  var firstEdge = null;
 
  for (i = 0; i < corners.length; i++) {
    var firstCorner = corners[i];
    var secondCorner = corners[(i + 1) % corners.length];

    // find if wall is heading in that direction
    // 如果两个点之间有墙
    var wallTo = firstCorner.wallTo(secondCorner);
    var wallFrom = firstCorner.wallFrom(secondCorner);
 
    if (wallTo) {
      var edge = new HalfEdge(scope, wallTo, true);
    } else if (wallFrom) {
      var edge = new HalfEdge(scope, wallFrom, false);
    } else {
      console.log("corners arent connected by a wall, uh oh");
    }
 
    if (i == 0) {
      firstEdge = edge;
    }  else {
      edge.prev = prevEdge;
      prevEdge.next = edge;
      if (i + 1 == corners.length) {
        firstEdge.prev = edge;
        edge.next = firstEdge;
      }
    }
    prevEdge = edge;
  }
  scope.edgePointer = firstEdge;
}

// 初始化内墙角（把厚度计算在内）数组
function updateInteriorCorners() {
  var edge = scope.edgePointer;
  while (true) {
    scope.interiorCorners.push(edge.interiorStart());
    edge.generatePlane();
    if (edge.next === scope.edgePointer) {
      break;
    } else {
      edge = edge.next;
    }
  }
}
 
// 生成房间地面的三维对象
function generatePlane() {
  var points = [];
  utils.forEach( scope.interiorCorners, function(corner) {
      points.push(new THREE.Vector2(corner.x, corner.y));
  });
  var shape = new THREE.Shape(points);
  var geometry = new THREE.ShapeGeometry(shape);
  scope.floorPlane = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({side: THREE.DoubleSide}));
  scope.floorPlane.visible = false;
  scope.floorPlane.rotation.set(Math.PI/2, 0, 0);
  // 给地面三维对象增加一个新属性
  scope.floorPlane.room = scope;
}

 
