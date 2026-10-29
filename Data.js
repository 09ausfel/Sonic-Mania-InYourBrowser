var Module = typeof Module != 'undefined' ? Module : {};

if (!Module['expectedDataFileDownloads']) Module['expectedDataFileDownloads'] = 0;
Module['expectedDataFileDownloads']++;
(() => {
  var isPthread = typeof ENVIRONMENT_IS_PTHREAD != 'undefined' && ENVIRONMENT_IS_PTHREAD;
  var isWasmWorker = typeof ENVIRONMENT_IS_WASM_WORKER != 'undefined' && ENVIRONMENT_IS_WASM_WORKER;
  if (isPthread || isWasmWorker) return;
  var isNode = globalThis.process && globalThis.process.versions && globalThis.process.versions.node && globalThis.process.type != 'renderer';
  var connection = globalThis.navigator && (globalThis.navigator.connection || globalThis.navigator.mozConnection || globalThis.navigator.webkitConnection);
  var isSlowConnection = !!(connection && (connection.saveData || /2g|slow-2g/.test(connection.effectiveType || '')));
  var MAX_CONCURRENT = isSlowConnection ? 1 : 2;

  async function loadPackage(metadata) {
    var PACKAGE_NAME = 'Data.data';
    var NUM_PARTS = 14;
    var BASE_URL = 'https://cdn.jsdelivr.net/gh/UGBONTOP/Sonic-Mania-InYourBrowser@main/';

    async function fetchPart(partIndex) {
      var partName = `Data.data.part${partIndex}`;
      var url = BASE_URL + partName;

      if (isNode) {
        var contents = require('fs').readFileSync(partName);
        return new Uint8Array(contents);
      }

      Module['setStatus'] && Module['setStatus'](`Downloading part ${partIndex + 1}/${NUM_PARTS}...`);

      try {
        var response = await fetch(url, {
          cache: 'force-cache',
          headers: {
            'Cache-Control': 'max-age=31536000, immutable'
          }
        });
        if (!response.ok) {
          throw new Error(`${response.status}: ${response.url}`);
        }

        return new Uint8Array(await response.arrayBuffer());
      } catch (e) {
        throw new Error(`Network Error: ${url}`, { cause: e });
      }
    }

    async function fetchAndAssemble() {
      const parts = [];
      const totalBatches = Math.ceil(NUM_PARTS / MAX_CONCURRENT);

      if (isSlowConnection) {
        Module['setStatus'] && Module['setStatus']('Slow connection detected — using low-bandwidth download mode...');
      }

      for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
        const batchStart = batchIndex * MAX_CONCURRENT;
        const batchEnd = Math.min(batchStart + MAX_CONCURRENT, NUM_PARTS);
        const batch = [];

        for (let i = batchStart; i < batchEnd; i++) {
          batch.push(fetchPart(i));
        }

        const batchResults = await Promise.all(batch);
        parts.push(...batchResults);
      }

      const totalSize = parts.reduce((a, p) => a + p.length, 0);
      const assembled = new Uint8Array(totalSize);
      let offset = 0;
      for (const part of parts) {
        assembled.set(part, offset);
        offset += part.length;
      }

      Module['setStatus'] && Module['setStatus']('Assembling Data.data...');
      return assembled.buffer;
    }

    async function runWithFS(Module) {
      function assert(check, msg) {
        if (!check) throw new Error(msg);
      }

      for (var file of metadata['files']) {
        Module['addRunDependency'](`fp ${file['filename']}`);
      }

      async function processPackageData(arrayBuffer) {
        assert(arrayBuffer, 'Loading data file failed.');
        assert(arrayBuffer.constructor.name === ArrayBuffer.name, 'bad input to processPackageData ' + arrayBuffer.constructor.name);
        var byteArray = new Uint8Array(arrayBuffer);
        for (var file of metadata['files']) {
          var name = file['filename'];
          var data = byteArray.subarray(file['start'], file['end']);
          Module['FS_createDataFile'](name, null, data, true, true, true);
          Module['removeRunDependency'](`fp ${name}`);
        }
        Module['removeRunDependency']('datafile_Data.data');
      }

      Module['addRunDependency']('datafile_Data.data');
      if (!Module['preloadResults']) Module['preloadResults'] = {};
      Module['preloadResults'][PACKAGE_NAME] = { fromCache: false };

      const assembled = await fetchAndAssemble();
      processPackageData(assembled);
    }

    if (Module['calledRun']) {
      runWithFS(Module);
    } else {
      if (!Module['preRun']) Module['preRun'] = [];
      Module['preRun'].push(runWithFS);
    }
  }

  loadPackage({
    "files": [{ "filename": "/Data.rsdk", "start": 0, "end": 208368695 }],
    "remote_package_size": 208368695
  });
})();
