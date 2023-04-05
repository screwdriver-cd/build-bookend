/* eslint-disable global-require, import/no-dynamic-require, max-classes-per-file */

'use strict';

const Hoek = require('@hapi/hoek');

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
 * @param  {Array}           defaultModules List of default plugins
 * @param  {Array}           list List of plugins, or plugin configs
 * @param  {Array}           cachedModules of cached plugins
 * @return {Array}           List of initialized plugins
 */
function initializeBookend(defaultModules, list, cachedModules) {
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
        if (cachedModules[name]) {
            return cachedModules[name];
        }

        const module = loadModule({
            name,
            alias,
            config: m.config || {}
        });

        cachedModules[name] = module;

        return module;
    });
}

/**
 *
 * @param {Object} config Object keyed by cluster name with value setup/teardown bookend.
 * @param {Object} defaultModules key->instantiated plugin for default plugins provided by screwdriver-cd
 * @returns bookend object with the modules initialized
 */
function traverseBookends(config, defaultModules) {
    const result = {};
    const stack = [[config, result]];
    const cachedModules = [];

    while (stack.length > 0) {
        const [node, parent] = stack.pop();

        for (const [key, current] of Object.entries(node)) {
            let child = parent[key] || {};
            let processNode = current;

            if (key === 'default') {
                if (typeof current === 'string' && node[current]) {
                    parent[key] = current;
                    processNode = node[current];
                } else {
                    child = parent;
                }
            }

            if (typeof processNode === 'object') {
                if (processNode.setup && processNode.teardown) {
                    parent[key] = {
                        setupList: initializeBookend(defaultModules, cachedModules, processNode.setup),
                        teardownList: initializeBookend(defaultModules, cachedModules, processNode.teardown)
                    };
                } else {
                    stack.push([processNode, child]);
                    parent[key] = child;
                }
            }
        }
    }

    return result;
}

/**
 *
 * @param {Object} bookends Object keyed by cluster name with value setup/teardown bookend.
 * @param  {String} bookendKey Bookend key name
 * @returns Bookend object for given key and default if key is not found
 */
const selectBookends = (bookends, bookendKey) => {
    const keys = bookendKey.split('.');
    let current = bookends;

    for (const key of keys) {
        const result = Hoek.reach(current, key, { default: Hoek.reach(current, 'default') });

        if (result.setupList && result.teardownList) {
            return result;
        }
        current = result;
    }

    return null;
};

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
     * @param {Object}  defaultModules            key->instantiated plugin for default plugins provided by screwdriver-cd
     * @param {Object}  config                    Object keyed by cluster name with value setup/teardown bookend.
     * @param {Object}  config.default            Default setup/teardown bookend config
     * @param {Array}   config.default.setup      Default list of module names, or objects { name, config } for instantiation to use in sd-setup
     * @param {Array}   config.default.teardown   Default list of module names, or objects { name, config } for instantiation to use in sd-teardown
     */
    constructor(defaultModules, config) {
        super();
        this.bookends = traverseBookends(config, defaultModules);
    }

    /**
     * Gives the commands needed for setup before the build starts
     * @method getSetupCommands
     * @param  {Object}         o             Information about the environment for setup
     * @param  {PipelineModel}  o.pipeline    Pipeline model for the build
     * @param  {JobModel}       o.job         Job model for the build
     * @param  {Object}         o.build       Build configuration for the build (before creation)
     * @param  {String}         [bookendKeyName] Bookend key name
     * @return {Promise}
     */
    getSetupCommands(o, bookendKeyName = 'default') {
        console.log(o, bookendKeyName);

        const bookends = selectBookends(this.bookends, bookendKeyName) || this.bookends.default;

        return Promise.all(
            bookends.setupList.map(m => {
                return m.obj.getSetupCommand(o).then(command => ({
                    name: `sd-setup-${m.name}`,
                    command
                }));
            })
        );
    }

    /**
     * Gives the commands needed for teardown after the build completes
     * @method getTeardownCommands
     * @param  {Object}         o             Information about the environment for setup
     * @param  {PipelineModel}  o.pipeline    Pipeline model for the build
     * @param  {JobModel}       o.job         Job model for the build
     * @param  {Object}         o.build       Build configuration for the build (before creation)
     * @param  {String}         [bookendKeyName] Bookend key name
     * @return {Promise}
     */
    getTeardownCommands(o, bookendKeyName = 'default') {
        const bookends = selectBookends(this.bookends, bookendKeyName) || this.bookends.default;

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
