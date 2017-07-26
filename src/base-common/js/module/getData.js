import createPromise from './createPromise.js'

var ajaxObject = {};

Object.defineProperty(ajaxObject, "length", {
    writable: true,
    value: 0
});

/**
 *ajaxObject对象是否拥有某个属性
 *@param {String} url 原始url(用于比较)
 *@return {Object} 获取到的ajaxObject对象属性
 */
function hasAjaxObjectItem(url){
    for(var i in ajaxObject){
        if(ajaxObject[i].url==url){
            return ajaxObject[i];
        }
    }
    return null;
}

/**
 *创建ajaxObject对象属性
 *@param {String} url 原始url 
 *@param {String} 请求的自定义类型
 *@return {Object} xmlhttp
 */
function createAjaxObjectItem(url,type,xmlhttp){
    var property = "item";
    ajaxObject.length++;

    property+=ajaxObject.length;
    ajaxObject[property] = {
        url:url,
        state:"pending"
    }
    //"last"类型增加xmlhttp对象，以方便调用abort方法
    type=="last" && (ajaxObject[property].xmlhttp = xmlhttp);
    return ajaxObject[property];
}

/**
 *配置ajax请求的url
 *@param {String} url 原始url 
 *@param {Object} youyiche 传递进来的youyiche对象
 *@return {String} 修改后的url
 */
function configAjaxUrl(url,youyiche){
    var urlReg = /^http[s]?:\/\//;
    var completeUrl = urlReg.test(url) ? url : (youyiche.publicParams.apiUrl + url);
    return completeUrl;
}

/**
 *配置ajax请求时传递的参数信息
 *@param {Object} data json对象
 *@param {String} contentType ajax请求header中的content-type参数
 *@return {String} 参数处理后的字符串形式
 */
function configAjaxData(data,contentType){
    var dataStr = "";

    if (contentType.indexOf("application/json") > -1){
        dataStr = JSON.stringify(data);
    } else {
        for (var x in data) {
            dataStr += "&" + x + "=" + data[x]
        }
        dataStr = dataStr.substring(1);
    }
    return dataStr;
}

/**
 *判断浏览器是否支持promise对象，不支持则创建
 */
function hadPromise(){
    try {
        var isPromise = new Promise(function() {})
    } catch (e) {
        createPromise();
    }
}

/**
 *ajax请求status错误处理(目前仅处理token验证相关401和403)
 *@param {Number} status http请求状态码
 *@param {Function} reject promise中的reject参数
 *@param {Object} youyiche 传递进来的youyiche对象
 */
function ajaxErrorHandle(status,reject,youyiche){
    if(status==401 || status==403){
        var reloadWxAuth = sessionStorage.getItem("reloadWxAuth");
        if (!reloadWxAuth) {
            localStorage.removeItem(youyiche.publicParams.wxAccessTokenName);
            localStorage.removeItem(youyiche.publicParams.authTypeName);
            sessionStorage.setItem("reloadWxAuth", "1");
            location.reload();
        } else {
            alert("授权失败，请退出后重新打开页面");
        }
    }
    reject(status);
}

/**
 *相同请求的处理
 *@param {Object} options 配置参数
 *@param {Boolean} 返回结果用于判断是否发送本次请求
 */
function sameAjaxHandler(options){
    if(options.item.state=="error"){
        options.item.state = "pending";
        return true;
    }

    options.method=="POST" && (options.type = "exclusive");//post请求都是独占型

    switch (options.type) {
        case "exclusive": //独占型(必须等待上一次请求返回结果后才能再次发送请求)
            if(options.item.state=="pending"){
                return false;
            }else{
                options.item.state = "pending";
                return true;
            }
        case "last"://最新型(取最后一次请求的结果，前面的未完成请求abort掉)
            options.item.state=="pending" && options.item.xmlhttp.abort();
            options.item.state = "pending";
            options.item.xmlhttp = options.xmlhttp;
            return true;
        case "once"://一次型(返回前一次请求的数据，忽略所有once类型的请求)
            options.item.state=="end" && options.resolve(options.item.data);
            return false;
        default:
            return true;
    }
}

