// 12-08-13 [DPA] - client side scripting BEGIN
// 14-10-06 [LTL] - reload when display hash changes
// 14-10-11 [LTL] - error reporting
// 14-10-16 [LTL] - YouTube support

var $j = jQuery.noConflict();

var ErrorReport = Class.create({
    initialize: function (options) {
        this.length = options.length || 100;
        this.div = /*$('error') ||*/ new Element('div', { id: 'error' });
        var l = {
            Error: ((options.exception.message == undefined ? options.exception : options.exception.message) || "unspecified"),
            Where: (options.source || "unspecified"),
            When: moment().format(),
            Data: (options.data || "none")
        };
        var report =
            //this.div.innerHTML +
            "<table><tr><td>Error:</td><td>" + l.Error + "</td></tr>" +
            "<tr><td>Where:</td><td>" + l.Where + "</td></tr>" +
            "<tr><td>When:</td><td>" + l.When + "</td></tr>" +
            "<tr><td>Data:</td><td>" + l.Data + "</td></tr></table>"
        ;
        this.div.update(report);
        console.log("!Display Monkey error: " + JSON.stringify(l));
        this.show();
    },

    show: function () {
        if (!_canvas.showErrors)
            return;
        this._hide.bind(this).delay(this.length);
        $(document.body).insert({ top: this.div });
        $(this.div).fade({ duration: 1, from: 0, to: 1 });
    },

    _hide: function () {
        this._remove.bind(this).delay(1);
        $(this.div).fade({ duration: 1, from: 1, to: 0 });
    },

    _remove: function () {
        $(this.div).remove();
    },
});

var _canvas = {};
var Canvas = Class.create({
	initialize: function (options) {
		this.fullScreenActive = false;

		/*var serverTime = moment(options.utcTime);
		if (options.gmtOffset > 0)
		    serverTime.add('h', options.gmtOffset);
		else
		    serverTime.subtract('h', -options.gmtOffset);*/
		var serverTime = moment(options.localTime);
		this.offsetMilliseconds = moment().diff(serverTime);
		this.displayId = options.displayId;
		this.hash = options.hash;
		this.dateFormat = (options.dateFormat || 'LL');
		this.timeFormat = (options.timeFormat || 'LT');
		this.latitude = (options.latitude || 0);
		this.longitude = (options.longitude || 0);
		this.woeid = (options.woeid || 0);
		this.temperatureUnit = (options.temperatureUnit || 'c');
		this.showErrors = (options.showErrors || false);

		this.width = (options.width || 0);
		this.height = (options.height || 0);
		this.backImage = (options.backImage || 0);
		this.backColor = (options.backColor || 'transparent');
		this.initialIdleInterval = (options.initialIdleInterval || 0);
		this.supports_video = !!document.createElement('video').canPlayType;

		this.panels = [];
		this.fullPanel = {};
	}

	, initStyles: function () {
		this.fixScreenDiv();
		Event.observe(window, "resize", this.fixScreenDiv);

		/*with ($('full').style) {
			height = this.height + 'px';
			width = this.width + 'px';
		}*/

		with ($('segments').style) {
			if (this.backImage > 0) {
				backgroundImage = "url('getImage.ashx?content=" + this.backImage + "')";
			}
			if (this.backColor != '') {
				backgroundColor = this.backColor;
			}
		}
	}

	, fixScreenDiv: function () {
		var body = $$('body')[0];
		body.style.backgroundColor = this.backColor;
		with ($('screen').style) {
			height = body.clientHeight + 'px';
			width = body.clientWidth + 'px';
			backgroundColor = this.backColor;
		}
		/*with ($('segments').style) {
			height = body.clientHeight + 'px';
			width = body.clientWidth + 'px';
		}*/
	}

    , checkDisplayHash: function () {
        new Ajax.Request("getDisplayHash.aspx", {
            method: 'get'
            , parameters: $H({display: this.displayId})
            , canvas: this
            , evalJSON: false

            , onSuccess: function (resp) {
                var json = null;
                with (resp.responseText) {
                    if (isJSON()) json = evalJSON();
                }
                with (resp.request.options.canvas) {
                    try {
                        if (!json)
                            throw new Error("JSON expected"); // <-- shouldn't get here
                        var _displayId = json["DisplayId"];
                        if (displayId != _displayId)
                            return;
                        var _hash = json["Hash"];
                        if (hash != _hash)
                            document.location.reload(true);
                    }
                    catch (e) {
                        new ErrorReport({ exception: e, data: resp.responseText, source: "checkDisplayHash" });
                    }
                }
            }
        });
    }
});

