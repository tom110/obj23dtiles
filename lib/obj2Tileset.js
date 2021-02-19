'use strict';
const path = require('path');
const Cesium = require('cesium');
const createSingleTileset = require('./createSingleTileset');
const tilesetOptionsUtility = require('./tilesetOptionsUtility');
const obj2B3dm = require('./obj2B3dm');
const obj2I3dm = require('./obj2I3dm');
const Cartesian3 = Cesium.Cartesian3;
const Matrix3 = Cesium.Matrix3;
const CMath = Cesium.Math;

const defaultValue = Cesium.defaultValue;
const getPoint3MinMax = tilesetOptionsUtility.getPoint3MinMax;

module.exports = obj2Tileset;

function obj2Tileset(objPath, outputpath, options) {
    const folder = path.dirname(outputpath);
    const tileFullName = path.basename(outputpath);
    const folderPrifix = options.b3dm ? 'Batched' : 'Instanced';
    const tilesetFolderName = folderPrifix + path.basename(objPath, '.obj');
    const tilePath = path.join(folder, tilesetFolderName, tileFullName);
    const tilesetPath = path.join(folder, tilesetFolderName, 'tileset.json');
    const tilesetOptions = options.tilesetOptions || {};
    if (options.b3dm) {
        return obj2B3dm(objPath, options)
            .then(function(result){
                const batchTableJson = result.batchTableJson;
                const minmaxPoint = getPoint3MinMax(batchTableJson.minPoint.concat(batchTableJson.maxPoint));
                let width = minmaxPoint.max[0] - minmaxPoint.min[0];
                let height = minmaxPoint.max[2] - minmaxPoint.min[2];
                width = Math.ceil(width);
                height = Math.ceil(height);
                const offsetX = width / 2 + minmaxPoint.min[0];
                const offsetY = height / 2 + minmaxPoint.min[2];
                return new Promise(function(resolve) {
                    tilesetOptions.tileName = tileFullName;
                    tilesetOptions.tileWidth = defaultValue(tilesetOptions.tileWidth, width);
                    tilesetOptions.tileHeight = defaultValue(tilesetOptions.tileHeight, height);
                    tilesetOptions.transHeight = defaultValue(tilesetOptions.transHeight, -minmaxPoint.min[1]);
                    tilesetOptions.minHeight = defaultValue(tilesetOptions.minHeight, minmaxPoint.min[1] + tilesetOptions.transHeight);
                    tilesetOptions.maxHeight = defaultValue(tilesetOptions.maxHeight, minmaxPoint.max[1] + tilesetOptions.transHeight);
                    tilesetOptions.offsetX = defaultValue(tilesetOptions.offsetX, offsetX);
                    tilesetOptions.offsetY = defaultValue(tilesetOptions.offsetY, offsetY);
                    return resolve({
                        b3dm : result.b3dm,
                        batchTableJson: result.batchTableJson,
                        tilesetJson : createSingleTileset(tilesetOptions),
                        tilePath : tilePath,
                        tilesetPath : tilesetPath
                    });
                });
            });
    } else if (options.i3dm) {
        return obj2I3dm(objPath, options)
            .then(function(result) {
                const batchTableJson = result.batchTableJson;
                let minmaxPoint = getPoint3MinMax(batchTableJson.minPoint.concat(batchTableJson.maxPoint));
                minmaxPoint.min = [minmaxPoint.min[0], minmaxPoint.min[2], minmaxPoint.min[1]];
                minmaxPoint.max = [minmaxPoint.max[0], minmaxPoint.max[2], minmaxPoint.max[1]];
                const featureTable = options.customFeatureTable;
                const tempPoints = [];
                let i;
                let j;
                const position = featureTable.position;
                const length = position.length;
                for (i = 0; i < length; i ++) {
                    tempPoints.push([minmaxPoint.min[0] + position[i][0], minmaxPoint.min[1] + position[i][1], minmaxPoint.min[2] + position[i][2]]);
                    tempPoints.push([minmaxPoint.min[0] + position[i][0], minmaxPoint.max[1] + position[i][1], minmaxPoint.min[2] + position[i][2]]);
                    tempPoints.push([minmaxPoint.max[0] + position[i][0], minmaxPoint.min[1] + position[i][1], minmaxPoint.min[2] + position[i][2]]);
                    tempPoints.push([minmaxPoint.max[0] + position[i][0], minmaxPoint.max[1] + position[i][1], minmaxPoint.min[2] + position[i][2]]);

                    tempPoints.push([minmaxPoint.max[0] + position[i][0], minmaxPoint.max[1] + position[i][1], minmaxPoint.max[2] + position[i][2]]);
                    tempPoints.push([minmaxPoint.max[0] + position[i][0], minmaxPoint.min[1] + position[i][1], minmaxPoint.max[2] + position[i][2]]);
                    tempPoints.push([minmaxPoint.min[0] + position[i][0], minmaxPoint.max[1] + position[i][1], minmaxPoint.max[2] + position[i][2]]);
                    tempPoints.push([minmaxPoint.min[0] + position[i][0], minmaxPoint.min[1] + position[i][1], minmaxPoint.max[2] + position[i][2]]);
                }
                if (featureTable.scale) {
                    const scale = featureTable.scale;
                    for (i = 0; i < length; i ++) {
                        for (j = 0; j < 8; j ++) {
                            tempPoints[i * 8 + j] = [tempPoints[i * 8 + j][0] * scale[i][0], tempPoints[i * 8 + j][1] * scale[i][1], tempPoints[i * 8 + j][2] * scale[i][2]];
                        }
                    }
                }
                if (featureTable.orientation) {
                    const orientation = featureTable.orientation;
                    const ps = new Array(8);
                    let m;
                    let rotate;
                    for (i = 0; i < length; i ++) {
                        rotate = orientation[i];
                        for (j = 0; j < 8; j ++) {
                            ps[j] = new Cartesian3(tempPoints[i * 8 + j][0], tempPoints[i * 8 + j][1], tempPoints[i * 8 + j][2]);
                        }
                        m = Matrix3.fromRotationZ(CMath.toRadians(rotate[2]));
                        for (j = 0; j < 8; j ++) {
                            ps[j] = Matrix3.multiplyByVector(m, ps[j], new Cartesian3());
                        }
                        m = Matrix3.fromRotationX(-CMath.toRadians(rotate[0]));
                        for (j = 0; j < 8; j ++) {
                            ps[j] = Matrix3.multiplyByVector(m, ps[j], new Cartesian3());
                        }
                        m = Matrix3.fromRotationY(CMath.toRadians(rotate[1]));
                        for (j = 0; j < 8; j ++) {
                            ps[j] = Matrix3.multiplyByVector(m, ps[j], new Cartesian3());
                        }
                        for (j = 0; j < 8; j ++) {
                            tempPoints[i * 8 + j] = [ps[j].x, ps[j].y, ps[j].z];
                        }
                    }
                }

                minmaxPoint = getPoint3MinMax(tempPoints);
                let width = minmaxPoint.max[0] - minmaxPoint.min[0];
                let height = minmaxPoint.max[1] - minmaxPoint.min[1];
                width = Math.ceil(width);
                height = Math.ceil(height);
                const offsetX = width / 2 + minmaxPoint.min[0];
                const offsetY = height / 2 + minmaxPoint.min[1];

                return new Promise(function(resolve) {
                    tilesetOptions.tileName = tileFullName;
                    tilesetOptions.tileWidth = defaultValue(tilesetOptions.tileWidth, width);
                    tilesetOptions.tileHeight = defaultValue(tilesetOptions.tileHeight, height);
                    tilesetOptions.transHeight = defaultValue(tilesetOptions.transHeight, -minmaxPoint.min[2]);
                    tilesetOptions.minHeight = defaultValue(tilesetOptions.minHeight, minmaxPoint.min[2] + tilesetOptions.transHeight);
                    tilesetOptions.maxHeight = defaultValue(tilesetOptions.maxHeight, minmaxPoint.max[2] + tilesetOptions.transHeight);
                    tilesetOptions.offsetX = defaultValue(tilesetOptions.offsetX, offsetX);
                    tilesetOptions.offsetY = defaultValue(tilesetOptions.offsetY, offsetY);
                    return resolve({
                        i3dm : result.i3dm,
                        batchTableJson: result.batchTableJson,
                        tilesetJson : createSingleTileset(tilesetOptions),
                        tilePath : tilePath,
                        tilesetPath : tilesetPath
                    });
                });
            });
        }
}

/**
 * Default pramaters used in this moudle.
 */
obj2Tileset.defaults = {
    /**
     * Gets or set whether create a tileset.
     * @type Boolean
     * @default false
     */
    tileset: false,
    /**
     * Gets or set the tileset optional parameters.
     * @type Object
     * @default undefined
     */
    tilesetOptions: undefined
};
