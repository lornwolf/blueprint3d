var THREE = require('three');
var utils = require('../utils/utils')

/**
 * model    :
 * metadata :
 * geometry :
 * material :
 * position :
 * rotation :
 * scale    :
 */
var Item = function(model, metadata, geometry, material, position, rotation, scale) {

    // this.three = three;
    // this.model = three.getModel();
    // this.scene = three.getScene();
    // this.controller = three.getController();
    this.model = model;
    this.scene = model.scene;

    this.errorGlow = new THREE.Mesh();

    this.hover = false;
    this.selected = false;
    this.highlighted = false;
    this.error = false;
    this.emissiveColor = 0x444444;
    this.errorColor = 0xff0000;

    this.metadata = metadata;
    this.resizable = metadata.resizable;

    // 继承THREE.Mesh的属性。
    THREE.Mesh.call(this, geometry, material);

    this.castShadow = true;
    this.receiveShadow = false;

    // 本物体是否影响其它「地板物体」。
    this.obstructFloorMoves = true;

    // 移动物体到指定位置。
    if (position) {
        this.position.copy(position);        
        this.position_set = true;
    } else {
        this.position_set = false;
    }

    // show rotate option in context menu
    this.allowRotate = true;
    this.fixed = false;

    // 鼠标点中的位置与物体原点的偏移
    this.dragOffset = new THREE.Vector3();

    // center in its boundingbox
    // 重新计算当前几何体对象的立方体界限（boundingBox属性）
    this.geometry.computeBoundingBox();
    // Matrix4.makeTranslation()方法根据x,、y、z生成平移矩阵，左乘这个矩阵，使物体平移到立方体界限中心。
    this.geometry.applyMatrix( new THREE.Matrix4().makeTranslation(
        - 0.5 * ( this.geometry.boundingBox.max.x + this.geometry.boundingBox.min.x ),
        - 0.5 * ( this.geometry.boundingBox.max.y + this.geometry.boundingBox.min.y ),
        - 0.5 * ( this.geometry.boundingBox.max.z + this.geometry.boundingBox.min.z )
    ) );
    this.geometry.computeBoundingBox();
    this.halfSize = this.objectHalfSize();

    // 按指定角度旋转物体，只能沿y轴旋转。
    if (rotation) {
        this.rotation.y = rotation;
    }

    if (scale != null) {
        this.setScale(scale.x, scale.y, scale.z);
    }
};

Item.prototype = Object.create(THREE.Mesh.prototype);

Item.prototype.remove = function() {
    this.scene.removeItem(this);
};

// 改变物体大小
Item.prototype.resize = function(height, width, depth) {
    var x = width / this.getWidth();
    var y = height / this.getHeight();
    var z = depth / this.getDepth();
    this.setScale(x, y, z);
}

// 设置刻度
Item.prototype.setScale = function(x, y, z) {
    var scaleVec = new THREE.Vector3(x, y, z);
    this.halfSize.multiply(scaleVec);
    scaleVec.multiply(this.scale)
    this.scale.set(scaleVec.x, scaleVec.y, scaleVec.z);
    this.resized();
    this.scene.needsUpdate = true;
};

Item.prototype.setFixed = function(fixed) {
    this.fixed = fixed;
}

Item.prototype.resized = function() {
    // subclass can define to take action after a resize
}

Item.prototype.getHeight = function() {
    return this.halfSize.y * 2.0;
}

Item.prototype.getWidth = function() {
    return this.halfSize.x * 2.0;
}

Item.prototype.getDepth = function() {
    return this.halfSize.z * 2.0;
}

Item.prototype.placeInRoom = function() {
    // handle in sub class
};

Item.prototype.initObject = function() {
    this.placeInRoom();    
    // select and stuff
    this.scene.needsUpdate = true;
};

Item.prototype.removed = function() {
    // implement in subclass
}

// 设置或取消高亮显示（让物体发白光）
Item.prototype.updateHighlight = function() {
    var on = this.hover || this.selected;
    this.highlighted = on;
    var hex = on ? this.emissiveColor : 0x000000;
    utils.forEach(this.material.materials, function(material) {
        material.emissive.setHex(hex);
    });
}

Item.prototype.mouseOver = function() {
    this.hover = true;
    this.updateHighlight();
};

Item.prototype.mouseOff = function() {
    this.hover = false;
    this.updateHighlight();
};

Item.prototype.setSelected = function() {
    this.selected = true;
    this.updateHighlight();
};

Item.prototype.setUnselected = function() {
    this.selected = false;
    this.updateHighlight();
};

