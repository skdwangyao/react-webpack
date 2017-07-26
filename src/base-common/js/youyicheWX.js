import youyiche from './youyiche.js'

var youyicheWX = {
    /**
     *微信操作相关属性
     */
    wxGlobal:{
        appid:"",//微信号appId
        signature:""//签名 (微信支付调用ping++等使用)
    },
    /**
     *微信相关api
     */
    apiUrl:{
        jsSDKPublic:'/wxInfoApi/getJsSign',//公众号微信js sdk权限验证
        jsSDKCompany:'/qyWxMessageApi/getJsSign',//企业号微信js sdk权限验证
        authPublic:'/wxInfoApi/oauth',//公众号号获取token
        authCompany:'/qyWxMessageApi/oauthAgent',//企业号获取token
        authDBtool:'/qyWxMessageApi/oauth',//dbtool项目专用获取token
    },

    /**
     *通过微信JS SDK的config接口注入权限验证配置
     *@param {String} appType 获取权限验证的公众号类型
     *@param {Function} callback [optional] 权限验证成功后的回调函数
     */
    wxConfig: function(appType,callback) {
        var self = this;
        var wxUrl = environmentConfig.apiUrl.wx;
        var afterGetData = function(data){
            wx.config({
                appId: data.data.appId,
                timestamp: data.data.timestamp,
                nonceStr: data.data.nonceStr,
                signature: data.data.signature,
                jsApiList: [
                    "onMenuShareTimeline",
                    "onMenuShareAppMessage",
                    "openLocation",
                    "getLocation"
                ]
            });
            self.wxGlobal.appid = data.data.appId;
            self.wxGlobal.signature = data.data.signature;
            callback && callback();
        }

        wxUrl += appType=="public"?self.apiUrl.jsSDKPublic:self.apiUrl.jsSDKCompany;


        if(process.env.NODE_ENV=="dev"){
            callback && callback();
        }else{
            youyiche.getData({
                url:wxUrl,
            },false).then(function(data){
                afterGetData(data);
            },function(err){
                alert("获取微信权限验证配置失败");
            })
        }
    },

    /**
     *微信认证
     *@param {Object} config 认证函数的参数配置
     */
    wxAuth: function(config) {
        var self = this;
        var urlParams = youyiche.getParamAllByUrl();
        var authConfig = {
            type:config.type || "snsapi_base", //微信认证类型["snsapi_userinfo","snsapi_base"]
            appType:"public", //获取权限验证的公众号类型，默认公众号
            itemName:config.itemName || "", //项目名称(与配置文件environmentConfig.js配合使用)
            success:config.success || function(){}, //认证成功后的回调
            agentid:"",//应用id
            apiUrl : environmentConfig.apiUrl.base,//api地址
        };
        var wxAccessTokenName = 'WxAccessToken',
            authTypeName = 'AuthType',
            localStorageWX = {};

        if(authConfig.itemName && environmentConfig[authConfig.itemName]){
            authConfig.appType = environmentConfig[authConfig.itemName].appType || authConfig.appType;
            authConfig.agentid = environmentConfig[authConfig.itemName].agentid || authConfig.agentid;
            authConfig.apiUrl = environmentConfig[authConfig.itemName].apiUrl || authConfig.apiUrl;
        }

        wxAccessTokenName = authConfig.appType+wxAccessTokenName+authConfig.agentid;
        authTypeName = authConfig.appType+authTypeName+authConfig.agentid;

        //创建youyiche.publicParams公共参数
        configYouyichePublicParams();
        
        if (urlParams.wx_debug) {
            localStorage.removeItem(wxAccessTokenName);
            localStorage.removeItem(authTypeName);
        }

        //超级代理人略过认证
        if(urlParams.superToken){
            localStorage.setItem(wxAccessTokenName,urlParams.superToken);
            localStorage.setItem(authTypeName,'snsapi_userinfo');
        }
        
        localStorageWX[wxAccessTokenName] = localStorage.getItem(wxAccessTokenName) || "";
        localStorageWX[authTypeName] = localStorage.getItem(authTypeName) || "";

        self.wxConfig(authConfig.appType,function(){
            hasToken(authConfig.success,authConfig.type);
        })

        /**
         *配置youyiche模块公用参数
         */
        function configYouyichePublicParams(){
            youyiche.publicParams.baseUrl = environmentConfig.apiUrl.base;
            youyiche.publicParams.apiUrl = authConfig.apiUrl;
            youyiche.publicParams.wxAccessTokenName = wxAccessTokenName;
            youyiche.publicParams.authTypeName = authTypeName;
            youyiche.publicParams.headerTokenName = authConfig.appType=="public"?"X-WxAccess-Token":"X-QyWxAccess-Token";

            for(var i in environmentConfig){
                if(i!="apiUrl"){
                    youyiche.publicParams.apiService[i] = environmentConfig[i].apiUrl || environmentConfig.apiUrl.base;
                }
            }
        }

        /**
         *判断是否有token
         *@param {Function} callback 如果不需要认证则直接callback
         *@param {String} type 认证方式
         */
        function hasToken(callback,type){
            if ((urlParams.admin || process.env.NODE_ENV=="dev") && !localStorageWX[wxAccessTokenName]) { //开发模式略过微信认证直接获取token
                getToken("snsapi_userinfo");
                return;
            }
            if(localStorageWX[wxAccessTokenName]){
                if(type!="snsapi_userinfo" || localStorageWX[authTypeName]=="snsapi_userinfo"){
                    callback();
                }else{
                    authPrecess(type);
                }
            }else{
                authPrecess(type);
            }
        }

        /**
         *认证流程
         *@param {String} type 认证方式
         */
        function authPrecess(type){
            if(!urlParams.state){
                authRequest(type);
            }else{
                if(urlParams.code){
                    getToken(type,urlParams.code);
                }else{
                    alert("授权失败，请退出后重新打开页面");
                }
            }
        }

        /**
         *请求微信认证
         *@param {String} newUrl 认证成功后的跳转地址
         *@param {String} type 认证方式
         */
        function authRequest(type) {
            var url = "http://"+location.host+location.pathname+location.search;
            var hash = location.hash || '';

            var redirect_uri = encodeURIComponent(url),
                response_type = 'code',
                scope = type,
                state = type,
                wechat = 'wechat_redirect',
                appid = self.wxGlobal.appid,
                wx_href;

            sessionStorage.setItem("hash",hash);

            wx_href = 'https://open.weixin.qq.com/connect/oauth2/authorize?appid=' + appid + '&redirect_uri=' + redirect_uri + '&response_type=' + response_type + '&scope=' + scope + '&state=' + state + '#' + wechat;
            
            youyiche.locationChange(wx_href,"replace");
        }

        /**
         *获取token并保存至localStorage中
         *@param {String} type 认证方式
         *@param {String} code 通过微信认证后获取的code
         */
        function getToken(type,code) {
            var params = {};
            var tokenUrl = environmentConfig.apiUrl.wx

            tokenUrl += authConfig.appType=="public"?self.apiUrl.authPublic:self.apiUrl.authCompany;

            if(authConfig.itemName && authConfig.itemName=="itemGroundStaff"){
                tokenUrl = environmentConfig.apiUrl.wx+self.apiUrl.authDBtool;
            }

            if(authConfig.appType=="public"){
                params.scope = type;
            }else{
                params.agentid = authConfig.agentid;
            }

            if(urlParams.admin||process.env.NODE_ENV=="dev"){//开发模式
                params.env = "dev"
            }else{
                params.code = code;
            }
            
            youyiche.getData({
                url:tokenUrl,
                data:params
            },false).then(function(data){
                var headerTokenName = youyiche.publicParams.headerTokenName;
                if(data && data.data[headerTokenName]){
                    localStorage.setItem(wxAccessTokenName, data.data[headerTokenName]);
                    if(!localStorageWX[authTypeName] || localStorageWX[authTypeName]=="snsapi_base"){
                        localStorage.setItem(authTypeName, type);
                    }
                    //sessionStorage中的'reloadWxAuth'由'./module/getData.js'中的ajaxErrorHandle方法设置
                    sessionStorage.removeItem("reloadWxAuth");
                    redirect(params);
                }else{
                    alert("获取token失败");
                }
            },function(errStatus){
                alert("get token:faild");
            })
        }

        /**
         *获取token后删除url上的微信认证后回传的参数并跳转至新url上
         */
        function redirect(params){
            var search = location.search.replace(/[\?\&](code|state|wx_debug)=[^\&\?#]*/g, "").replace(/^&/,"?");
            var hash = sessionStorage.getItem("hash") || location.hash;
            var redirectUri,time;
            if(params.env){
                time = new Date().getTime();
                search = youyiche.changeParamByUrl("env",time,search);
            }

            redirectUri = "http://"+location.host+location.pathname+search+hash;
            sessionStorage.removeItem("hash");
            youyiche.locationChange(redirectUri,"replace");
        }
    },

    /**
     *微信分享
     *@param {Object} shareConfig 微信分享配置
     */
    wxShare: function(shareConfig) {
        wx.ready(function() {
            wx.onMenuShareTimeline(shareConfig);
            wx.onMenuShareAppMessage(shareConfig);
        });
    },

    /**
     *微信获取地理位置
     *@param {Function} callback [optional] 成功后的回调
     *@param {String} type [optional] 获取的坐标类型
     */
    wxGetLocation: function(callback,type) {
        wx.ready(function() {
            wx.getLocation({
                type: type || 'wgs84', // 默认为wgs84的gps坐标，如果要返回直接给openLocation用的火星坐标，可传入'gcj02'
                success: function (res) {
                    var position = {
                        latitude: res.latitude, // 纬度，浮点数，范围为90 ~ -90
                        longitude: res.longitude // 经度，浮点数，范围为180 ~ -180。
                    }
                    callback && callback(position);
                },
                cancel:function(res){
                    callback && callback({});
                }
            });
        });
    },

    /**
     *使用微信内置地图查看位置
     *@param {Object} config 微信地图配置信息
     */
    wxOpenLocation: function(config) {
        var locationConfig = {
            latitude: 0, // 纬度，浮点数，范围为90 ~ -90
            longitude: 0, // 经度，浮点数，范围为180 ~ -180。
            name: '', // 位置名
            address: '', // 地址详情说明
            scale: 28, // 地图缩放级别,整形值,范围从1~28。默认为最大
            infoUrl: '' // 在查看位置界面底部显示的超链接,可点击跳转
        }
        youyiche.extend(locationConfig,config);
        wx.openLocation(locationConfig);
    }
}

export default youyicheWX
