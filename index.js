/* eslint-disable global-require, import/no-dynamic-require, max-classes-per-file */

'use strict';

/**
 * Tries to load an instantiate a module
 * @method loadModule
 * @param  {String|Object}   config Something that can define the module name to instantiate
 * @return {Object}                 Instantiated plugin
 */
function loadModule(config) {
    let c = config;

    if (typeof c === 'string') {
        c = {
            name: c,
            alias: c,
            config: {}
        };
    } else if (!c.alias) {
        c.alias = c.name;
    }

    try {
        const Obj = require(c.name);

        return {
            obj: new Obj(c.config),
            name: c.alias
        };
    } catch (e) {
        throw new Error(`Could not initialize bookend plugin "${c.name}": ${e.message}`);
    }
}

/**
 * Initializes plugins for bookend
 * @method initializeBookend
 * @param  {Array}          list List of plugins, or plugin configs
 * @return {Array}               List of initialized plugins
 */
function initializeBookend(defaultModules, list) {
    return list.map(m => {
        let name;
        let alias;

        if (typeof m === 'string') {
            name = m;
            alias = m;
        } else {
            name = m.name;
            alias = m.alias || name;
        }

        if (defaultModules[name]) {
            return {
                obj: defaultModules[name],
                name: alias
            };
        }

        return loadModule({
            name,
            alias,
            config: m.config || {}
        });
    });
}

/**
 * Defines the API for a bookend plugin
 * @class BookendInterface
 */
class BookendInterface {
    /**
     * Gives the commands needed for setup before the build starts
     * @method getSetupCommand
     * @return {Promise}
     */
    getSetupCommand() {
        return Promise.reject(new Error('setup not implemented'));
    }

    /**
     * Gives the commands needed for teardown after the build completes
     * @method getTeardownCommand
     * @return {Promise}
     */
    getTeardownCommand() {
        return Promise.reject(new Error('teardown not implemented'));
    }
}

/**
 * Consumes lists of bookend plugins to create setup and teardown commands
 * @class Bookend
 */
class Bookend extends BookendInterface {
    /**
     * Constructs the list of modules used by bookends
     * @constructor
     * @param {Object}  defaultModules      key->instantiated plugin for default plugins provided by screwdriver-cd
     * @param {Object}  config              Object keyed by cluster name with setup/teardown bookend in each.
     */
    constructor(defaultModules, config) {
        super();
        this.bookends = {};

        Object.keys(config).forEach(clusterName => {
            const { setup, teardown } = config[clusterName];

            this.bookends[clusterName] = {
                setupList: initializeBookend(defaultModules, setup),
                teardownList: initializeBookend(defaultModules, teardown)
            };
        });
    }

    /**
     * Gives the commands needed for setup before the build starts
     * @method getSetupCommands
     * @param  {Object}         o           Information about the environment for setup
     * @param  {PipelineModel}  o.pipeline  Pipeline model for the build
     * @param  {JobModel}       o.job       Job model for the build
     * @param  {Object}         o.build     Build configuration for the build (before creation)
     * @param  {String}         clusterName Cluster name
     * @return {Promise}
     */
    getSetupCommands(o, clusterName = 'default') {
        const bookends = this.bookends[clusterName] || this.bookends.default;

        return Promise.all(
            bookends.setupList.map(m =>
                m.obj.getSetupCommand(o).then(command => ({
                    name: `sd-setup-${m.name}`,
                    command
                }))
            )
        );
    }

    /**
     * Gives the commands needed for teardown after the build completes
     * @method getTeardownCommands
     * @param  {Object}         o           Information about the environment for setup
     * @param  {PipelineModel}  o.pipeline  Pipeline model for the build
     * @param  {JobModel}       o.job       Job model for the build
     * @param  {Object}         o.build     Build configuration for the build (before creation)
     * @param  {String}         clusterName Cluster name
     * @return {Promise}
     */
    getTeardownCommands(o, clusterName) {
        const bookends = this.bookends[clusterName] || this.bookends.default;

        return Promise.all(
            bookends.teardownList.map(m =>
                m.obj.getTeardownCommand(o).then(command => ({
                    name: `sd-teardown-${m.name}`,
                    command
                }))
            )
        );
    }
}

module.exports = { Bookend, BookendInterface };
