/* eslint-disable global-require, import/no-dynamic-require */

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
            config: {}
        };
    }

    try {
        const Obj = require(c.name);

        return {
            obj: new Obj(c.config),
            name: c.name
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
    return list.map((m) => {
        if (typeof m === 'string' && defaultModules[m]) {
            return {
                obj: defaultModules[m],
                name: m
            };
        }

        return loadModule(m);
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
     * @param {Array}   setup               List of module names, or objects { name, config } for instantiation to use in sd-setup
     * @param {Array}   teardown            List of module names, or objects { name, config } for instantiation to use in sd-teardown
     */
    constructor(defaultModules, setup, teardown) {
        super();
        this.setupList = initializeBookend(defaultModules, setup);
        this.teardownList = initializeBookend(defaultModules, teardown);
    }

    /**
     * Gives the commands needed for setup before the build starts
     * @method getSetupCommands
     * @param  {Object}         o           Information about the environment for setup
     * @param  {PipelineModel}  o.pipeline  Pipeline model for the build
     * @param  {JobModel}       o.job       Job model for the build
     * @param  {Object}         o.build     Build configuration for the build (before creation)
     * @return {Promise}
     */
    getSetupCommands(o) {
        return Promise.all(this.setupList.map(m => m.obj.getSetupCommand(o).then(command => ({
            name: `sd-setup-${m.name}`,
            command
        }))));
    }

    /**
     * Gives the commands needed for teardown after the build completes
     * @method getTeardownCommands
     * @param  {Object}         o           Information about the environment for setup
     * @param  {PipelineModel}  o.pipeline  Pipeline model for the build
     * @param  {JobModel}       o.job       Job model for the build
     * @param  {Object}         o.build     Build configuration for the build (before creation)
     * @return {Promise}
     */
    getTeardownCommands(o) {
        return Promise.all(this.teardownList.map(m => m.obj.getTeardownCommand(o).then(command => ({
            name: `sd-teardown-${m.name}`,
            command
        }))));
    }
}

module.exports = { Bookend, BookendInterface };