Ajax.PanelUpdaterBase = Class.create(Ajax.Base, {
	initialize: function ($super, options) {
		$super(options);

		/*
		this.options.requestHeaders = (options.requestHeaders||{
		"Pragma":            "no-cache",
		"Pragma":            "no-cache",
		"Cache-Control":     "no-store, no-cache, must-revalidate, post-check=0, pre-check=0",
		"Expires":           new Date(0),
		"Last-Modified":     new Date(0), // January 1, 1970
		"If-Modified-Since": new Date(0)
		});
		*/

		this.panelId = (this.options.panelId || 0);
		var params = document.location.href.toQueryParams();
		this.displayName = params['dn'];
		if (this.displayName == undefined) this.displayName = null;
		this.featureId = params['feature'];
		if (this.featureId == undefined || this.featureId == "") this.featureId = 0;

		//this.onComplete = this.options.onComplete;
		this.frequency = (this.options.frequency || 1);
		this.updater = {};
		this.container = this.options.container; // "div" + this.panelId;
		this.h_container = "h_" + this.container;
		this.url = "";

		this.currentId = 0;
		this.previousType = this.currentType = "";
		this.onBeforeUpdate = (this.options.onBeforeUpdate || Prototype.emptyFunction);
		this.onAfterUpdate = (this.options.onAfterUpdate || Prototype.emptyFunction);
		this.onFade = (this.options.onFade || Prototype.emptyFunction);
		this.onBeforeIdle = (this.options.onBeforeIdle || Prototype.emptyFunction);
		this.fadeLength = (this.options.fadeLength || 0);
		if (this.fadeLength < 0) this.fadeLength = 0;

		this.ytPlayer = null;

		this.options.onComplete = this._updateEnd.bind(this);
		this.options.onException = this._dispatchException.bind(this);
		this.onBeforeUpdate.bind(this);
		this.onAfterUpdate.bind(this);
		this.onFade.bind(this);
		this.onBeforeIdle.bind(this);
		this._onFrameExpire.bind(this);
		this._onGetNextFrame.bind(this);
	},

	start: function () {
		this._onFrameExpire();
	},

	/*stop: function() {
	clearTimeout(this.expire);
	clearTimeout(this.idler);
	clearTimeout(this.fader);
	this.updater.options.onComplete = undefined;
	this.updater.options.onException = undefined;
	(this.onComplete || Prototype.emptyFunction).apply(this, arguments);
	},*/

	_hashUrl: function (url) {
		var u = url.split('?'), p = $H();
		if (u.length > 1) p = p.merge(u[1].toQueryParams());
		p.set('ts', (new Date()).getTime());
		return u[0] + '?' + p.toQueryString();
	},

	_onFrameExpire: function () {
		this._onGetNextFrame();
	},

	_onGetNextFrame: function () {
		// get next frame
	    var p = $H({
	        panel: this.panelId,
	        display: _canvas.displayId,
	        frame: this.currentId,
	        feature: this.featureId
	    });
		new Ajax.Request("getNextFrame.aspx", {
			method: 'get'
		, parameters: p
		, panelUpdater: this
		, evalJSON: false

		, onSuccess: function (resp) {
			var json = null;
			with (resp.responseText) {
				if (isJSON()) json = evalJSON();
			}
			with (resp.request.options.panelUpdater) {
				try {
					if (!json) throw new Error("JSON expected"); // <-- shouldn't get here

					//console.log($H(json).inspect());
					currentId = json["FrameId"];
					if (!currentId)
						return _updateEnd(null);

					currentType = json["FrameType"];
					frequency = json["Duration"];
					if (!frequency)
						frequency = 1;

					url = "getFrame.aspx?" + $H({
						"frame": currentId,
						"panel": panelId,
						"type": currentType,
						"display": _canvas.displayId
					}).toQueryString();
					//console.log(url);

					_updateBegin();
				}
				catch (e) {
					_updateEnd(null);
				}
			}
		}

		, onFailure: function (resp) {
			/*switch(resp.status)
			{
			case 404:
			case 415:
			default:
			break;
			}*/
			with (resp.request.options.panelUpdater) {
				//_updateBegin();
				_updateEnd(null);
			}
		}
		});
	},

	_updateBegin: function () {
		try { this.onBeforeUpdate(this.currentType); }
		catch (e) {
		    new ErrorReport({ exception: e, source: "onBeforeUpdate" }); // <-- shouldn't get here
		}
		this.updater = new Ajax.Updater(this.h_container, this._hashUrl(this.url), this.options);
	},

	_dispatchException: function (e) {
	    new ErrorReport({ exception: e, source: "_dispatchException" }); // <-- shouldn't get here
	},

	_updateEnd: function (response) {

		var needRedraw = (
			this.previousType != this.currentType ||
			$(this.container).innerHTML != $(this.h_container).innerHTML
		);

		if (!needRedraw) {
			this.expire = this._onFrameExpire.bind(this).delay(this.frequency);
			return;
		}

		// fade out first
		if (this.fadeLength > 0) {
			try { this.onFade(false, this.previousType, this.fadeLength); }
			catch (e) {
			    new ErrorReport({ exception: e, source: "onFade" }); // <-- shouldn't get here
            }
			this.fader = this._fadeOutEnd.bind(this).delay(this.fadeLength);
		}
		else
			this._fadeOutEnd();
	},

	_fadeOutEnd: function () {
		this._beginNewFrame();
	},

	_beginNewFrame: function () {

		// substitute html
		this.previousType = this.currentType;
		var html = $(this.h_container).innerHTML;
		$(this.h_container).update("");
		$(this.container).update(html);

		// 1. call after update
		try { this.onAfterUpdate(this.previousType); }
		catch (e) {
		    new ErrorReport({ exception: e, source: "onAfterUpdate" }); // <-- shouldn't get here
        }

		// 2. fade in last
		if (this.fadeLength > 0) {
			try { this.onFade(true, this.currentType, this.fadeLength); }
			catch (e) {
			    new ErrorReport({ exception: e, source: "onFade" }); // <-- shouldn't get here
            }
			this.fader = this._fadeInEnd.bind(this).delay(this.fadeLength);
		}
		else
			this._fadeInEnd();
	},

	_fadeInEnd: function () {
		this.expire = this._onFrameExpire.bind(this).delay(this.frequency);
	}
});

