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
            return 'echo "hello"';
        }
        getTeardownCommand() {
            return 'echo "goodbye"';
        }
    };

    const SampleModule2 = class extends BookendInterface {
        getSetupCommand() {
            return 'echo "world"';
        }
        getTeardownCommand() {
            return 'echo "mars"';
        }
    };

    const SampleModule3 = class extends BookendInterface {
        constructor(obj) {
            super();
            this.foo = obj.foo;
            assert.equal(obj.foo, 'bar');
        }
        getSetupCommand() {
            return `echo "${this.foo}"`;
        }
        getTeardownCommand() {
            return `echo "${this.foo}"`;
        }
    };

    const defaultModules = {
        'sd-greeting': new SampleModule(),
        'sd-planet': new SampleModule2()
    };

    before(() => {
        mockery.enable({ useCleanCache: true });
    });

    beforeEach(() => {
        mockery.registerAllowable('sd-notfound');
        mockery.registerMock('sd-sample', class extends BookendInterface {
            getSetupCommand() {
                return 'echo "llama"';
            }
            getTeardownCommand() {
                return 'echo "penguin"';
            }
        });
        mockery.registerMock('sd-sample2', SampleModule3);
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
            assert.throws(() => new Bookend(defaultModules, ['sd-notfound'], []), Error,
                'Could not initialize bookend plugin "sd-notfound": ' +
                'Cannot find module \'sd-notfound\'');
        });

        it('should fail if a module is not initialized properly', () => {
            assert.throws(() => new Bookend(defaultModules, [
                { name: 'sd-sample2', config: { foo: 'foo' } }
            ], []), Error,
                'Could not initialize bookend plugin "sd-sample2": ' +
                'expected \'foo\' to equal \'bar\'');
        });
    });

    describe('getSetupCommand', () => {
        it('should get a list of commands from default modules', () => {
            const b = new Bookend(defaultModules, ['sd-greeting', 'sd-planet'], []);

            b.getSetupCommand().then((command) => {
                assert.deepEqual(command, {
                    name: 'sd-setup',
                    command: 'echo "hello";echo "world"'
                });
            });
        });

        it('should get a list of commands from default and user modules', () => {
            const b = new Bookend(defaultModules, ['sd-greeting', 'sd-sample', 'sd-planet'], []);

            b.getSetupCommand().then((command) => {
                assert.deepEqual(command, {
                    name: 'sd-setup',
                    command: 'echo "hello";echo "llama";echo "world"'
                });
            });
        });

        it('should get a list of commands from default and user modules', () => {
            const b = new Bookend(defaultModules, ['sd-greeting', 'sd-sample', 'sd-planet'], []);

            b.getSetupCommand().then((command) => {
                assert.deepEqual(command, {
                    name: 'sd-setup',
                    command: 'echo "hello";echo "llama";echo "world"'
                });
            });
        });

        it('should properly use user modules with a config', () => {
            const b = new Bookend(defaultModules, [
                { name: 'sd-sample2', config: { foo: 'bar' } }
            ], []);

            b.getSetupCommand().then((command) => {
                assert.deepEqual(command, {
                    name: 'sd-setup',
                    command: 'echo "bar"'
                });
            });
        });
    });

    describe('getTeardownCommand', () => {
        it('should get a list of commands from default modules', () => {
            const b = new Bookend(defaultModules, [], ['sd-greeting', 'sd-planet']);

            b.getTeardownCommand().then((command) => {
                assert.deepEqual(command, {
                    name: 'sd-teardown',
                    command: 'echo "goodbye";echo "mars"'
                });
            });
        });

        it('should get a list of commands from default and user modules', () => {
            const b = new Bookend(defaultModules, [], ['sd-greeting', 'sd-sample', 'sd-planet']);

            b.getTeardownCommand().then((command) => {
                assert.deepEqual(command, {
                    name: 'sd-teardown',
                    command: 'echo "goodbye";echo "penguin";echo "mars"'
                });
            });
        });
    });
});
