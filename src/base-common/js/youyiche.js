import getData from './module/getData.js'

var youyiche = {

    /*公共参数*/
    publicParams: {
        hostPro:['b.youyiche.com'],//生产环境host
        configFile:{//配置文件名
            dev:'js/environmentConfig.js',//开发
            uat:'/WxWeb/config/environmentConfigUat.js',//测试(youyiche_wx_build库)
            pro:'/WxWeb/config/environmentConfigPro.js' //生产(youyiche_wx_build库)
        },
        baseUrl:"",//base域名地址(由youyicheWX.wxAuth创建)
        apiUrl:"", //当期项目api域名地址(由youyicheWX.wxAuth创建)
        apiService:{}, //其它项目提供的开放api域名(由youyicheWX.wxAuth创建)
        wxAccessTokenName:"",//项目token存储名称(由youyicheWX.wxAuth创建)
        authTypeName:"",//微信认证方式存储名称(由youyicheWX.wxAuth创建)
        headerTokenName:""//请求header token参数名称
    },

    /**
     *获取url上的参数值
     *@param {Boolean} hasHash 是否获取location.hash后跟的参数
     *@return {Object} 以对象的形式返回所有参数值
     */
    getParamAllByUrl: function(hasHash) {
        var search = location.search.substring(1),
            hashSearch = location.hash.split("?"),
            ret={},
            hasHashBoolean = hasHash===undefined?true:hasHash,//默认获取location.hash后跟的参数
            paramsArr,
            param;

        if(hashSearch[1] && hasHashBoolean){
            search = search?(search+"&"+hashSearch[1]):hashSearch[1];
        }

        paramsArr = search.split("&");

        for(var i=0;i<paramsArr.length;i++){
            param = paramsArr[i].split("=");
            if(param[1]=="undefined"){
                param[1] = undefined;
            }else if(param[1]=="null"){
                param[1] = null;
            }
            ret[param[0]] = param[1];
        }
        return ret;
    },

    /**
     *获取url上指定的参数值
     *@param {String} name url上的参数key
     *@param {String} hasHash 是否从location.hash上查找
     *@return {String || undefined || null} 获取到的参数value
     */
    getParamByUrl: function(name,hasHash) {
        var params = this.getParamAllByUrl(hasHash);
        if(params.hasOwnProperty(name)){
            return params[name];
        }else{
            return undefined;
        }
    },

    /**
     *修改location.search上指定的参数值(若没有，则创建)
     *@param {String} name url上的参数key
     *@param {String} value url上的参数value
     *@param {String} search location.search(有可能是在已更改过的search修改)
     *@return {String} 新的search
     */
    changeParamByUrl: function(name,value,search) {
        var param = this.getParamByUrl(name,false);
        var search = search===undefined?location.search:search;
        var reg = new RegExp(name+"=[^\\&\\?#]*");
        var newParam = name+"="+value;
        if(param){
            search = search.replace(reg, newParam);
        }else{
            search = search?(search+"&"+newParam):"?"+newParam;
        }
        return search;
    },

    /**
     *页面跳转(偶尔会出现location对象还未创建的情况，所以做延迟跳转)
     *@param {String} url 跳转到的url
     *@param {String} type [optional] 跳转方式
     *       {仅可选"replace",默认直接更改location.href值}
     */
    locationChange:function(url,type){
        setTimeout(function(){
            if(type=="replace"){
                location.replace(url);
            }else{
                location.href = url;
            }
        },30)
    },

    /**
     *合并对象(非深度合并)
     *@param {Object} target 原始对象(会被修改)
     *@param {Object} source 需合并的对象(不会被修改)
     *@return {Object} 返回合并后的原始对象target    
     */
    extend: function(target, source) {
        for (var p in source) {
            if (source.hasOwnProperty(p)) {
                target[p] = source[p];
            }
        }
        return target;
    },

    /**
     *获取指定的cookie值
     *@param {String} name 需要获取的cookie
     *@return {String} 获取到的cookie value 
     */
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

    /**
     *删除指定的cookie
     *@param {String} name 需要删除的cookie
     *@return {String} 删除的cookie value 
     */
    delCookie: function(name) {
        var exp = new Date();
        exp.setTime(exp.getTime() - 1);
        var cval = this.getCookie(name);
        if (cval != '') {
            document.cookie = name + "=" + cval + ";expires=" + exp.toGMTString();
        }
        return cval;
    },

    /**
     *动态加载environmentConfig.js
     *@param {Function} callback [optional] 回调函数
     */
    scriptConfig:function(callback){
        var head= document.getElementsByTagName('head')[0]; 
        var script= document.createElement('script'); 
        var timeStamp = new Date().getTime();
        var url = this.publicParams.configFile;
        var src = url.dev;

        if(process.env.NODE_ENV=='build'){
            src = url.uat;
            for(var i in this.publicParams.hostPro){
                if(location.host==this.publicParams.hostPro[i]){
                    src = url.pro;
                }
            }
        }

        script.type= 'text/javascript'; 
        script.src= src+'?timeStamp='+timeStamp; 
        head.appendChild(script); 
        script.onload= function(){ 
            callback && callback();
        }
    },

    /**
     *获取数据
     *@param {Object} config ajax配置信息
     *@param {Boolean} isSendToken 是否发送token信息
     *@return {Promise} 返回promise对象
     */
    getData:function(config,isSendToken){
        var send = isSendToken===false?false:true;
        return getData(this,config,send);
    },

    /**
     *修改webview内页面标题
     *@param {String} title 修改后的标题
     */
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

    /**
     *时间转换方法
     *@param {String || Number} time 时间(毫秒)
     *@param {String} type [optional] 确定返回类型(可选"object"或者"string")
     *@param {String} separator [optional] 当type="string",年月日分隔符
     *@param {Boolean} hasEveryMinute [optional] 当type="string",是否包含时分秒
     *@return {Object || String} 根据type参数返回不同内容
     */
    formatTime: function(time, type, separator, hasEveryMinute) {
        var dateObject = new Date(parseInt(time));
        var ret = {
            year : dateObject.getFullYear(),
            month : dateObject.getMonth() + 1,
            date : dateObject.getDate(),
            hour : dateObject.getHours(),
            minute : dateObject.getMinutes(),
            second : dateObject.getSeconds()
        }
        var defaultType = type || "object";
        var defaultSeparator = separator || "-";
        var defaultHasEveryMinute = hasEveryMinute===false?false:true;
        var retStr,everyMinute;

        for(var i in ret){
            if(i!="year" && ret[i]<10 && defaultType=="string"){
                ret[i]="0"+ret[i];
            }else{
                ret[i]=ret[i];
            }
        }
        
        retStr = ret.year + defaultSeparator + ret.month + defaultSeparator + ret.date;
        everyMinute = ret.hour + ":" + ret.minute + ":" + ret.second;

        if(defaultHasEveryMinute){
            retStr += " " + everyMinute;
        }

        if(type=="object"){
            return ret;
        }else{
            return retStr;
        }
    },

    /**
     *获取星期几
     *@param {String || Number} time 时间(毫秒)
     *@return {String} 返回字符串
     */
    getDayOfWeek: function(time) {
        var day = new Date(time).getDay();
        var dayChinese = ["日","一","二","三","四","五","六"];
        var ret = "星期"+dayChinese[day];
        
        return ret;
    }
}

export default youyiche
