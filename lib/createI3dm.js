'use strict';
const Cesium = require('cesium');

const getJsonBufferPadded = require('./getJsonBufferPadded8Byte');
const getBufferPadded = require('./getBufferPadded8Byte');

const defined = Cesium.defined;

module.exports = createI3dm;


/**
 * 
 * @param {Object} options An object contains following properties:
 * @param {Object} options.featureTableJson The feature table JSON.
 * @param {Buffer} options.featureTableBinary The feature table binary.
 * @param {Object} [options.batchTableJson] Batch table JSON.
 * @param {Buffer} [options.batchTableBianry] The batch table binary.
 * @param {Buffer} [options.glb] The binary glTF buffer.
 * @param {String} [options.url] Url to an external glTF model when options.glb is not specified.
 * @returns {Buffer} I3dm buffer.
 */
function createI3dm(options) {
    const featureTableJson = getJsonBufferPadded(options.featureTableJson);
    const featureTableBinary = getBufferPadded(options.featureTableBinary);
    const batchTableJson = getJsonBufferPadded(options.batchTableJson);
    const batchTableBianry = getBufferPadded(options.batchTableBianry);

    const gltfFormat = defined(options.glb) ? 1 : 0;
    const gltfBuffer = defined(options.glb) ? options.glb : getGltfUrlBuffer(options.url);

    const verison = 1;
    const headerByteLength = 32;
    const featureTableJsonByteLength = featureTableJson.length;
    const featureTableBinaryByteLength = featureTableBinary.length;
    const batchTableJsonByteLength = batchTableJson.length;
    const batchTableBianryByteLength = batchTableBianry.length;
    const gltfByteLength = gltfBuffer.length;
    const byteLength = headerByteLength + featureTableJsonByteLength + featureTableBinaryByteLength + batchTableJsonByteLength + batchTableBianryByteLength + gltfByteLength;

    const header = Buffer.alloc(headerByteLength);
    header.write('i3dm', 0);
    header.writeUInt32LE(verison, 4);
    header.writeUInt32LE(byteLength, 8);
    header.writeUInt32LE(featureTableJsonByteLength, 12);
    header.writeUInt32LE(featureTableBinaryByteLength, 16);
    header.writeUInt32LE(batchTableJsonByteLength, 20);
    header.writeUInt32LE(batchTableBianryByteLength, 24);
    header.writeUInt32LE(gltfFormat, 28);

    return Buffer.concat([header, featureTableJson, featureTableBinary, batchTableJson, batchTableBianry, gltfBuffer]);
}

function getGltfUrlBuffer(url) {
    url = url.replace(/\\/g, '/');
    return Buffer.from(url);
}
