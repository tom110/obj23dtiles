'use strict';
const Cesium = require('cesium');
const fsExtra = require('fs-extra');
const path = require('path');

const defaultValue = Cesium.defaultValue;
const defined = Cesium.defined;

module.exports = combineTileset;

/**
 * Combie tileset into one tileset json.
 * 
 * @param {Object} options Object with following properties.
 * @param {String} options.inputDir Input directory include tilesets.
 * @param {String} [options.outputTileset="tileset.json"] Output tileset file path.
 */
function combineTileset(options) {
    let west = Number.POSITIVE_INFINITY;
    let south = Number.POSITIVE_INFINITY;
    let north = Number.NEGATIVE_INFINITY;
    let east = Number.NEGATIVE_INFINITY;
    let minheight = Number.POSITIVE_INFINITY;
    let maxheight = Number.NEGATIVE_INFINITY;
    let inputDir = defaultValue(options.inputDir, './');
    let outputTileset = defaultValue(options.outputDir, path.join(inputDir, 'tileset.json'));

    const geometricError = 500;
    const children = [];
    const promises = [];
    const jsonFiles = [];
    inputDir = path.normalize(inputDir);
    outputTileset = path.normalize(outputTileset);
    const outputDir = path.dirname(outputTileset);

    getJsonFiles(inputDir, jsonFiles);
    jsonFiles.forEach(function(jsonFile) {
        const promise = fsExtra.readJson(jsonFile)
            .then(function(json) {
                if(!json.root) {return Promise.resolve();}
                const boundingVolume = json.root.boundingVolume;
                const geometricError = json.geometricError;
                const refine = json.root.refine;

                if (defined(boundingVolume) && defined(geometricError)) {
                    // Use external tileset instand of b3dm.
                    let url = path.relative(outputDir, jsonFile);
                    url = url.replace(/\\/g, '/');

                    // Only support region for now.
                    if(boundingVolume.region) {
                        west = Math.min(west, boundingVolume.region[0]);
                        south = Math.min(south, boundingVolume.region[1]);
                        east = Math.max(east, boundingVolume.region[2]);
                        north = Math.max(north, boundingVolume.region[3]);
                        minheight = Math.min(minheight, boundingVolume.region[4]);
                        maxheight = Math.max(maxheight, boundingVolume.region[5]);
                    }

                    const child = {
                        'boundingVolume': boundingVolume,
                        'geometricError': geometricError,
                        'refine': refine,
                        'content': {
                            'url': url
                        }
                    };
                    children.push(child);
                }
            })
            .catch(function(err) {
                throw Error(err);
            });

        promises.push(promise);
    });

    return Promise.all(promises).then(function() {
        const tileset = {
            'asset': {
                'version': '0.0',
                'tilesetVersion': '1.0.0-obj23dtiles',
            },
            'geometricError': geometricError,
            'root': {
                'boundingVolume': {
                    'region': [
                        west,
                        south,
                        east,
                        north,
                        minheight,
                        maxheight
                    ]
                },
                'refine': 'ADD',
                'geometricError': geometricError,
                'children': children
            }
        };

        return Promise.resolve({
            tileset: tileset,
            output: outputTileset
        });
    });
}

function getJsonFiles(dir, jsonFiles) {
    const files = fsExtra.readdirSync(dir);
    files.forEach(function (itm) {
        const fullpath = path.join(dir, itm);
        const stat = fsExtra.statSync(fullpath);
        if (stat.isDirectory()) {
            readFileList(fullpath, jsonFiles);
        }
    });
}

function readFileList(dir, jsonFiles) {
    const files = fsExtra.readdirSync(dir);
    files.forEach(function (itm) {
        const fullpath = path.join(dir, itm);
        const stat = fsExtra.statSync(fullpath);
        if (stat.isDirectory()) {
            readFileList(fullpath, jsonFiles);
        } else {
            const ext = path.extname(fullpath);
            if (ext === '.json'){
                jsonFiles.push(fullpath);
            }
        }
    });
}
