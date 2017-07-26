var youyiche = {
    //记录是否已经注入过微信Api权限
    isHadWxApi:false,

    //动态加载配置文件environmentConfig.js
    scriptConfig:function(callback){
        var head= document.getElementsByTagName('head')[0]; 
        var script= document.createElement('script'); 
        var timeStamp = new Date().getTime();
        var src = process.env.ITEM_NAME?'/WxWeb/environmentConfig.js':'js/environmentConfig.js'
        script.type= 'text/javascript'; 
        script.src= src+'?timeStamp='+timeStamp; 
        head.appendChild(script); 
        script.onload= function(){ 
            callback();
        }
    },

    // get search parameter
    getParamByUrl: function(name) {
        var search = location.href;
        var result = search.match(new RegExp("[\?\&]" + name + "=([^\?\&#]+)", "i"));
        if (result == null || result.length < 1 || result[1]=="undefined") {
            return "";
        }
        return result[1];
    },

    //偶尔会出现location对象还未创建的情况，需做延迟跳转
    locationChange:function(url,type){
        setTimeout(function(){
            if(type=="replace"){
                location.replace(url);
            }else{
                location.href = url;
            }
        },30)
    },

    //微信认证
    wauth: function(init, type) {
        var self = this;
        var code = self.getParamByUrl('code');
        var state = self.getParamByUrl('state');
        var errorTip = "授权失败，请退出后重新打开页面";
        var authType = type || 'snsapi_userinfo';

        var admin = self.getParamByUrl("admin");
        var wx_debug = self.getParamByUrl("wx_debug");

        if (admin) { //开发模式略过微信认证
            init();
            return;
        }

        //测试模式，强制删除localStorage保存的"sidnew"和"authType"，再走一遍微信认证
        if (wx_debug) { 
            localStorage.removeItem('sidnew');
            localStorage.removeItem('authType');
        }

        decideLocal();

        //兼容以前的页面(参数写在哈希#后面的页面作跳转处理)
        function setNewUrl() {
            var host = location.host;
            var pathname = location.pathname;
            var search = location.search;
            var hash = location.hash;
            var additionalParam = "",
                newHash = "",
                newSearch = search,
                splitHash, newHref;

            var delReactHash = function(str) {
                if (str.indexOf("_k") > -1) {
                    str = str.replace(/[\?\&]_k=[^\&\?]*/, "")
                }
                return str || "";
            }

            splitHash = hash.split("?");
            newHash = splitHash[0];

            if (splitHash[1]) {
                additionalParam = delReactHash("?" + splitHash[1]);
            }

            if (additionalParam) {
                if (search) {
                    newSearch += additionalParam.replace("?", "&");
                } else {
                    newSearch += additionalParam;
                }
                self.locationChange("http://" + host + pathname + newSearch + newHash,"replace")
            } else {
                if (!sessionStorage.getItem("newHash")) {
                    sessionStorage.setItem("newHash", newHash);
                }
                newHref = "http://" + host + pathname + newSearch;
                return newHref;
            }
        }

        // decide to had or not auth of weixin
        function decideLocal() {
            var sidnew = localStorage.getItem('sidnew');
            var newUrl = setNewUrl();
            var manual = true,lsAuthType;
            var hadWxApi = {
                isHad : false
            }

            if (!newUrl) {
                return false;
            }

            if(state=="snsapi_userinfo" && code){
                localStorage.setItem('authType','snsapi_userinfo');
                localStorage.removeItem('sidnew');
            }

            lsAuthType = localStorage.getItem('authType');

            if (authType == "snsapi_userinfo") {
                manual = lsAuthType == authType ? true : false;
            }

            if (sidnew && sidnew == self.getCookie('PHPSESSID') && manual) {
                self.isHadWxApi?init():self.initWxApi(init);
            } else {
                decideCode(newUrl);
            }
        }

        // decide is or isn't page of weixin returned 
        function decideCode(newUrl) {
            if (!state) {
                authHandle(newUrl);
            } else {
                if (code) {
                    sendBackend();
                } else {
                    alert(errorTip);
                }
            }
        }

        // 前端微信验证
        function authHandle(newUrl) {
            var redirect_uri = encodeURIComponent(newUrl),
                response_type = 'code',
                scope = authType,
                state = authType,
                wechat = 'wechat_redirect',
                appid = environmentConfig.appid;

            var wx_href = 'https://open.weixin.qq.com/connect/oauth2/authorize?appid=' + appid + '&redirect_uri=' + redirect_uri + '&response_type=' + response_type + '&scope=' + scope + '&state=' + state + '#' + wechat;

            self.locationChange(wx_href,"replace");
        }

        // 请求后端验证
        function sendBackend() {
            self.getJson('/wx_oauth/oauthAccessToken?code=' + code+'&scope='+authType)
                .then(function(data) {
                    var suc = data.success;
                    if (suc) {
                        localStorage.setItem('sidnew', self.getCookie('PHPSESSID'));
                        sessionStorage.removeItem("reload_wx_wauth");
                        redirect();
                    } else {
                        alert(errorTip);
                    }
                })
        }

        //前后端皆授权成功后
        //删除微信授权返回的code和state参数以及wx_debug(重定向)
        function redirect() {
            var newHash = sessionStorage.getItem("newHash");
            var href = location.href.replace(/[\?\&](code|state|wx_debug)=[^\&\?#]*/g, "") + newHash;
            sessionStorage.removeItem("newHash");
            self.locationChange(href,"replace");
        }
    },

    //微信Api注入权限
    initWxApi: function(callback,hadWxApi) {
        var self = this;
        this.getJson('/wx_web/getSignPack4JSApi').then(function(data) {
            wx.config({
                appId: data.appId,
                timestamp: data.timestamp,
                nonceStr: data.nonceStr,
                signature: data.signature,
                jsApiList: [
                    "onMenuShareTimeline",
                    "onMenuShareAppMessage"
                ]
            });

            self.isHadWxApi = true;
            sessionStorage.setItem("signature", data.signature);
            callback();

        }, function(err) {
            callback();
        })
    },

    //微信分享
    wxShare: function(share) {
        wx.ready(function() {
            wx.onMenuShareTimeline(share);
            wx.onMenuShareAppMessage(share);
        });
    },

    // get cookie
    getCookie: function(name) {
        if (document.cookie.length > 0) {
            var start = document.cookie.indexOf(name + "=");
            if (start != -1) {
                start = start + name.length + 1;
                var end = document.cookie.indexOf(";", start);
                if (end && end == -1) {
                    end = document.cookie.length;
                }
                return unescape(document.cookie.substring(start, end));
            }
        }
        return '';
    },

    // delete cookie
    delCookie: function(name) {
        var exp = new Date();
        exp.setTime(exp.getTime() - 1);
        var cval = this.getCookie(name);
        if (cval != '') document.cookie = name + "=" + cval + ";expires=" + exp.toGMTString();
    },

    //合并对象(以覆盖的形式合并对象，非深度合并)
    extend: function(target, source) {
        for (var p in source) {
            if (source.hasOwnProperty(p)) {
                target[p] = source[p];
            }
        }
        return target;
    },

    //ajax
    getJson: function(url, method, params, header) {
        var method = method ? method.toLocaleUpperCase() : 'GET';
        try {
            var isPromise = new Promise(function() {})
            return this.promiseAjax(method, url, params, header);
        } catch (e) {
            this.createPromise();
            return this.promiseAjax(method, url, params, header);
        }
    },

    //promiseAjax
    promiseAjax: function(method, url, params, header) {
        var paramsStr = '',
            urlReg = /^http[s]?:\/\//,
            admin = this.getParamByUrl("admin");
        var completeUrl = urlReg.test(url) ? url : (environmentConfig.baseUrl + url);
        var configHeader = {
            "content-type": "application/x-www-form-urlencoded;charset=utf-8"
        }
        var defaultPrefix = '?';

        header && this.extend(configHeader, header);

        if (configHeader['content-type'] && configHeader['content-type'].indexOf("application/json") > -1) {
            paramsStr = JSON.stringify(params);
        } else {
            for (var x in params) {
                
                paramsStr += "&" + x + "=" + params[x]
                
            }
            paramsStr = paramsStr.substring(1);
        }

        if (method == 'GET' && paramsStr) {
            if(/\?/.test(completeUrl)){
                defaultPrefix = '&';
            }
            completeUrl += defaultPrefix + paramsStr;
        }

        var promise = new Promise(function(resolve, reject) {
            var xmlhttp = new XMLHttpRequest();

            xmlhttp.onreadystatechange = function handler() {
                if (this.readyState !== 4) {
                    return;
                }
                if (this.status === 200) {
                    var data = JSON.parse(this.responseText);
                    //与微信相关的token_invalid处理
                    var reload_wx_wauth = sessionStorage.getItem("reload_wx_wauth");
                    //后台管理系统无需授权，但url上必须带参数admin=admin
                    if (data.token_invalid === false && admin != "admin") {
                        if (!reload_wx_wauth) {
                            localStorage.removeItem("sidnew");
                            localStorage.removeItem('authType');
                            sessionStorage.setItem("reload_wx_wauth", "1");
                            location.reload();
                        } else {
                            alert("微信授权失败，请退出后重新打开页面");
                        }
                    } else {
                        resolve(data);
                    }

                } else {
                    reject("服务器错误");
                }
            };

            xmlhttp.open(method, completeUrl, true);
            for (var h in configHeader) {
                if(!(method=="GET" && h=="content-type")){
                    xmlhttp.setRequestHeader(h, configHeader[h]);
                }
            }

            if (method == 'POST' && paramsStr) {
                xmlhttp.send(paramsStr);
            } else {
                xmlhttp.send();
            }
        });

        return promise;
    },

    //构造Promise
    createPromise: function() {
        (function(window, undefined) {
            var PENDING = undefined,
                FULFILLED = 1,
                REJECTED = 2;

            var isFunction = function(obj) {
                return 'function' === typeof obj;
            }
            var isArray = function(obj) {
                return Object.prototype.toString.call(obj) === "[object Array]";
            }
            var isThenable = function(obj) {
                return obj && typeof obj['then'] == 'function';
            }

            var transition = function(status, value) {
                var promise = this;
                if (promise._status !== PENDING) return;
                // 所以的执行都是异步调用，保证then是先执行的
                setTimeout(function() {
                    promise._status = status;
                    publish.call(promise, value);
                });
            }
            var publish = function(val) {
                var promise = this,
                    fn,
                    st = promise._status === FULFILLED,
                    queue = promise[st ? '_resolves' : '_rejects'];

                while (fn = queue.shift()) {
                    val = fn.call(promise, val) || val;
                }
                promise[st ? '_value' : '_reason'] = val;
                promise['_resolves'] = promise['_rejects'] = undefined;
            }

            var Promise = function(resolver) {
                if (!isFunction(resolver))
                    throw new TypeError('You must pass a resolver function as the first argument to the promise constructor');
                if (!(this instanceof Promise)) return new Promise(resolver);

                var promise = this;
                promise._value;
                promise._reason;
                promise._status = PENDING;
                promise._resolves = [];
                promise._rejects = [];

                var resolve = function(value) {
                    transition.apply(promise, [FULFILLED].concat([value]));
                }
                var reject = function(reason) {
                    transition.apply(promise, [REJECTED].concat([reason]));
                }

                resolver(resolve, reject);
            }

            Promise.prototype.then = function(onFulfilled, onRejected) {
                var promise = this;
                // 每次返回一个promise，保证是可thenable的
                return Promise(function(resolve, reject) {
                    function callback(value) {
                        var ret = isFunction(onFulfilled) && onFulfilled(value) || value;
                        if (isThenable(ret)) {
                            ret.then(function(value) {
                                resolve(value);
                            }, function(reason) {
                                reject(reason);
                            });
                        } else {
                            resolve(ret);
                        }
                    }

                    function errback(reason) {
                        reason = isFunction(onRejected) && onRejected(reason) || reason;
                        reject(reason);
                    }
                    if (promise._status === PENDING) {
                        promise._resolves.push(callback);
                        promise._rejects.push(errback);
                    } else if (promise._status === FULFILLED) { // 状态改变后的then操作，立刻执行
                        callback(promise._value);
                    } else if (promise._status === REJECTED) {
                        errback(promise._reason);
                    }
                });
            }

            Promise.prototype.catch = function(onRejected) {
                return this.then(undefined, onRejected)
            }

            Promise.prototype.delay = function(ms) {
                return this.then(function(val) {
                    return Promise.delay(ms, val);
                })
            }

            Promise.delay = function(ms, val) {
                return Promise(function(resolve, reject) {
                    setTimeout(function() {
                        resolve(val);
                    }, ms);
                })
            }

            Promise.resolve = function(arg) {
                return Promise(function(resolve, reject) {
                    resolve(arg)
                })
            }

            Promise.reject = function(arg) {
                return Promise(function(resolve, reject) {
                    reject(arg)
                })
            }

            Promise.all = function(promises) {
                if (!isArray(promises)) {
                    throw new TypeError('You must pass an array to all.');
                }
                return Promise(function(resolve, reject) {
                    var i = 0,
                        result = [],
                        len = promises.length;

                    function resolver(index) {
                        return function(value) {
                            resolveAll(index, value);
                        };
                    }

                    function rejecter(reason) {
                        reject(reason);
                    }

                    function resolveAll(index, value) {
                        result[index] = value;
                        if (index == len - 1) {
                            resolve(result);
                        }
                    }

                    for (; i < len; i++) {
                        promises[i].then(resolver(i), rejecter);
                    }
                });
            }

            Promise.race = function(promises) {
                if (!isArray(promises)) {
                    throw new TypeError('You must pass an array to race.');
                }
                return Promise(function(resolve, reject) {
                    var i = 0,
                        len = promises.length;

                    function resolver(value) {
                        resolve(value);
                    }

                    function rejecter(reason) {
                        reject(reason);
                    }

                    for (; i < len; i++) {
                        promises[i].then(resolver, rejecter);
                    }
                });
            }

            window.Promise = Promise;
        })(window)
    },

    //修改微信webview标题
    changeTitle: function(title) {
        document.title = title;
        var iframe = document.createElement('iframe');
        iframe.style.display = "none";
        iframe.width = '1';
        iframe.height = '1';
        iframe.src = "/favicon.ico";
        iframe.onload = function() {
            setTimeout(function() {
                document.body.removeChild(iframe);
            }, 0);
        };
        document.body.appendChild(iframe);
    },

    //代理统计配置接口  type  notice 代理人通知客户，share 代理人分享
    getAgentStatisticalConfig: function(type) {
        var self = this;
        this.getJson("/wx_vehicle_agent/getAgentStatisticalConfig?type=" + type)
            .then(function(data) {
                if (!data.success) {
                    return;
                }
                var params = data.ret;
                self.dataPost(params.marketing_id, params.user_id, params.user_from, params.event_id);
            })
    },

    //数据统计函数
    dataPost: function(market, wxid, from, event) {
        var url = "/webapi/public/marketing_access";
        var params = {
            "marketing_id": market,
            "user_id": wxid,
            "user_from": from,
            "event_id": event
        };
        this.getJson(url, 'post', { "params": JSON.stringify(params) })
    },

    //时间戳转时间
    formatTime: function(time, str, flag) {
        var str = str ? str : '.';
        var time = new Date(time).getTime(); //转成毫秒
        var year = new Date(time).getFullYear();
        var month = new Date(time).getMonth() + 1;
        var date = new Date(time).getDate();
        if (!flag) {
            return year + str + month + str + date;
        } else {
            return month + str + date;
        }
    },
    //时间戳转年月日时分秒
    formatTime2: function(time) {
        var time = new Date(time).getTime(); //转成毫秒
        var year = new Date(time).getFullYear();
        var month = new Date(time).getMonth() + 1;
        var date = new Date(time).getDate();
        var hour = new Date(time).getHours();
        var minute = new Date(time).getMinutes();
        var second = new Date(time).getSeconds();
        if (hour < 10) {
            hour = "0" + hour;
        }
        if (minute < 10) {
            minute = "0" + minute;
        }
        if (second < 10) {
            second = "0" + second;
        }

        return year + '.' + month + '.' + date + "   " + hour + ":" + minute + ":" + second;
    }
}

export default youyiche