Ajax.PanelUpdater = Class.create(Ajax.PanelUpdaterBase, {
	initialize: function ($super, options) {
		$super(options);

		this.freezeOnFullScreen = (this.options.freezeOnFullScreen || true);

		this.start();
	},

	_onFrameExpire: function ($super) {
	    if (this.freezeOnFullScreen && _canvas.fullScreenActive) {
            // TODO: fix expire and frequency when caught up in fullscreen
	        this.expire = this._onFrameExpire.bind(this).delay(this.frequency);
	    } else {
	        $super();
	    }
	},
});

Ajax.FullScreenPanelUpdater = Class.create(Ajax.PanelUpdaterBase, {
	initialize: function ($super, options) {
		$super(options);

		this.idler = {};
		this.idleInterval = (this.options.idleInterval || 0);
		this.onBeforeIdle = (this.options.onBeforeIdle || Prototype.emptyFunction);
		this.onBeforeIdle.bind(this);

		this.start();
	},

	_onFrameExpire: function () {
		if (this.fadeLength > 0) {
			try { this.onFade(false, this.previousType, this.fadeLength); }
			catch (e) {
			    new ErrorReport({ exception: e, source: "onFade" }); // <-- shouldn't get here
            }

			// 2. start fader
			this.fader = this._fadeOutEnd.bind(this).delay(this.fadeLength);
		}
		else
			this._fadeOutEnd();
	},

	_fadeOutEnd: function () {
		try { this.onBeforeIdle(this.currentType); }
		catch (e) {
		    new ErrorReport({ exception: e, source: "onBeforeIdle" }); // <-- shouldn't get here
        }
		this.idler = this._onGetNextFrame.bind(this).delay(this.idleInterval);
	},

	_updateEnd: function (response) {

		var needRedraw = (
			this.currentId > 0
		);

		if (!needRedraw) {
			this.expire = this._onFrameExpire.bind(this).delay(this.frequency);
			return;
		}
		
		this._beginNewFrame();
	},
});


