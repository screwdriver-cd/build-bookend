/* eslint-disable max-classes-per-file */

'use strict';

const { assert } = require('chai');
const mockery = require('mockery');
const { Bookend, BookendInterface } = require('../index');

describe('bookend interface', () => {
    let bi;

    beforeEach(() => {
        bi = new BookendInterface();
    });

    describe('getSetupCommand', () => {
        it('should fail if not overridden', () =>
            bi
                .getSetupCommand()
                .then(() => {
                    assert.fail('should not get here');
                })
                .catch(e => {
                    assert.equal(e.message, 'setup not implemented');
                }));
    });

    describe('getTeardownCommand', () => {
        it('should fail if not overridden', () =>
            bi
                .getTeardownCommand()
                .then(() => {
                    assert.fail('should not get here');
                })
                .catch(e => {
                    assert.equal(e.message, 'teardown not implemented');
                }));
    });
});

describe('bookend', () => {
    const SampleModule = class extends BookendInterface {
        getSetupCommand() {
            return Promise.resolve('echo "hello"');
        }

        getTeardownCommand() {
            return Promise.resolve('echo "goodbye"');
        }
    };

    const SampleModule2 = class extends BookendInterface {
        getSetupCommand() {
            return Promise.resolve('echo "world"');
        }

        getTeardownCommand() {
            return Promise.resolve('echo "mars"');
        }
    };

    const SampleModule3 = class extends BookendInterface {
        constructor(obj) {
            super();
            this.foo = obj.foo;
            assert.equal(obj.foo, 'bar');
        }

        getSetupCommand() {
            return Promise.resolve(`echo "${this.foo}"`);
        }

        getTeardownCommand() {
            return Promise.resolve(`echo "${this.foo}"`);
        }
    };

    const defaultModules = {
        greeting: new SampleModule(),
        planet: new SampleModule2()
    };

    const bookends = {
        default: {},
        clusterA: {}
    };

    before(() => {
        mockery.enable({ useCleanCache: true });
    });

    beforeEach(() => {
        bookends.default = {
            setup: [],
            teardown: []
        };
        bookends.clusterA = {
            setup: [],
            teardown: []
        };

        mockery.registerAllowable('notfound');
        mockery.registerMock(
            'sample',
            class extends BookendInterface {
                getSetupCommand() {
                    return Promise.resolve('echo "llama"');
                }

                getTeardownCommand() {
                    return Promise.resolve('echo "penguin"');
                }
            }
        );
        mockery.registerMock('sample2', SampleModule3);
    });

    afterEach(() => {
        mockery.deregisterAll();
        mockery.resetCache();
    });

    after(() => {
        mockery.disable();
    });

    describe('constructor', () => {
        it('construct properly', () => {
            const b = new Bookend(defaultModules, bookends);

            assert.instanceOf(b, BookendInterface);
        });

        it('should fail if a module can not be found', () => {
            bookends.default.setup = ['notfound'];

            assert.throws(
                () => new Bookend(defaultModules, bookends),
                Error,
                `Could not initialize bookend plugin "notfound": Cannot find module 'notfound'\n`
            );
        });

        it('should fail if a module is not initialized properly', () => {
            bookends.default.setup = [{ name: 'sample2', config: { foo: 'foo' } }];

            assert.throws(
                () => new Bookend(defaultModules, bookends),
                Error,
                "Could not initialize bookend plugin \"sample2\": expected 'foo' to equal 'bar'"
            );
        });
    });

    describe('getSetupCommands', () => {
        it('should get a list of commands from default modules', () => {
            bookends.default.setup = ['greeting', 'planet'];

            const b = new Bookend(defaultModules, bookends);

            return b.getSetupCommands().then(commands => {
                assert.deepEqual(commands, [
                    {
                        name: 'sd-setup-greeting',
                        command: 'echo "hello"'
                    },
                    {
                        name: 'sd-setup-planet',
                        command: 'echo "world"'
                    }
                ]);
            });
        });

        it('should get a list of commands from default and user modules', () => {
            bookends.default.setup = ['greeting', 'sample', 'planet'];

            const b = new Bookend(defaultModules, bookends);

            return b.getSetupCommands().then(commands => {
                assert.deepEqual(commands, [
                    {
                        name: 'sd-setup-greeting',
                        command: 'echo "hello"'
                    },
                    {
                        name: 'sd-setup-sample',
                        command: 'echo "llama"'
                    },
                    {
                        name: 'sd-setup-planet',
                        command: 'echo "world"'
                    }
                ]);
            });
        });

        it('should properly use user modules with a config', () => {
            bookends.default.setup = [{ name: 'sample2', config: { foo: 'bar' } }];

            const b = new Bookend(defaultModules, bookends);

            return b.getSetupCommands().then(commands => {
                assert.deepEqual(commands, [
                    {
                        name: 'sd-setup-sample2',
                        command: 'echo "bar"'
                    }
                ]);
            });
        });

        it('should get a list of commands with aliases', () => {
            bookends.default.setup = [
                { name: 'greeting', alias: 'foo' },
                { name: 'sample', alias: 'bar' },
                { name: 'planet', alias: 'baz' }
            ];

            const b = new Bookend(defaultModules, bookends);

            return b.getSetupCommands().then(commands => {
                assert.deepEqual(commands, [
                    {
                        name: 'sd-setup-foo',
                        command: 'echo "hello"'
                    },
                    {
                        name: 'sd-setup-bar',
                        command: 'echo "llama"'
                    },
                    {
                        name: 'sd-setup-baz',
                        command: 'echo "world"'
                    }
                ]);
            });
        });

        describe('when use multi build cluster', () => {
            it('should get a list of commands from clusterA bookend', () => {
                bookends.clusterA.setup = ['greeting', 'planet'];

                const b = new Bookend(defaultModules, bookends);

                return b.getSetupCommands({}, { cluster: 'clusterA' }).then(commands => {
                    assert.deepEqual(commands, [
                        {
                            name: 'sd-setup-greeting',
                            command: 'echo "hello"'
                        },
                        {
                            name: 'sd-setup-planet',
                            command: 'echo "world"'
                        }
                    ]);
                });
            });

            it('should get a list of commands from default bookends', () => {
                bookends.default.setup = ['greeting'];
                bookends.clusterA.setup = ['planet'];

                const b = new Bookend(defaultModules, bookends);

                return b.getSetupCommands({}, 'notExistsCluster').then(commands => {
                    assert.deepEqual(commands, [
                        {
                            name: 'sd-setup-greeting',
                            command: 'echo "hello"'
                        }
                    ]);
                });
            });
        });
    });

    describe('getTeardownCommands', () => {
        it('should get a list of commands from default modules', () => {
            bookends.default.teardown = ['greeting', 'planet'];

            const b = new Bookend(defaultModules, bookends);

            return b.getTeardownCommands().then(commands => {
                assert.deepEqual(commands, [
                    {
                        name: 'sd-teardown-greeting',
                        command: 'echo "goodbye"'
                    },
                    {
                        name: 'sd-teardown-planet',
                        command: 'echo "mars"'
                    }
                ]);
            });
        });

        it('should get a list of commands from default and user modules', () => {
            bookends.default.teardown = ['greeting', 'sample', 'planet'];

            const b = new Bookend(defaultModules, bookends);

            return b.getTeardownCommands().then(commands => {
                assert.deepEqual(commands, [
                    {
                        name: 'sd-teardown-greeting',
                        command: 'echo "goodbye"'
                    },
                    {
                        name: 'sd-teardown-sample',
                        command: 'echo "penguin"'
                    },
                    {
                        name: 'sd-teardown-planet',
                        command: 'echo "mars"'
                    }
                ]);
            });
        });

        it('should properly use user modules with a config', () => {
            bookends.default.teardown = [{ name: 'sample2', config: { foo: 'bar' } }];

            const b = new Bookend(defaultModules, bookends);

            return b.getTeardownCommands().then(commands => {
                assert.deepEqual(commands, [
                    {
                        name: 'sd-teardown-sample2',
                        command: 'echo "bar"'
                    }
                ]);
            });
        });

        it('should get a list of commands with aliases', () => {
            bookends.default.teardown = [
                { name: 'greeting', alias: 'foo' },
                { name: 'sample', alias: 'bar' },
                { name: 'planet', alias: 'baz' }
            ];

            const b = new Bookend(defaultModules, bookends);

            return b.getTeardownCommands().then(commands => {
                assert.deepEqual(commands, [
                    {
                        name: 'sd-teardown-foo',
                        command: 'echo "goodbye"'
                    },
                    {
                        name: 'sd-teardown-bar',
                        command: 'echo "penguin"'
                    },
                    {
                        name: 'sd-teardown-baz',
                        command: 'echo "mars"'
                    }
                ]);
            });
        });

        describe('when use multi build cluster', () => {
            it('should get a list of commands from clusterA bookend', () => {
                bookends.clusterA.teardown = ['greeting', 'planet'];

                const b = new Bookend(defaultModules, bookends);

                return b.getTeardownCommands({}, { cluster: 'clusterA' }).then(commands => {
                    assert.deepEqual(commands, [
                        {
                            name: 'sd-teardown-greeting',
                            command: 'echo "goodbye"'
                        },
                        {
                            name: 'sd-teardown-planet',
                            command: 'echo "mars"'
                        }
                    ]);
                });
            });

            it('should get a list of commands from default bookends', () => {
                bookends.default.teardown = ['greeting'];
                bookends.clusterA.teardown = ['planet'];

                const b = new Bookend(defaultModules, bookends);

                return b.getTeardownCommands({}, 'notExistsCluster').then(commands => {
                    assert.deepEqual(commands, [
                        {
                            name: 'sd-teardown-greeting',
                            command: 'echo "goodbye"'
                        }
                    ]);
                });
            });
        });
    });
});

