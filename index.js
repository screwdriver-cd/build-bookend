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

        return new Obj(c.config);
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
            return defaultModules[m];
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
     */
    constructor(defaultModules, setup, teardown) {
        super();
        this.setupList = initializeBookend(defaultModules, setup);
        this.teardownList = initializeBookend(defaultModules, teardown);
    }

    /**
     * Gives the commands needed for setup before the build starts
     * @method getSetupCommand
     * @return {Promise}
     */
    getSetupCommand() {
        return Promise.all(this.setupList.map(m => m.getSetupCommand()))
            .then(commands => ({
                name: 'sd-setup',
                command: commands.join(';')
            }));
    }

    /**
     * Gives the commands needed for teardown after the build completes
     * @method getTeardownCommand
     * @return {Promise}
     */
    getTeardownCommand() {
        return Promise.all(this.teardownList.map(m => m.getTeardownCommand()))
            .then(commands => ({
                name: 'sd-teardown',
                command: commands.join(';')
            }));
    }
}

module.exports = { Bookend, BookendInterface };