function initPanel (panelId, container) {
	return new Ajax.PanelUpdater({
		method: 'get'
		, panelId: panelId
		, container: container
		, evalScripts: false
		, fadeLength: 0.2 // sec (default)

		, onBeforeUpdate: function (currentType) {
			// kill scroller if any
			if (this.textContainerDiv) {
				this.textContainerDiv.stopScroller();
			}

			if (this.clockDiv) {
				this.clockDiv.stopClock();
			}

			if (currentType == "WEATHER") {
				this.url += "&" + $H({
					"woeid": _canvas.woeid,
					"temperatureUnit": _canvas.temperatureUnit
				}).toQueryString();
				this.freezeOnFullScreen = false;
			}

			if (this.ytPlayer) {
			    this.ytPlayer.stop();
			    this.ytPlayer = null;
			}
		}

		, onAfterUpdate: function (currentType) {
			// start scroller
			var tc = $(this.container).down('div[id=memo]');
			if (tc) {
				(this.textContainerDiv = tc).startScroller();
			}

			var cc = $(this.container).down('div[id=clock]');
			if (cc) {
				(this.clockDiv = cc).startClock();
			}

			var v = $(this.container).down('video');
			if (v) {
			    var a;
			    if (a = v.readAttribute('loop')) v.loop = a;
			    if (a = v.readAttribute('muted')) v.muted = a;
			    if (_canvas.supports_video && !_canvas.fullScreenActive)
			        try { v.play(); } catch (e) { }
			    /*new MediaElement('videoPlayer', {
				    success: function (me) {
				        me.play();
				    }
				});*/
			}

			var v = $(this.container).down('div[id=videoContainer]');
			if (v) {
				v.style.backgroundColor = _canvas.backColor;
			}

			var yt = $(this.container).down('div[id^=ytplayer]');
			if (yt) {
			    this.ytPlayer = new YtLib.YtPlayer({ div: yt });
			}
		}

		, onFade: function (appear, contentType, fadeLength) {
			if (appear)
				$(this.container).appear({ duration: fadeLength });
			else
				$(this.container).fade({ duration: fadeLength });
		}

		, onException: function (request, ex) {
			new ErrorReport({ exception: new Error(ex.description), source: "onException" }); // <-- shouldn't get here
		}
	});
}

