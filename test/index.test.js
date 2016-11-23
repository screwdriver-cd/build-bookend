'use strict';

const assert = require('chai').assert;
const { Bookend, BookendInterface } = require('../index');
const mockery = require('mockery');

describe('bookend interface', () => {
    let bi;

    beforeEach(() => {
        bi = new BookendInterface();
    });

    describe('getSetupCommand', () => {
        it('should fail if not overridden', () =>
            bi.getSetupCommand().then(() => {
                assert.fail('should not get here');
            }).catch((e) => {
                assert.equal(e.message, 'setup not implemented');
            })
        );
    });

    describe('getTeardownCommand', () => {
        it('should fail if not overridden', () =>
            bi.getTeardownCommand().then(() => {
                assert.fail('should not get here');
            }).catch((e) => {
                assert.equal(e.message, 'teardown not implemented');
            })
        );
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

    before(() => {
        mockery.enable({ useCleanCache: true });
    });

    beforeEach(() => {
        mockery.registerAllowable('notfound');
        mockery.registerMock('sample', class extends BookendInterface {
            getSetupCommand() {
                return Promise.resolve('echo "llama"');
            }
            getTeardownCommand() {
                return Promise.resolve('echo "penguin"');
            }
        });
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
            const b = new Bookend(defaultModules, [], []);

            assert.instanceOf(b, BookendInterface);
        });

        it('should fail if a module can not be found', () => {
            assert.throws(() => new Bookend(defaultModules, ['notfound'], []), Error,
                'Could not initialize bookend plugin "notfound": ' +
                'Cannot find module \'notfound\'');
        });

        it('should fail if a module is not initialized properly', () => {
            assert.throws(() => new Bookend(defaultModules, [
                { name: 'sample2', config: { foo: 'foo' } }
            ], []), Error,
                'Could not initialize bookend plugin "sample2": ' +
                'expected \'foo\' to equal \'bar\'');
        });
    });

    describe('getSetupCommands', () => {
        it('should get a list of commands from default modules', () => {
            const b = new Bookend(defaultModules, ['greeting', 'planet'], []);

            return b.getSetupCommands().then((commands) => {
                assert.deepEqual(commands, [
                    {
                        name: 'setup-greeting',
                        command: 'echo "hello"'
                    },
                    {
                        name: 'setup-planet',
                        command: 'echo "world"'
                    }
                ]);
            });
        });

        it('should get a list of commands from default and user modules', () => {
            const b = new Bookend(defaultModules, ['greeting', 'sample', 'planet'], []);

            return b.getSetupCommands().then((commands) => {
                assert.deepEqual(commands, [
                    {
                        name: 'setup-greeting',
                        command: 'echo "hello"'
                    },
                    {
                        name: 'setup-sample',
                        command: 'echo "llama"'
                    },
                    {
                        name: 'setup-planet',
                        command: 'echo "world"'
                    }
                ]);
            });
        });

        it('should properly use user modules with a config', () => {
            const b = new Bookend(defaultModules, [
                { name: 'sample2', config: { foo: 'bar' } }
            ], []);

            return b.getSetupCommands().then((commands) => {
                assert.deepEqual(commands, [
                    {
                        name: 'setup-sample2',
                        command: 'echo "bar"'
                    }
                ]);
            });
        });
    });

    describe('getTeardownCommands', () => {
        it('should get a list of commands from default modules', () => {
            const b = new Bookend(defaultModules, [], ['greeting', 'planet']);

            return b.getTeardownCommands().then((commands) => {
                assert.deepEqual(commands, [
                    {
                        name: 'teardown-greeting',
                        command: 'echo "goodbye"'
                    },
                    {
                        name: 'teardown-planet',
                        command: 'echo "mars"'
                    }
                ]);
            });
        });

        it('should get a list of commands from default and user modules', () => {
            const b = new Bookend(defaultModules, [], ['greeting', 'sample', 'planet']);

            return b.getTeardownCommands().then((commands) => {
                assert.deepEqual(commands, [
                    {
                        name: 'teardown-greeting',
                        command: 'echo "goodbye"'
                    },
                    {
                        name: 'teardown-sample',
                        command: 'echo "penguin"'
                    },
                    {
                        name: 'teardown-planet',
                        command: 'echo "mars"'
                    }
                ]);
            });
        });
    });
});
