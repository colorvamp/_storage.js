	var _storage = function(table){
		this._db = false;
		this.table = table;
		this.version = 1;
		this.isOpen = false;
	};
	_storage.prototype.open = function(){
		return new Promise(function (resolve, reject) {
			if( this._db ){resolve({});}

			this._open = indexedDB.open(this.table,this.version);
			this._open.onupgradeneeded = function() {
				this._db = this._open.result;
				var store = this._db.createObjectStore(this.table);
				var index = store.createIndex('path','path',{ unique: false });
				var index = store.createIndex('file',['path','name'],{ unique: true });
			}.bind(this);
			this._open.onsuccess = function(event) {
				this._db = this._open.result;
				resolve(event);
			}.bind(this);
			this._open.onerror = function(event) {
				reject(event);
			};
		}.bind(this));
	};
	_storage.prototype.path = function(path){
		fileName = path.split('\\').pop().split('/').pop();
		if( !fileName ){return false;}
		filePath = path.substr(0,path.length - fileName.length);
		if( filePath[0] !== '/' ){filePath = '/' + filePath;}
		if( filePath[filePath.length -1] !== '/' ){filePath = filePath + '/';}

		return {'path':filePath,'name':fileName};
	};
	_storage.prototype.file = function(path){
		return new Promise(function (resolve, reject) {
			var file = this.path(path);
			if( file === false ){return reject({'error':'INVALID_FILE'});}

			this.open()
			.then(function(event){
				var transaction = this._db.transaction([this.table],'readonly');
				transaction.oncomplete = function(event) {resolve(transaction);};
				transaction.onerror = function(event) {reject(event);};

				var objectStore = transaction.objectStore(this.table);
				var index = objectStore.index('file');
				var request = index.get([file.path,file.name]);
				request.onsuccess = function(event) {
					resolve(request.result);
				};
			}.bind(this),function(event){
				reject(event);
			});
		}.bind(this));
	};
	_storage.prototype.remove = function(path){
		return new Promise(function (resolve, reject) {
			var file = this.path(path);
			if( file === false ){return reject({'error':'INVALID_FILE'});}

			this.open()
			.then(function(event){
				var transaction = this._db.transaction([this.table],'readwrite');
				transaction.oncomplete = function(event) {resolve(transaction);};
				transaction.onerror = function(event) {reject(event);};

				var objectStore = transaction.objectStore(this.table);
				var index = objectStore.index('file');
				var request = index.openKeyCursor([file.path,file.name]);
				request.onsuccess = function(event) {
					if( request.result ){
						objectStore.delete(request.result.primaryKey);
					}
					resolve();
				};
			}.bind(this),function(event){
				reject(event);
			});
		}.bind(this));
	};
	_storage.prototype.folder = function(path){
		return new Promise(function (resolve, reject) {
			this.open()
			.then(function(event){
				var transaction = this._db.transaction([this.table],'readonly');
				transaction.oncomplete = function(event) {resolve(transaction);};
				transaction.onerror = function(event) {reject(event);};

				var objectStore = transaction.objectStore(this.table);
				var index = objectStore.index('path');
				var request_count = index.count(path);
				request_count.onsuccess = function(event) {
					if( !request_count.result ){
						reject({'error':'INVALID_FOLDER'});
					}

					var request = index.openCursor(path);
					request.onsuccess = function(event) {
						var ob = {
							 'cursor': request.result
							,'forEach': function(cb){
								var k = 0;
								if( request.result ) {
									cb(request.result.value,k++);
									request.result.continue();
								}
							}
						};

						resolve(ob);
					};
				};
			}.bind(this),function(event){
				reject(event);
			});
		}.bind(this));
	};
	_storage.prototype.store = function(path,content){
		return new Promise(function (resolve, reject) {
			var file = this.path(path);
			if( file === false ){return reject({'error':'INVALID_FILE'});}

			this.open()
			.then(function(event){
				var transaction = this._db.transaction([this.table],'readwrite');
				transaction.oncomplete = function(event) {
					resolve(transaction);
				};
				transaction.onerror = function(event) {
					reject(event);
				};

				var objectStore = transaction.objectStore(this.table);
				file.content = content;
				var request = objectStore.put(file,file.path + file.name);
				request.onsuccess = function(event) {
					resolve(request.result);
				};
			}.bind(this),function(event){
				reject(event);
			});
		}.bind(this));
	};
