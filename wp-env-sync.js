#!/usr/bin/env node

const program = require('commander');
const app = require('./lib/app');
const WPEnvSynchronizer = require('./lib/class-wp-env-synchronizer.js');

const run = async () => {
	if (!program.url || !program.prod || !program.project) {
		console.error('\n  error: --url, --prod, & --project are required\n');
		process.exit(1);
	}

	const wpes = new WPEnvSynchronizer({
		dataURL  : program.url,
		prodName : program.prod,
		project  : program.project,
	});

	if (program.dryRun) {
		await wpes.printSyncInfo();
		process.exit(0);
	}

	wpes.sync();
};

program
	.version(app.version)
	.description(app.description)
	.option('--url <url>', 'url for the projects endpoint')
	.option('--prod <name>', 'name of the production environment')
	.option('--project <project>', 'target project')
	.option('--dry-run', 'mock run sync job')
	.action(() => run())
	.parse(process.argv);