describe('nested bookends configuration', () => {
    const SampleModule = class extends BookendInterface {
        getSetupCommand() {
            return Promise.resolve('echo "I am altering the deal"');
        }

        getTeardownCommand() {
            return Promise.resolve('echo "pray I don\'t alter it further"');
        }
    };
    const SampleModule1 = class extends BookendInterface {
        getSetupCommand() {
            return Promise.resolve('echo "force is strong"');
        }

        getTeardownCommand() {
            return Promise.resolve('echo "you don\'t know the power of the dark side"');
        }
    };
    const SampleModule2 = class extends BookendInterface {
        getSetupCommand() {
            return Promise.resolve('echo "No! Try not. Do. Or do not. There is no try."');
        }

        getTeardownCommand() {
            return Promise.resolve('echo "You must unlearn what you have learned"');
        }
    };
    const SampleModule3 = class extends BookendInterface {
        getSetupCommand() {
            return Promise.resolve('echo "Be mindful of your thoughts, Anakin, they betray you"');
        }

        getTeardownCommand() {
            return Promise.resolve('echo "Only a Sith deals in absolutes"');
        }
    };

    const defaultModules = {
        'obi-wan': new SampleModule3(),
        vader: new SampleModule()
    };

    const nestedBookends = {
        default: {
            setup: ['obi-wan', 'vader'],
            teardown: ['obi-wan', 'vader']
        },
        clusterA: {
            setup: ['obi-wan', 'vader'],
            teardown: ['obi-wan', 'vader']
        },
        clusterB: {
            default: 'beta',
            beta: {
                default: 'k8s',
                k8s: {
                    setup: ['yoda', 'skywalker'],
                    teardown: ['yoda', 'skywalker']
                },
                'k8s-arm': {
                    setup: ['yoda', 'skywalker'],
                    teardown: ['yoda', 'skywalker']
                },
                sls: {
                    setup: ['yoda', 'skywalker'],
                    teardown: ['yoda', 'skywalker']
                },
                'sls-arm': {
                    setup: ['yoda', 'skywalker'],
                    teardown: ['yoda', 'skywalker']
                }
            },
            alpha: {
                default: 'eks-arm',
                'eks-arm': {
                    setup: ['yoda', 'skywalker'],
                    teardown: ['yoda', 'skywalker']
                }
            }
        }
    };

    before(() => {
        mockery.enable({ useCleanCache: true });
    });

    beforeEach(() => {
        mockery.registerMock('skywalker', SampleModule1);
        mockery.registerMock('yoda', SampleModule2);
    });

    afterEach(() => {
        mockery.deregisterAll();
        mockery.resetCache();
    });

    after(() => {
        mockery.disable();
    });

    describe('constructor', () => {
        it('should correctly traverse a nested bookend object and transform it', () => {
            const b = new Bookend(defaultModules, nestedBookends);

            assert.instanceOf(b, BookendInterface);
            assert.isNotEmpty(b.bookends.clusterB);
            assert.deepEqual(b.bookends.clusterB.default, b.bookends.clusterB.beta);
        });
    });

    describe('getSetupCommands', async () => {
        it('should get a list of commands from clusterB.beta.k8s bookend', () => {
            const b = new Bookend(defaultModules, nestedBookends);

            return b.getSetupCommands({}, { cluster: 'clusterB', env: 'beta', executor: 'k8s' }).then(commands => {
                assert.deepEqual(commands, [
                    {
                        name: 'sd-setup-yoda',
                        command: 'echo "No! Try not. Do. Or do not. There is no try."'
                    },
                    {
                        name: 'sd-setup-skywalker',
                        command: 'echo "force is strong"'
                    }
                ]);
            });
        });
        it('should get a list of commands from clusterB.beta.k8s bookend', () => {
            const b = new Bookend(defaultModules, nestedBookends);

            return b.getSetupCommands({}, { cluster: 'clusterB', env: 'beta', executor: 'k8s' }).then(commands => {
                assert.deepEqual(commands, [
                    {
                        name: 'sd-setup-yoda',
                        command: 'echo "No! Try not. Do. Or do not. There is no try."'
                    },
                    {
                        name: 'sd-setup-skywalker',
                        command: 'echo "force is strong"'
                    }
                ]);
            });
        });
        it('should get a list of commands from clusterB.beta.default bookend', async () => {
            const b = new Bookend(defaultModules, nestedBookends);

            const expected = await b.getSetupCommands({}, { cluster: 'clusterB', env: 'beta', executor: 'default' });
            const actual = await b.getSetupCommands({}, { cluster: 'clusterB', env: 'beta', executor: 'k8s' });

            assert.deepEqual(expected, actual);
        });
        it('should get a list of commands from clusterB.us-west-2.sls bookend', async () => {
            const b = new Bookend(defaultModules, nestedBookends);

            const expected = await b.getSetupCommands({}, { cluster: 'clusterB', env: 'us-west-2', executor: 'sls' });
            const actual = await b.getSetupCommands({}, { cluster: 'clusterB', env: 'beta', executor: 'k8s-arm' });

            assert.deepEqual(expected, actual);
        });
    });

    describe('getTeardownCommands', () => {
        it('should get a list of commands from clusterB.beta.k8s bookend', () => {
            const b = new Bookend(defaultModules, nestedBookends);

            return b.getTeardownCommands({}, { cluster: 'clusterB', env: 'beta', executor: 'k8s' }).then(commands => {
                assert.deepEqual(commands, [
                    {
                        name: 'sd-teardown-yoda',
                        command: 'echo "You must unlearn what you have learned"'
                    },
                    {
                        name: 'sd-teardown-skywalker',
                        command: 'echo "you don\'t know the power of the dark side"'
                    }
                ]);
            });
        });
        it('should get a list of commands from clusterB.us-west-2.k8s-arm bookend', async () => {
            const b = new Bookend(defaultModules, nestedBookends);

            const expected = await b.getTeardownCommands(
                {},
                { cluster: 'clusterB', env: 'us-west-2', executor: 'k8s-arm' }
            );
            const actual = await b.getTeardownCommands({}, { cluster: 'clusterB', env: 'beta', executor: 'k8s-arm' });

            assert.deepEqual(expected, actual);
        });

        it('should get a list of commands from clusterB.beta.default bookend', async () => {
            const b = new Bookend(defaultModules, nestedBookends);

            const expected = await b.getTeardownCommands({}, { cluster: 'clusterB', env: 'beta', executor: 'default' });
            const actual = await b.getTeardownCommands({}, { cluster: 'clusterB', env: 'beta', executor: 'k8s' });

            assert.deepEqual(expected, actual);
        });
    });
});