// intersection has attributes point (vec3) and object (THREE.Mesh)
// 鼠标压下时，计算鼠标点中的位置与物体原点的偏移
Item.prototype.clickPressed = function(intersection) {
    this.dragOffset.copy(intersection.point).sub(this.position);
};

// 鼠标拖拽时移动物体
Item.prototype.clickDragged = function(intersection) {
    if (intersection) {
        this.moveToPosition(
            intersection.point.sub(this.dragOffset), 
            intersection);
    }
};

// 旋转物体
// 计算原点到鼠标位置的直线与y轴的夹角，既是物体应旋转（沿y轴）的角度
Item.prototype.rotate = function(intersection) {
    if (intersection) {
        var angle = utils.angle(
            0, 
            1, 
            intersection.point.x - this.position.x, 
            intersection.point.z - this.position.z);

        // 容差(Snap Tolerance)???
        var snapTolerance = Math.PI / 16.0;

        // snap to intervals near Math.PI/2
        for (var i=-4; i <= 4; i++) {
            if ( Math.abs( angle - ( i * ( Math.PI / 2 ) ) ) < snapTolerance ) {
                angle = i * ( Math.PI / 2 );
                break;
            }
        }
        this.rotation.y = angle;
    }
}

Item.prototype.moveToPosition = function(vec3, intersection) {
    this.position.copy(vec3);
}

Item.prototype.clickReleased = function() {
    if (this.error) {
        this.hideError();
    }
};

// Returns an array of planes to use other than the ground plane
// for passing intersection to clickPressed and clickDragged
Item.prototype.customIntersectionPlanes = function() {
    return [];
}

// returns the 2d corners of the bounding polygon
// offset is Vector3 (used for getting corners of object at a new position)
// 返回一个物体所占面积的四个角的坐标（二维）
Item.prototype.getCorners = function(xDim, yDim, position) {
    position = position || this.position;

    var halfSize = this.halfSize.clone();

    var c1 = new THREE.Vector3(-halfSize.x, 0, -halfSize.z);
    var c2 = new THREE.Vector3(halfSize.x, 0, -halfSize.z);
    var c3 = new THREE.Vector3(halfSize.x, 0, halfSize.z);
    var c4 = new THREE.Vector3(-halfSize.x, 0, halfSize.z);

    var transform = new THREE.Matrix4();
    // console.log(this.rotation.y);
    transform.makeRotationY(this.rotation.y); //  + Math.PI/2)

    c1.applyMatrix4(transform);
    c2.applyMatrix4(transform);
    c3.applyMatrix4(transform);
    c4.applyMatrix4(transform);

    c1.add(position);
    c2.add(position);
    c3.add(position);
    c4.add(position);

    // halfSize.applyMatrix4(transform);
    // var min = position.clone().sub(halfSize);
    // var max = position.clone().add(halfSize);

    var corners = [
        {x: c1.x, y: c1.z},
        {x: c2.x, y: c2.z},
        {x: c3.x, y: c3.z},
        {x: c4.x, y: c4.z}
    ];

    return corners;
}

Item.prototype.isValidPosition = function( vec3 ) {
    // implement in subclass
}

Item.prototype.showError = function(vec3) {
    vec3 = vec3 || this.position;
    if (!this.error) {
        this.error = true;
        this.errorGlow = this.createGlow(this.errorColor, 0.8, true);
        this.scene.add(this.errorGlow);
    }
    this.errorGlow.position.copy(vec3);
}

Item.prototype.hideError = function() {
    if ( this.error) {
        this.error = false;
        this.scene.remove( this.errorGlow );
    }
}

// 获得物体大小的一半
Item.prototype.objectHalfSize = function() {
    var objectBox = new THREE.Box3();
    objectBox.setFromObject( this );
    return objectBox.max.clone().sub( objectBox.min ).divideScalar( 2 );
}

// 鼠标经过或拖动时，用来让物体发光的方法
// color : 颜色；opacity : 不透明性
Item.prototype.createGlow = function( color, opacity, ignoreDepth ) {
    ignoreDepth = ignoreDepth || false
    opacity = opacity || 0.2;
    var glowMaterial = new THREE.MeshBasicMaterial ({
        color: color,
        blending: THREE.AdditiveBlending,
        opacity: 0.2,
        transparent: true,
        depthTest: !ignoreDepth
    });

    var glow = new THREE.Mesh(this.geometry.clone(), glowMaterial);
    glow.position.copy(this.position);
    glow.rotation.copy(this.rotation);
    glow.scale.copy(this.scale);
    return glow;
};

module.exports = Item;
