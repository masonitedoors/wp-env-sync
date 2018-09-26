const shell = require('shelljs');
const fetch = require('node-fetch');
const uuidv1 = require('uuid/v1');
const chalk = require('chalk');
const tempDir = require('temp-dir');
const Table = require('cli-table');

/**
 * Handles the syncing of WordPress environments.
 */
module.exports = class WPEnvSynchronizer {
	/**
	 * Setup the script arguments.
	 * @param {Object} options
	 */
	constructor(options) {
		this.uuid = uuidv1();
		this.project = options.project;
		this.dataURL = options.dataURL;
		this.prodName = options.prodName;
		this.tempDirectory = `${tempDir}/wp-env-sync-${this.uuid}`;
		this.initialized = false;
	}

	/**
	 * Initialize the application & handle async construction.
	 */
	async init() {
		if (!this.initialized) {
			const data = await this.getProjectData(this.project);

			this.prodEnv = await (data.env.filter(obj => obj.name === this.prodName))[0];
			this.lowerEnvs = await data.env.filter(obj => obj.name !== this.prodName);
			this.type = await data.type;
			this.isMultisite = await this.isMultisite();

			// Exit if target project is not WordPress.
			if (this.type !== 'wordpress' && this.type !== 'wordpress-multisite') {
				console.error(chalk`{red Error}: Project is not of type wordpress or wordpress-multisite`);
				process.exit(1);
			}

			// Exit if project has no lower environments.
			if (this.lowerEnvs.length === 0) {
				console.error(chalk`{red Error}: Project must have at least 1 lower environment`);
				process.exit(1);
			}

			// Exit if errors.
			shell.set('-e');

			this.initialized = true;
		}
	}

	/**
	 * Return the endpoint object for the target project.
	 * @param {String} project The target project's slug.
	 * @return {Object}
	 */
	async getProjectData(project) {
		const url = this.dataURL;
		const response = await fetch(url).catch(() => {
			console.error(chalk`{red Error}: Could not fetch projects endpoint.`);
			process.exit(1);
		});
		const data = await response.json();
		const projectData = await data.filter(obj => obj.slug === project);
		const noProjectData = !Object.keys(projectData).length;

		if (noProjectData) {
			console.error(chalk`{red Error}: No data exists for this project.`);
			process.exit(1);
		}

		return projectData[0];
	}

	/**
	 * Display info about the sync job.
	 */
	async printSyncInfo() {
		await this.init();

		const table = new Table({
			head : [
				chalk`{gray env}`,
				chalk`{gray url}`,
				chalk`{gray ssh}`,
			],
		});

		// Production environment.
		table.push({
			[chalk`{green ${this.prodEnv.name}}`] : [
				chalk`{green ${this.prodEnv.url}}`,
				chalk`{green ${this.prodEnv.ssh}}`,
			],
		});

		// Lower environments.
		this.lowerEnvs.forEach((env) => {
			table.push({
				[chalk`{white ${env.name}}`] : [
					chalk`{white ${env.url}}`,
					chalk`{white ${env.ssh}}`,
				],
			});
		});

		console.log(chalk`\nFound {green ${this.lowerEnvs.length}} lower environments to be synced with {magenta ${this.prodName}} environment.\n`);
		console.log(chalk`Temp directory: {green ${tempDir}}\n`);
		console.log(`${table.toString()}\n`);
	}

	/**
	 * Run the sync script.
	 */
	async sync() {
		await this.init();
		await this.printSyncInfo();
		await this.createTempDir();
		await this.getProdContent();
		this.lowerEnvs.forEach(async (env) => {
			await this.syncLowerEnv(env);
		});
		await this.removeTempDir();
	}

	/**
	 * Download content from the production environment.
	 */
	getProdContent() {
		// SSH into prod and dump database.
		shell.exec(`
			ssh ${this.prodEnv.ssh} "cd ${this.prodEnv.public_path};
			wp db export --add-drop-table ${this.prodEnv.private_path}/wp-env-sync-${this.uuid}.sql --color;"
		`);

		// Download prod database.
		shell.exec(`
			scp ${this.prodEnv.ssh}:${this.prodEnv.private_path}/wp-env-sync-${this.uuid}.sql ${this.tempDirectory}
		`);

		// Download prod uploads folder.
		shell.exec(`
			rsync -chavzP --stats ${this.prodEnv.ssh}:${this.prodEnv.public_path}/wp-content/uploads ${this.tempDirectory}
		`);

		// SSH into prod and Clean up database dump.
		shell.exec(`
			ssh ${this.prodEnv.ssh} "cd ${this.prodEnv.private_path};
			rm ${this.prodEnv.private_path}/wp-env-sync-${this.uuid}.sql;"
		`);
	}

	/**
	 * Sync a lower environment.
	 * @param {Object} env The current environment's object.
	 */
	syncLowerEnv(env) {
		const networkFlag = (this.isMultisite ? ' --network' : '');
		const rewriteFlush = (this.isMultisite ? '' : 'wp rewrite flush --hard --color;');

		// Upload prod database to current environment.
		shell.exec(`
			scp ${this.tempDirectory}/wp-env-sync-${this.uuid}.sql ${env.ssh}:${env.private_path}
		`);

		// Import prod database dump to current environment.
		shell.exec(`
			ssh ${env.ssh} "cd ${env.public_path};
			wp db import ${env.private_path}/wp-env-sync-${this.uuid}.sql --color;"
		`);

		// Replace production url with current environment.
		shell.exec(`
			ssh ${env.ssh} "cd ${env.public_path};
			wp search-replace ${this.prodEnv.url} ${env.url} --skip-tables=wp_users --all-tables-with-prefix${networkFlag} --color;
			wp search-replace ${this.prodEnv.url} ${env.url} --skip-tables=wp_users --all-tables-with-prefix${networkFlag} --color;"
		`);

		// Perform any additional replacements within the database.
		if (env.search_replace) {
			env.search_replace.forEach((item) => {
				shell.exec(`
					ssh ${env.ssh} 'cd ${env.public_path};
					wp search-replace "${item[0]}" "${item[1]}" --skip-tables=wp_users --all-tables-with-prefix${networkFlag} --color;
					wp search-replace "${item[0]}" "${item[1]}" --skip-tables=wp_users --all-tables-with-prefix${networkFlag} --color;'
				`);
			});
		}

		// Update options.
		if (env.options) {
			env.options.forEach((item) => {
				const option = item[0];
				const value = item[1].replace(/(\s+)/g, '\\$1');
				const sites = item[2];

				if (sites) {
					sites.forEach((site) => {
						shell.exec(`
							ssh ${env.ssh} 'cd ${env.public_path};
							wp option update "${option}" "${value}" --url=${site} --color;'
						`);
					});
				} else {
					shell.exec(`
						ssh ${env.ssh} 'cd ${env.public_path};
						wp option update "${option}" "${value}" --color;'
					`);
				}
			});
		}

		// Update site options (multisite).
		if (env.options) {
			env.options.forEach((item) => {
				const option = item[0];
				const value = item[1].replace(/(\s+)/g, '\\$1');

				shell.exec(`
					ssh ${env.ssh} 'cd ${env.public_path};
					wp site option update "${option}" "${value}" --color;'
				`);
			});
		}

		shell.exec(`
			ssh ${env.ssh} "cd ${env.public_path};
			wp cache flush --color;
			${rewriteFlush}"
		`);

		shell.exec(`
			ssh ${env.ssh} "cd ${env.public_path};
			rm -rf wp-content/uploads;"
		`);

		shell.exec(`
			scp -r ${this.tempDirectory}/uploads ${env.ssh}:${env.public_path}/wp-content
		`);

		shell.exec(`
			ssh ${env.ssh} "rm ${env.private_path}/wp-env-sync-${this.uuid}.sql;"
		`);

		console.log(chalk`{green Success}: Done syncing ${env.name}.`);
	}

	/**
	 * Create temporary directory on host to store production content.
	 */
	createTempDir() {
		shell.mkdir('-p', this.tempDirectory);
	}

	/**
	 * Delete the temporary directory.
	 */
	removeTempDir() {
		shell.rm('-rf', this.tempDirectory);
	}

	/**
	 * Check if current project is a WordPress multisite.
	 * @return {Boolean}
	 */
	isMultisite() {
		if (this.type === 'wordpress-multisite') {
			return true;
		}
		return false;
	}
};
