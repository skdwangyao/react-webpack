var path = require('path');
var webpack = require('webpack');
var ROOT_PATH = path.resolve(__dirname);
var APP_PATH = path.resolve(ROOT_PATH, 'app');
var BUILD_PATH = path.resolve(ROOT_PATH, 'build');
var autoprefixer = require('autoprefixer');
var htmlWebpackPlugin =  require('html-webpack-plugin');
var extractTextWebpackPlugin = require("extract-text-webpack-plugin");
var argv = require('minimist')(process.argv.slice(2));

var itemName = process.env.ITEM_NAME || argv["ITEM_NAME"] || "";

try {
    var serverConfig = require("./server.config.js");
} catch(e){
    var serverConfig = null;
}

var host = "localhost",port = "8080";

if(serverConfig && serverConfig[itemName]){
    host = serverConfig[itemName].host || host;
    port = serverConfig[itemName].port || port;
}

module.exports = {
    devtool: 'cheap-module-eval-source-map',
    entry: {
      index: ['./src/' + itemName + '/jsx/index.jsx']

    },
    output: {
        path: './dist/' + itemName + '/',
        filename: 'js/[name].js',
        publicPath: '/'
    },
    module: {
        loaders: [
            {
              test: /\.(js|jsx)$/,
              loader: "babel",
              query:
                {
                  presets:['react','es2015']
                }
            }, 
            {test: /\.(css|scss)$/, loader: extractTextWebpackPlugin.extract('style','css!sass')},
            {test: /\.(png|jpg)$/,loader: 'url?limit=40000'}
        ]
    },
    resolve:{
        extensions:['','.js','.json']
    },
    devServer: {
        hot: true,
        host: host,
        inline: true,
        port: port,
    },
    plugins: [
        new htmlWebpackPlugin({
            filename: 'index.html',
            template: './src/'+ itemName +'/index.html',
            inject: true,
            hash: true,
            minify: {
                removeComments: true, //移除HTML中的注释
                collapseWhitespace: false //删除空白符与换行符
            }
        }),
        new webpack.optimize.DedupePlugin(),
        new webpack.optimize.UglifyJsPlugin(),
        // new webpack.NoErrorsPlugin(),
        new webpack.HotModuleReplacementPlugin(),
        new extractTextWebpackPlugin("css/[name].css")
    ]
};