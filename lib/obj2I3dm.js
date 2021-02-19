'use strict';

const Cesium = require('cesium');

const createI3dm = require('./createI3dm');
const obj2gltf = require('./obj2gltf');
const defaultValue = Cesium.defaultValue;
const Cartesian3 = Cesium.Cartesian3;
const Matrix3 = Cesium.Matrix3;
const CMath = Cesium.Math;

module.exports = obj2I3dm;

const sizeOfUint8 = 1;
const sizeOfUint16 = 2;
const sizeOfUint32 = 4;
const sizeOfFloat32 = 4;

/**
 * Convert obj file to i3dm with custon FeatureTable and BatchTable.
 * 
 * @param {String} objPath The obj file path. 
 * @param {Object} options Optional parameters.
 */
function obj2I3dm(objPath, options){
    return obj2gltf(objPath, options)
        .then(function(result) {
            const glb = result.gltf;
            const defaultBatchTable = result.batchTableJson;
            const featureTable = defaultValue(options.customFeatureTable, undefined);
            const featureTableJson = {};
            let featureTableBinary;
            const batchTableJson = defaultValue(options.customBatchTable, undefined);

            return new Promise(function(resolve, reject) {
                if (featureTable.position && Array.isArray(featureTable.position)) {
                    const position = featureTable.position;
                    const length = position.length;
                    featureTableJson.INSTANCES_LENGTH = position.length;
                    let attributes = [];
                    attributes.push(getPositions(position));
                    attributes.push(getBatchIds(position.length));
                    if (featureTable.orientation) {
                        if (featureTable.orientation.length !== length) {
                            if (featureTable.orientation.length > length) {
                                featureTable.orientation = featureTable.orientation.slice(0, length);
                                console.log('FeatureTable Array length inconsistent. \'orientation\' and \'position\' have different length.');
                            } else {
                                reject('FeatureTable Array length inconsistent. \'orientation\' and \'position\' have different length.');
                            }
                        }
                        attributes = attributes.concat(getOrientations(featureTable.orientation));
                    }
                    if (featureTable.scale) {
                        if (featureTable.scale.length !== length) {
                            if (featureTable.scale.length > length) {
                                featureTable.scale = featureTable.scale.slice(0, length);
                                console.log('FeatureTable Array length inconsistent. \'scale\' and \'position\' have different length.');
                            } else {
                                reject('FeatureTable Array length inconsistent. \'scale\' and \'position\' have different length.');
                            }
                        }
                        attributes.push(getScales(featureTable.scale));
                    }

                    let i;
                    let attribute;
                    let byteOffset = 0;
                    const attributesLength = attributes.length;
                    for(i = 0; i < attributesLength; i++) {
                        attribute = attributes[i];
                        const byteAlignment = attribute.byteAlignment;
                        byteOffset = Math.ceil(byteOffset / byteAlignment) * byteAlignment;
                        attribute.byteOffset = byteOffset;
                        byteOffset += attribute.buffer.length;
                    }

                    featureTableBinary = Buffer.alloc(byteOffset);

                    for (i = 0; i < attributesLength; i ++) {
                        attribute = attributes[i];
                        featureTableJson[attribute.propertyName] = {
                            byteOffset : attribute.byteOffset,
                            componentType: attribute.componentType
                        };
                        attribute.buffer.copy(featureTableBinary, attribute.byteOffset);
                    }

                    const i3dm = createI3dm({
                        featureTableJson: featureTableJson,
                        featureTableBinary: featureTableBinary,
                        batchTableJson: batchTableJson,
                        glb: glb
                    });

                    resolve({
                        i3dm : i3dm,
                        batchTableJson: defaultBatchTable
                    });
                }
                reject('Invalued FeatureTable.');
            });


            function getPositions(instancePositions) {
                const instanceLength = instancePositions.length;
                const buffer = Buffer.alloc(instanceLength * 3 * sizeOfFloat32);

                for(let i = 0; i < instanceLength; i ++) {
                    const position = instancePositions[i];
                    buffer.writeFloatLE(position[0], (i * 3) * sizeOfFloat32);
                    buffer.writeFloatLE(position[1], (i * 3 + 1) * sizeOfFloat32);
                    buffer.writeFloatLE(position[2], (i * 3 + 2) * sizeOfFloat32);
                }

                return {
                    buffer : buffer,
                    propertyName: 'POSITION',
                    byteAlignment: sizeOfFloat32
                };
            }

            function getBatchIds(instancesLength) {
                let i;
                let buffer;
                let componentType;
                let byteAlignment;

                if (instancesLength < 256) {
                    buffer = Buffer.alloc(instancesLength * sizeOfUint8);
                    for (i = 0; i < instancesLength; ++i) {
                        buffer.writeUInt8(i, i * sizeOfUint8);
                    }
                    componentType = 'UNSIGNED_BYTE';
                    byteAlignment = sizeOfUint8;
                } else if (instancesLength < 65536) {
                    buffer = Buffer.alloc(instancesLength * sizeOfUint16);
                    for (i = 0; i < instancesLength; ++i) {
                        buffer.writeUInt16LE(i, i * sizeOfUint16);
                    }
                    componentType = 'UNSIGNED_SHORT';
                    byteAlignment = sizeOfUint16;
                } else {
                    buffer = Buffer.alloc(instancesLength * sizeOfUint32);
                    for (i = 0; i < instancesLength; ++i) {
                        buffer.writeUInt32LE(i, i * sizeOfUint32);
                    }
                    componentType = 'UNSIGNED_INT';
                    byteAlignment = sizeOfUint32;
                }

                return {
                    buffer : buffer,
                    componentType : componentType,
                    propertyName : 'BATCH_ID',
                    byteAlignment : byteAlignment
                };
            }

            function getOrientations(orientations) {
                const length = orientations.length;
                const normalsUpBuffer = Buffer.alloc(length * 3 * sizeOfFloat32);
                const normalsRightBuffer = Buffer.alloc(length * 3 * sizeOfFloat32);

                for(let i = 0; i < length; i ++) {
                    const rotate = orientations[i];
                    let up = new Cartesian3(0, 1, 0);
                    let right = new Cartesian3(1, 0, 0);
                    let m = Matrix3.fromRotationZ(CMath.toRadians(rotate[2]));
                    up = Matrix3.multiplyByVector(m, up, new Cartesian3());
                    right = Matrix3.multiplyByVector(m, right, new Cartesian3());
                    m = Matrix3.fromRotationX(CMath.toRadians(rotate[0]));
                    up = Matrix3.multiplyByVector(m, up, new Cartesian3());
                    right = Matrix3.multiplyByVector(m, right, new Cartesian3());
                    m = Matrix3.fromRotationY(CMath.toRadians(rotate[1]));
                    up = Matrix3.multiplyByVector(m, up, new Cartesian3());
                    right = Matrix3.multiplyByVector(m, right, new Cartesian3());
                    up = Cartesian3.normalize(up, up);
                    right = Cartesian3.normalize(right, right);

                    normalsUpBuffer.writeFloatLE(up.x, (i * 3) * sizeOfFloat32);
                    normalsUpBuffer.writeFloatLE(up.y, (i * 3 + 1) * sizeOfFloat32);
                    normalsUpBuffer.writeFloatLE(up.z, (i * 3 + 2) * sizeOfFloat32);

                    normalsRightBuffer.writeFloatLE(right.x, (i * 3) * sizeOfFloat32);
                    normalsRightBuffer.writeFloatLE(right.y, (i * 3 + 1) * sizeOfFloat32);
                    normalsRightBuffer.writeFloatLE(right.z, (i * 3 + 2) * sizeOfFloat32);
                }

                return [
                    {
                        buffer : normalsUpBuffer,
                        propertyName : 'NORMAL_UP',
                        byteAlignment : sizeOfFloat32
                    },
                    {
                        buffer : normalsRightBuffer,
                        propertyName : 'NORMAL_RIGHT',
                        byteAlignment : sizeOfFloat32
                    }
                ];
            }

            function getScales(scale) {
                const length = scale.length;
                const buffer = Buffer.alloc(length * 3 * sizeOfFloat32);
                for(let i = 0; i < length; i++) {
                    const s = scale[i];
                    buffer.writeFloatLE(s[0], (i * 3) * sizeOfFloat32);
                    buffer.writeFloatLE(s[1], (i * 3 + 1) * sizeOfFloat32);
                    buffer.writeFloatLE(s[2], (i * 3 + 2) * sizeOfFloat32);
                }

                return {
                    buffer : buffer,
                    propertyName : 'SCALE_NON_UNIFORM',
                    byteAlignment : sizeOfFloat32
                };
            }
        });
}

obj2I3dm.defaults = {
    /**
     * Gets or sets whether create i3dm model file, with custom FeatureTable and BatchTable.
     * @type Boolean
     * @default false
     */
    i3dm: false,
    /**
     * Sets the default FeatureTable json file or object.
     * @type Object
     * @default undefined
     */
    customFeatureTable: undefined,
    /**
     * Sets the default BatchTable json file or object.
     * @type Object
     * @default undefined
     */
    customBatchTable: undefined
};
