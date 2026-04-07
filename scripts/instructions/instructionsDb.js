(function(global) {
  var core = global.InstructionsCore = global.InstructionsCore || {};

  var DB_NAME = 'shift_tracker_instructions_v5';
  var DB_VERSION = 1;
  var STORES = {
    instructions: 'instructions',
    instructionNodes: 'instruction_nodes',
    searchEntities: 'search_entities'
  };

  function openDb() {
    if (!global.indexedDB) return Promise.resolve(null);
    return new Promise(function(resolve) {
      var request = global.indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = function(event) {
        var db = event.target.result;
        if (!db.objectStoreNames.contains(STORES.instructions)) {
          db.createObjectStore(STORES.instructions, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORES.instructionNodes)) {
          var nodeStore = db.createObjectStore(STORES.instructionNodes, { keyPath: 'id' });
          nodeStore.createIndex('instructionId', 'instructionId', { unique: false });
          nodeStore.createIndex('parentId', 'parentId', { unique: false });
        }
        if (!db.objectStoreNames.contains(STORES.searchEntities)) {
          var searchStore = db.createObjectStore(STORES.searchEntities, { keyPath: 'id' });
          searchStore.createIndex('instructionId', 'instructionId', { unique: false });
          searchStore.createIndex('nodeId', 'nodeId', { unique: false });
        }
      };

      request.onsuccess = function() {
        resolve(request.result);
      };
      request.onerror = function() {
        resolve(null);
      };
      request.onblocked = function() {
        resolve(null);
      };
    });
  }

  function withTx(db, stores, mode, handler) {
    return new Promise(function(resolve) {
      var settled = false;
      function done(value) {
        if (settled) return;
        settled = true;
        resolve(value);
      }

      try {
        var tx = db.transaction(stores, mode);
        handler(tx);
        tx.oncomplete = function() {
          done(true);
        };
        tx.onerror = function() {
          done(false);
        };
        tx.onabort = function() {
          done(false);
        };
      } catch (err) {
        done(false);
      }
    });
  }

  function toInstructionRow(instruction, meta) {
    var safe = instruction || {};
    return {
      id: String(safe.id || ''),
      title: String(safe.title || ''),
      shortDescription: String(safe.shortDescription || ''),
      sortOrder: Math.max(0, parseInt(safe.sortOrder, 10) || 0),
      version: String(safe.version || ''),
      sourceUrl: String(safe.sourceUrl || ''),
      updatedAt: String(safe.updatedAt || ''),
      datasetUpdatedAt: String((meta && meta.updatedAt) || ''),
      datasetVersion: String((meta && meta.version) || '')
    };
  }

  function toNodeRows(instructions) {
    var out = [];
    var seen = {};
    for (var i = 0; i < (instructions || []).length; i++) {
      var instruction = instructions[i];
      var nodes = Array.isArray(instruction && instruction.nodes) ? instruction.nodes : [];
      for (var n = 0; n < nodes.length; n++) {
        var node = nodes[n];
        if (!node) continue;
        var baseId = String(node.id || (String(instruction.id || 'instruction') + '-node-' + (n + 1)));
        var id = baseId;
        var seq = 2;
        while (seen[id]) {
          id = baseId + '-' + seq;
          seq += 1;
        }
        seen[id] = 1;
        out.push({
          id: id,
          instructionId: String(node.instructionId || instruction.id || ''),
          parentId: node.parentId === undefined || node.parentId === null ? null : String(node.parentId),
          type: String(node.type || 'section'),
          order: Math.max(0, parseInt(node.order, 10) || 0),
          number: String(node.number || ''),
          title: String(node.title || ''),
          content: String(node.content || ''),
          plainText: String(node.plainText || ''),
          source: node.source && typeof node.source === 'object' ? node.source : {}
        });
      }
    }
    return out;
  }

  function toSearchRows(searchEntities) {
    var out = [];
    var seen = {};
    for (var i = 0; i < (searchEntities || []).length; i++) {
      var entity = searchEntities[i];
      if (!entity) continue;
      var baseId = String(entity.id || (String(entity.instructionId || 'instruction') + '::' + String(entity.nodeId || ('node-' + (i + 1)))));
      var id = baseId;
      var seq = 2;
      while (seen[id]) {
        id = baseId + '-' + seq;
        seq += 1;
      }
      seen[id] = 1;
      out.push({
        id: id,
        instructionId: String(entity.instructionId || ''),
        nodeId: String(entity.nodeId || ''),
        path: String(entity.path || ''),
        type: String(entity.type || 'point'),
        number: String(entity.number || ''),
        title: String(entity.title || ''),
        body: String(entity.body || ''),
        normalizedTitle: String(entity.normalizedTitle || ''),
        normalizedBody: String(entity.normalizedBody || ''),
        tokens: Array.isArray(entity.tokens) ? entity.tokens : [],
        stems: Array.isArray(entity.stems) ? entity.stems : [],
        chargrams: Array.isArray(entity.chargrams) ? entity.chargrams : [],
        instructionTitle: String(entity.instructionTitle || ''),
        nodeType: String(entity.nodeType || ''),
        depth: Math.max(0, parseInt(entity.depth, 10) || 0)
      });
    }
    return out;
  }

  function writeDataset(payload) {
    var data = payload || {};
    var instructions = Array.isArray(data.instructions) ? data.instructions : [];
    var meta = data.meta || {};
    var nodeRows = Array.isArray(data.instructionNodes) ? data.instructionNodes : toNodeRows(instructions);
    var searchRows = toSearchRows(Array.isArray(data.searchEntities) ? data.searchEntities : []);

    return openDb().then(function(db) {
      if (!db) return false;

      return withTx(db, [STORES.instructions, STORES.instructionNodes, STORES.searchEntities], 'readwrite', function(tx) {
        var instructionsStore = tx.objectStore(STORES.instructions);
        var nodesStore = tx.objectStore(STORES.instructionNodes);
        var searchStore = tx.objectStore(STORES.searchEntities);

        instructionsStore.clear();
        nodesStore.clear();
        searchStore.clear();

        for (var i = 0; i < instructions.length; i++) {
          instructionsStore.put(toInstructionRow(instructions[i], meta));
        }
        for (var n = 0; n < nodeRows.length; n++) {
          nodesStore.put(nodeRows[n]);
        }
        for (var s = 0; s < searchRows.length; s++) {
          searchStore.put(searchRows[s]);
        }
      }).finally(function() {
        try { db.close(); } catch (closeErr) {}
      });
    });
  }

  function readDataset() {
    return openDb().then(function(db) {
      if (!db) {
        return {
          meta: {},
          instructions: [],
          instructionNodes: [],
          searchEntities: []
        };
      }

      return new Promise(function(resolve) {
        var finished = false;
        function done(payload) {
          if (finished) return;
          finished = true;
          try { db.close(); } catch (closeErr) {}
          resolve(payload);
        }

        try {
          var tx = db.transaction([STORES.instructions, STORES.instructionNodes, STORES.searchEntities], 'readonly');
          var instructionsReq = tx.objectStore(STORES.instructions).getAll();
          var nodesReq = tx.objectStore(STORES.instructionNodes).getAll();
          var searchReq = tx.objectStore(STORES.searchEntities).getAll();

          tx.oncomplete = function() {
            var instructionRows = Array.isArray(instructionsReq.result) ? instructionsReq.result : [];
            var nodeRows = Array.isArray(nodesReq.result) ? nodesReq.result : [];
            var searchRows = Array.isArray(searchReq.result) ? searchReq.result : [];

            instructionRows.sort(function(a, b) {
              var aOrder = Math.max(0, parseInt(a && a.sortOrder, 10) || 0);
              var bOrder = Math.max(0, parseInt(b && b.sortOrder, 10) || 0);
              if (aOrder !== bOrder) return aOrder - bOrder;
              if ((a.title || '') !== (b.title || '')) {
                return String(a.title || '').localeCompare(String(b.title || ''), 'ru');
              }
              return String(a.id || '').localeCompare(String(b.id || ''), 'ru');
            });

            var nodesByInstruction = {};
            for (var i = 0; i < nodeRows.length; i++) {
              var node = nodeRows[i];
              var instructionId = String(node.instructionId || '');
              if (!nodesByInstruction[instructionId]) nodesByInstruction[instructionId] = [];
              nodesByInstruction[instructionId].push(node);
            }

            var instructionKeys = Object.keys(nodesByInstruction);
            for (var k = 0; k < instructionKeys.length; k++) {
              var key = instructionKeys[k];
              nodesByInstruction[key].sort(function(a, b) {
                var aOrder = parseInt(a.order, 10) || 0;
                var bOrder = parseInt(b.order, 10) || 0;
                if (aOrder !== bOrder) return aOrder - bOrder;
                if ((a.number || '') !== (b.number || '')) {
                  return String(a.number || '').localeCompare(String(b.number || ''), 'ru');
                }
                return String(a.title || '').localeCompare(String(b.title || ''), 'ru');
              });
            }

            var instructions = [];
            for (var r = 0; r < instructionRows.length; r++) {
              var row = instructionRows[r];
              var hasSortOrder = row && row.sortOrder !== undefined && row.sortOrder !== null && String(row.sortOrder) !== '';
              instructions.push({
                id: row.id,
                title: row.title || '',
                shortDescription: row.shortDescription || '',
                sortOrder: hasSortOrder ? Math.max(0, parseInt(row.sortOrder, 10) || 0) : undefined,
                version: row.version || '',
                sourceUrl: row.sourceUrl || '',
                updatedAt: row.updatedAt || '',
                nodes: nodesByInstruction[row.id] || []
              });
            }

            var meta = {};
            if (instructionRows.length) {
              meta.updatedAt = String(instructionRows[0].datasetUpdatedAt || '');
              meta.version = String(instructionRows[0].datasetVersion || '');
            }

            done({
              meta: meta,
              instructions: instructions,
              instructionNodes: nodeRows,
              searchEntities: searchRows
            });
          };

          tx.onerror = function() {
            done({
              meta: {},
              instructions: [],
              instructionNodes: [],
              searchEntities: []
            });
          };
          tx.onabort = tx.onerror;
        } catch (err) {
          done({
            meta: {},
            instructions: [],
            instructionNodes: [],
            searchEntities: []
          });
        }
      });
    });
  }

  core.instructionsDb = {
    name: DB_NAME,
    stores: STORES,
    readDataset: readDataset,
    writeDataset: writeDataset
  };
})(window);
