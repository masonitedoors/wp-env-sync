const appRoot = require( 'app-root-path' );
const packagejson = require( '../package.json' );

const app = {
	name        : 'WP Env Sync',
	author      : 'Masonite International Corporation',
	authorLink  : 'https://www.masonite.com/',
	root        : appRoot,
	license     : packagejson.license,
	description : packagejson.description,
	version     : packagejson.version,
	copyright   : `Copyright ${( new Date() ).getFullYear()}`,
};

module.exports = app;