function initFullScreenPanel (panelId) {
	return new Ajax.FullScreenPanelUpdater({
		method: 'get'
		, panelId: panelId
		, container: 'full'
		, evalScripts: false
		, fadeLength: 1 // sec (default)
		, idleInterval: _canvas.initialIdleInterval

		 //, onBeforeUpdate: function (currentType) {
		 //}

		, onAfterUpdate: function (currentType) {
			_canvas.fullScreenActive = true;
			$("screen").style.display = "block";
			_canvas.panels.forEach(function (p) {
			    if (p.ytPlayer) p.ytPlayer.pause();
			});
			if (_canvas.supports_video) {
			    $$("video").each(function (v) {
			        try { v.pause(); } catch (e) { }
			    });
			}

			// start scroller
			var tc = $(this.container).down('div[id=memo]');
			if (tc) {
				(this.textContainerDiv = tc).startScroller();
			}

			var cc = $(this.container).down('div[id=clock]');
			if (cc) {
				(this.clockDiv = cc).startClock();
			}

			var v = $(this.container).down('video');
			if (v) {
				var a;
				if (a = v.readAttribute('loop')) v.loop = a;
				if (a = v.readAttribute('muted')) v.muted = a;
				if (_canvas.supports_video) try { v.play(); } catch (e) { }
			}

			var yt = $(this.container).down('div[id^=ytplayer]');
			if (yt) {
			    this.ytPlayer = new YtLib.YtPlayer({ div: yt });
			}

			// obtain idle interval
			var p = $H({ display: _canvas.displayId });
			new Ajax.Request("getIdleInterval.aspx", {
				method: 'get'
				, parameters: p
				, panelUpdater: this
				, evalJSON: false

				, onSuccess: function (resp) {
					var json = null;
					with (resp.responseText) {
						if (isJSON()) json = evalJSON();
					}
					with (resp.request.options.panelUpdater) {
						try {
							if (!json) throw new Error("JSON expected"); // <-- shouldn't get here
							idleInterval = json["IdleInterval"];
						}
						catch (e) {
						}
					}
				}
			});
		}

		, onBeforeIdle: function (currentType) {
			$("screen").style.display = "none";
			_canvas.fullScreenActive = false;

			// kill scroller if any
			if (this.textContainerDiv) {
				this.textContainerDiv.stopScroller();
			}

			if (this.clockDiv) {
				this.clockDiv.stopClock();
			}

			if (this.ytPlayer) {
			    this.ytPlayer.stop();
			    this.ytPlayer = null;
			}

			if (_canvas.supports_video) {
			    $$("video").each(function (v) {
			        try { v.play(); } catch (e) { }
			    });
			}
			_canvas.panels.forEach(function (p) {
			    if (p.ytPlayer) p.ytPlayer.play();
			});
		}

		, onFade: function (appear, contentType, fadeLength) {
			if (appear)
				$(this.container).appear({ duration: fadeLength });
			else
				$(this.container).fade({ duration: fadeLength });
		}

		, onException: function (request, ex) {
			new ErrorReport({ exception: new Error(ex.description), source: "onException" }); // <-- shouldn't get here
		}
	});
}


// to prevent webkit issues this func needs to be a global object
function ticker() {
    // refresh the window every midnight
    var now = new Date();
    if (0 == now.getHours() == now.getMinutes()) {
        document.location.reload(true);
        return;
    }
    _canvas.checkDisplayHash();
}

document.observe("dom:loaded", function () {

	try {

	    // periodic checker
		setInterval(ticker, 60000);

		// rig up screen div
		_canvas.initStyles();

		// rig up text scroller
		Element.addMethods('div', {
			__textScroller: {}
			, __clock: {}

			, startScroller: function (e) {
				e.__textScroller = new TextScroller(e.id);
			}

			, stopScroller: function (e) {
				if (typeof e.__textScroller === 'object') {
					e.__textScroller.stop();
				}
			}

			, startClock: function (e) {
				e.__clock = new Clock(e.id);
			}

			, stopClock: function (e) {
				if (typeof e.__clock === 'object') {
					e.__clock.stop();
				}
			}
		});

		// init panels
		$$('div[data-panel-id]').each(function (e) {
			var pi = e.readAttribute('data-panel-id');
			if (e.id === "full")
				_canvas.fullPanel = initFullScreenPanel(pi);
			else
				_canvas.panels.push(initPanel(pi, e.id));
		});
	}
    catch (e) {
        new ErrorReport({ exception: e, source: "dom:loaded" }); // <-- shouldn't get here
    }
});

// 12-08-13 [DPA] - client side scripting END