/**
 *封装ajax请求到promise内
 *@param {Object} config ajax请求的配置参数
 *@param {Object} youyiche 传递进来的youyiche对象
 *@return {Promise} 返回promise对象
 */
function ajaxPromise(config,youyiche){
    var promise = null;
    hadPromise();
    promise = new Promise(function(resolve, reject){
        var xmlhttp = new XMLHttpRequest();
        var originalUrl = config.url;
        var item,result;

        if(config.howDoWithSameAjax!="default"){//排除"default"
            item = hasAjaxObjectItem(originalUrl);
            if(!item){
                item = createAjaxObjectItem(originalUrl,config.howDoWithSameAjax,xmlhttp);
            }else{
                result = sameAjaxHandler({
                    type:config.howDoWithSameAjax,
                    item:item,
                    xmlhttp:xmlhttp,
                    method:config.method,
                    resolve:resolve
                });
                if(!result){
                    return;
                }
            }
        }

        xmlhttp.timeout = config.timeout;

        xmlhttp.onreadystatechange = function() {
            if (this.readyState !== 4) {
                return;
            }
            if (this.status === 200) {
                var data = JSON.parse(this.responseText);
                resolve(data);
                if(config.howDoWithSameAjax!="default"){//排除"default"
                    item.state = "end";
                    config.howDoWithSameAjax=="once" && (item.data = data);
                }
            } else {
                ajaxErrorHandle(this.status,reject,youyiche);
                config.howDoWithSameAjax!="default" && (item.state = "error");//排除"default"
            }
        };

        xmlhttp.ontimeout = function(){
            config.timeoutEvent && config.timeoutEvent();
        }

        xmlhttp.onabort = function(){
            config.abortEvent && config.abortEvent();
        }

        xmlhttp.open(config.method, config.url, true);

        for (var h in config.headers) {
            if(!(config.method=="GET" && h=="content-type")){
                xmlhttp.setRequestHeader(h, config.headers[h]);
            }
        }

        if(config.withCredentials){
            xmlhttp.withCredentials = true;
        }
         
        if (config.method == 'POST' && config.data) {
            xmlhttp.send(config.data);
        } else {
            xmlhttp.send();
        }
    });

    return promise;
}

/**
 *ajax获取数据
 *@param {Object} youyiche 传入youyiche对象
 *@param {Object} config ajax配置信息
 *@param {Boolean} isSendToken 是否发送token信息
 *@return {Promise} 返回promise对象
 */
function getData(youyiche,config,isSendToken){
    var completeConfig = {
        method:config.method ? config.method.toLocaleUpperCase() : 'GET',
        headers:youyiche.extend({"content-type": "application/x-www-form-urlencoded;charset=utf-8"},config.headers),
        url:configAjaxUrl(config.url,youyiche),
        data:config.data || null,
        withCredentials:config.withCredentials || false,
        timeout:config.timeout || 0,
        timeoutEvent:config.timeoutEvent,
        abortEvent:config.abortEvent,
        howDoWithSameAjax:config.howDoWithSameAjax||"default" //["default","exclusive","last","once"]
    }

    var defaultPrefix = '?';

    var wxAccessToken = localStorage.getItem(youyiche.publicParams.wxAccessTokenName);
    var headerTokenName = youyiche.publicParams.headerTokenName;
   
    completeConfig.data = configAjaxData(completeConfig.data,completeConfig.headers["content-type"]);

    if (completeConfig.method == 'GET' && completeConfig.data) {
        if(/\?/.test(completeConfig.url)){
            defaultPrefix = '&';
        }
        completeConfig.url += defaultPrefix + completeConfig.data;
    }

    if(isSendToken){
        completeConfig.headers[headerTokenName] = wxAccessToken;
    }

    return ajaxPromise(completeConfig,youyiche);
}


export default getData