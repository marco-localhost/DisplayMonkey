// 12-08-13 [DPA] - client side scripting BEGIN
// 14-10-06 [LTL] - reload when display hash changes
// 14-10-11 [LTL] - error reporting
// 14-10-16 [LTL] - YouTube support
// 14-10-25 [LTL] - use strict, code improvements
// 15-01-30 [LTL] - minor code improvements
// 15-02-06 [LTL] - major overhaul

var $j = jQuery.noConflict();

var ErrorReport = Class.create({
    initialize: function (options) {
        "use strict";
        this.info = {
            Error: ((options.exception instanceof Error ? options.exception.message : options.exception) || "unspecified"),
            Where: (options.source || "unspecified"),
            When: moment().format(),
            Data: (options.data || "none")
        };
        console.log("!Display Monkey error: " + JSON.stringify(this.info));
        this.length = options.length || 100;
        if (_canvas.showErrors) {
            this.show(this.length);
        }
    },

    show: function (length) {
        "use strict";
        var div = /*$('error') ||*/ new Element('div', { id: 'error' });
        div.update(div.innerHTML.concat(
            "<table>",
            "<tr><td>Error:</td><td>#{Error}</td></tr>",
            "<tr><td>Where:</td><td>#{Where}</td></tr>",
            "<tr><td>When:</td><td>#{When}</td></tr>",
            "<tr><td>Data:</td><td>#{Data}</td></tr>",
            "</table>"
            ).interpolate(this.info)
        );
        $(document.body).insert({ bottom: div });
        div.fade({ duration: 1, from: 0, to: 1 });
        function _remove() { div.remove(); }
        function _hide() {
            _remove.delay(2);
            div.fade({ duration: 1, from: 1, to: 0 });
        }
        length = length || this.length;
        _hide.delay(length < 1 ? 1 : length);
    },
});

var _canvas = {};
var Canvas = Class.create({
	initialize: function (options) {
	    "use strict";
	    this.fullScreenActive = false;

		var serverTime = moment(options.localTime);
		this.offsetMilliseconds = moment().diff(serverTime);
		this.displayId = options.displayId;
		this.hash = options.hash;
		this.dateFormat = (options.dateFormat || 'LL');
		this.timeFormat = (options.timeFormat || 'LT');
		this.latitude = (options.latitude || 0);
		this.longitude = (options.longitude || 0);
		this.woeid = (options.woeid || 0);
		this.culture = (options.culture || "");
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
	},

	initPanels: function () {
	    "use strict";
	    this.fixScreenDiv();
	    Event.observe(window, "resize", this.fixScreenDiv);

	    var s = $('segments').style;
	    if (this.backImage > 0) {
	        s.backgroundImage = "url('getImage.ashx?content=" + this.backImage + "')";
	    }
	    if (this.backColor != '') {
	        s.backgroundColor = this.backColor;
	    }

	    $$('div[data-panel-id]').each(function (e) {
	        var pi = e.readAttribute('data-panel-id');
	        if (e.id === "full")
	            this.fullPanel = new Ajax.FullScreenPanelUpdater({
                    panelId: pi,
                    container: e.id,
		            evalScripts: false,
		            fadeLength: 2, // sec (default)
		            idleInterval: this.initialIdleInterval,
                });
	        else
	            this.panels.push(new Ajax.PanelUpdater({
                    panelId: pi,
                    container: e.id,
		            evalScripts: false,
		            fadeLength: 1, // sec (default)
                }));
	    }.bind(this));
	},

	fixScreenDiv: function () {
	    "use strict";
	    var body = $$('body')[0];
		body.style.backgroundColor = this.backColor;
		var s = $('screen').style;
		s.height = body.clientHeight + 'px';
		s.width = body.clientWidth + 'px';
		s.backgroundColor = this.backColor;
	},

    checkDisplayHash: function () {
        "use strict";
        new Ajax.Request("getDisplayHash.ashx", {
            method: 'get'
            , parameters: $H({display: this.displayId})
            , canvas: this
            , evalJSON: false

            , onSuccess: function (resp) {
                try {
                    var json = null;
                    if (resp.responseText.isJSON())
                        json = resp.responseText.evalJSON();
                    if (!json)
                        throw new Error("JSON expected"); // <-- shouldn't get here
                    var c = resp.request.options.canvas;
                    var _displayId = json["DisplayId"];
                    if (c.displayId != _displayId)
                        return;
                    var _hash = json["Hash"];
                    if (c.hash != _hash)
                        document.location.reload(true);
                }
                catch (e) {
                    new ErrorReport({ exception: e, data: resp.responseText, source: "checkDisplayHash::onSuccess" });
                }
            }

			, onFailure: function (resp) {
			    new ErrorReport({ exception: resp, source: "checkDisplayHash::onFailure" });
			}
        });
    },
});

Ajax.PanelUpdaterBase = Class.create(Ajax.Base, {
	initialize: function ($super, options) {
	    "use strict";
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
		this.frequency = (this.options.frequency || 1);
		this.container = this.options.container; // "div" + this.panelId;
		this.html = "";
		//this.hash = "";
		this.object = null;

		this.currentId = 0;
		this.previousType = this.currentType = "";
		this.fadeLength = (this.options.fadeLength || 0);
		if (this.fadeLength < 0) this.fadeLength = 0;

		this.onFrameExpire.bind(this);
		this.onGetNextFrame.bind(this);
		this.onUpdateEnd.bind(this);
	},

	onFrameExpire: function () {
	    "use strict";
	    this.onGetNextFrame();
	},                // <-- override

	onGetNextFrame: function () {
	    "use strict";
	    // get next frame
	    var p = $H({
	        "frame":    this.currentId,
	        "panel":    this.panelId,
	        "display":  _canvas.displayId,
	        "culture":  _canvas.culture,
	        "woeid":    _canvas.woeid,
		    "tempU":    _canvas.temperatureUnit,
	    });
		new Ajax.Request("getNextFrame.ashx", {
			method: 'get'
		    , parameters: p
		    , panelUpdater: this
		    , evalJSON: false

		    , onSuccess: function (resp) {
		        var p = resp.request.options.panelUpdater;
		        try {
				    var json = null;
				    if (resp.responseText.isJSON())
				        json = resp.responseText.evalJSON();
				    if (!json)
				        throw new Error("JSON expected"); // <-- shouldn't get here
				    //console.log($H(json).inspect());

                    // get duration first
				    p.frequency = json["Duration"];
				    if (p.frequency == null || p.frequency <= 0)
				        p.frequency = 1;

                    // now get frame id
				    p.currentId = json["FrameId"];
				    if (p.currentId == null || !p.currentId) {
				        p.currentId = 0;
				    } else {
				        p.currentType = json["FrameType"];
				        p.html = json["Html"];
				    }
			    }
			    catch (e) {
			        new ErrorReport({ exception: e, data: resp.responseText, source: "onGetNextFrame::onSuccess" });
			    }
		        finally {
		            p.onUpdateEnd();
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
		        //_updateBegin();
		        new ErrorReport({ exception: resp.toString(), source: "onGetNextFrame::onFailure", data: resp });
		        var p = resp.request.options.panelUpdater;
		        p.onUpdateEnd();
		    }
		});
	},               // <-- get HTML via Ajax, then calls onUpdateEnd

	onUpdateEnd: function () {
	    "use strict";
	    this.previousType = this.currentType;

	    // queue onFrameExpire
	    this.expire = this.onFrameExpire
            .bind(this)
            .delay(this.frequency + this.fadeLength)
	    ;
	},                  // <-- override

	_uninitFrame: function () {
	    "use strict";
	    try {
	        if (this.object && this.object.stop) {
	            this.object.stop()
	        }

	        // resume others
	        if (this instanceof Ajax.FullScreenPanelUpdater) {
	            _canvas.panels.forEach(function (p) {
	                if (p.object && p.object.play) p.object.play();
	            });
	        }
	    }
	    catch (e) {
	        new ErrorReport({ exception: e, source: "_uninitFrame" }); // <-- shouldn't get here
	    }
	    finally {
	        this.object = null;
	    }
	},                 // <-- stops and destroys current object; for full panel resumes objects in other panels

	_initFrame: function () {
	    "use strict";
        try {
            // pause others
            if (this instanceof Ajax.FullScreenPanelUpdater) {
                _canvas.panels.forEach(function (p) {
                    if (p.object && p.object.pause) p.object.pause();
                });
            }

            var div = null;

            // start scroller
	        if (div = $(this.container).down('div.memo')) {
	            this.object = new TextScroller(div);
            }

	        // start clock
	        else if (div = $(this.container).down('div.clock')) {
	            this.object = new Clock(div);
            }

	        // start video
	        else if ((div = $(this.container).down('video')) && _canvas.supports_video) {
	            this.object = div;
	            var a;
	            if (a = div.readAttribute('loop')) div.loop = a;
	            if (a = div.readAttribute('muted')) div.muted = a;
	            if (this instanceof Ajax.FullScreenPanelUpdater || !_canvas.fullScreenActive) {
	                div.play();
	            }
	            var vc = div.up('div.videoContainer');
	            if (vc) {
	                vc.style.backgroundColor = _canvas.backColor;
	            }
            }

            // start youtube
	        else if (div = $(this.container).down('div[id^=ytplayer]')) {
	            this.object = new YtLib.YtPlayer({ div: div });
            }

            // start outlook
	        else if (div = $(this.container).down('div.outlook')) {
	            this.object = new Outlook({
	                div: div,
	                frameId: this.currentId,
	                panelId: this.panelId
	            });
	        }

            // immune to full frame
	        if (this instanceof Ajax.PanelUpdater)
	            this.freezeOnFullScreen = (this.currentType != "WEATHER");
        }
	    catch (e) {
	        new ErrorReport({ exception: e, source: "_initFrame" }); // <-- shouldn't get here
	    }
	},                   // <-- for full panel pauses other panels' objects, depending on frame type creates new object and optionally plays it

	/*_hashUrl: function (url) {
	    "use strict";
	    var u = url.split('?'), p = $H();
	    if (u.length > 1) p = p.merge(u[1].toQueryParams());
	    p.set('ts', (new Date()).getTime());
	    return u[0] + '?' + p.toQueryString();
	},*/
});

Ajax.PanelUpdater = Class.create(Ajax.PanelUpdaterBase, {
	initialize: function ($super, options) {
	    "use strict";
	    $super(options);
		this.freezeOnFullScreen = (options.freezeOnFullScreen || true);
		this.onFrameExpire();
	},

	onFrameExpire: function ($super) {
	    "use strict";
	    if (this.freezeOnFullScreen && _canvas.fullScreenActive) {
            // TODO: recalculate expire and frequency when caught up in fullscreen
	        this.expire = this.onFrameExpire.bind(this).delay(this.frequency);
	    } else {
	        $super();
	    }
	},                // <-- if not behind full frame call onGetNextFrame, otherwise queue onFrameExpire again

	onUpdateEnd: function ($super) {
	    "use strict";
	    /*var new_hash = hashFnv32a(this.html, true);
	    var needRedraw = (
			this.previousType != this.currentType ||
			//$(this.container).innerHTML != this.html ||
            this.hash != new_hash
		);

	    if (!needRedraw) {
			this.expire = this.onFrameExpire.bind(this).delay(this.frequency);
			return;
	    }

        // set new hash
	    this.hash = new_hash;*/

	    // TODO: wait until object is ready
	    if (0) {
	        this.onUpdateEnd.bind(this).delay(0.1);
	        return;
	    }

	    // un-init old frame
	    this._uninitFrame();

	    // create new container
	    var oldContainer = $(this.container),
            newContainer = oldContainer
                .clone(false)
                .setStyle({
                    display: 'none'
                })
	    ;
	    oldContainer.insert({ after: newContainer });
	    oldContainer.id = "x_" + oldContainer.id;

	    var afterFadeOut = function () {
	        oldContainer.remove();
	    };

	    // fade out old container and remove it
	    if (this.fadeLength > 0) {
	        oldContainer.fade({
	            duration: this.fadeLength,
	            afterFinish: function () {
	                afterFadeOut();
	            }
	        });
	    }
	    else {
	        afterFadeOut();
	    }

	    // if no frame
	    if (!this.currentId) {
	        this.expire = this.onFrameExpire.bind(this).delay(this.frequency);
	        return;
	    }

	    // substitute html
	    newContainer.update(this.html);

	    // 1. call after update
	    this._initFrame();

	    var afterFadeIn = function () {
	        newContainer.setStyle({ display: '' });
	    };

	    // 2. fade in last
	    if (this.fadeLength > 0) {
	        newContainer.appear({
	            duration: this.fadeLength,
	            afterFinish: function () {
	                afterFadeIn();
	            }
	        });
	    } else {
	        afterFadeIn();
	    }

	    // 3. queue onFrameExpire
	    $super();
	},
});

Ajax.FullScreenPanelUpdater = Class.create(Ajax.PanelUpdaterBase, {
	initialize: function ($super, options) {
	    "use strict";
	    $super(options);
		this.idleInterval = (this.options.idleInterval || 0);
		this._getIdleInterval();
		this.onFrameExpire();
	},

	onFrameExpire: function ($super) {
	    "use strict";
	    // un-init old frame
	    this._uninitFrame();

	    // create new screen
	    var screen = $("screen"),
            oldContainer = $(this.container),
            newContainer = oldContainer
                .clone(false)
                .setStyle({ 
                    display: 'none'
                })
	    ;
	    oldContainer.insert({ after: newContainer });
	    oldContainer.id = "x_" + oldContainer.id;

	    var afterFadeOut = function() {
	        oldContainer.remove();
	        screen.setStyle({ display: 'none' });
	        _canvas.fullScreenActive = false;
	    };
	    
	    // fade out old container and remove it
	    if (this.fadeLength > 0) {
	        screen.fade({
	            duration: this.fadeLength,
	            afterFinish: function () {
	                afterFadeOut();
	            }
	        });
	    }
	    else {
	        afterFadeOut();
        }

        // queue next frame update
	    this.idler = this.onGetNextFrame.bind(this).delay(this.idleInterval);
	},

	onUpdateEnd: function ($super) {
	    "use strict";
	    if (!this.currentId) {
	        this.expire = this.onFrameExpire.bind(this).delay(this.idleInterval);
	        return;
	    }

	    _canvas.fullScreenActive = true;

	    // substitute html
	    //this.previousType = this.currentType;
	    var screen = $("screen"),
            container = $(this.container)
	    ;
	    container.update(this.html).setStyle({ display: '' });

	    // 1. call after update
	    this._initFrame();

	    var afterFadeIn = function () {
	        screen.setStyle({ display: 'block' });
	    };

	    // 2. fade in last
	    if (this.fadeLength > 0) {
	        screen.appear({
	            duration: this.fadeLength,
	            afterFinish: function () {
	                afterFadeIn();
	            }
	        });
	    } else {
	        afterFadeIn();
	    }

	    // 3. queue onFrameExpire
	    $super();
	},

	_getIdleInterval: function () {
	    "use strict";
	    var p = $H({ display: _canvas.displayId });
	    new Ajax.Request("getIdleInterval.ashx", {
	        method: 'get'
            , parameters: p
            , panelUpdater: this
            , evalJSON: false

            , onSuccess: function (resp) {
                try {
                    var json = null;
                    if (resp.responseText.isJSON())
                        json = resp.responseText.evalJSON();
                    if (!json)
                        throw new Error("JSON expected, received ".concat(resp.responseText)); // <-- shouldn't get here
                    var p = resp.request.options.panelUpdater;
                    p.idleInterval = json["IdleInterval"];
                }
                catch (e) {
                    new ErrorReport({ exception: e, data: resp.responseText, source: "onAfterUpdate::onSuccess" });
                }
            }

            , onFailure: function (resp) {
                new ErrorReport({ exception: resp, source: "onAfterUpdate::onFailure" });
            }
	    });

	    this.getInterval = this._getIdleInterval.bind(this).delay(60);     // check every 60 seconds
	},
});


// to prevent webkit issues this func needs to be a global object
function ticker() {
    "use strict";
    // refresh the window every midnight
    var now = new Date();
    if (0 == now.getHours() == now.getMinutes()) {
        document.location.reload(true);
        return;
    }
    _canvas.checkDisplayHash();
}

/**
 * Calculate a 32 bit FNV-1a hash
 * Found here: https://gist.github.com/vaiorabbit/5657561
 * Ref.: http://isthe.com/chongo/tech/comp/fnv/
 *
 * @param {string} str the input value
 * @param {boolean} [asString=false] set to true to return the hash value as 
 *     8-digit hex string instead of an integer
 * @param {integer} [seed] optionally pass the hash of the previous chunk
 * @returns {integer | string}
 */
function hashFnv32a(str, asString, seed) {
    "use strict";
    /*jshint bitwise:false */
    var i, l,
        hval = (seed === undefined) ? 0x811c9dc5 : seed;

    for (i = 0, l = str.length; i < l; i++) {
        hval ^= str.charCodeAt(i);
        hval += (hval << 1) + (hval << 4) + (hval << 7) + (hval << 8) + (hval << 24);
    }
    if (asString) {
        // Convert to 8 digit hex string
        return ("0000000" + (hval >>> 0).toString(16)).substr(-8);
    }
    return hval >>> 0;
}

(function () {
    "use strict";
    if (!document.createElement('video').stop)
        Element.addMethods('video', {
            stop: function (e) { e.pause(); }
        });
})();

document.observe("dom:loaded", function () {
    "use strict";
	try {
	    // periodic checker
		setInterval(ticker, 60000);

		// init panels
		_canvas.initPanels();
	}
    catch (e) {
        new ErrorReport({ exception: e, source: "dom:loaded" }); // <-- shouldn't get here
    }
});

// 12-08-13 [DPA] - client side scripting END
