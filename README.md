# Build Bookend
[![Version][npm-image]][npm-url] ![Downloads][downloads-image] [![Build Status][status-image]][status-url] [![Open Issues][issues-image]][issues-url] [![Dependency Status][daviddm-image]][daviddm-url] ![License][license-image]

> creates setup and teardown steps for builds

## Usage

```bash
npm install screwdriver-build-bookend
```

### Using the bookend interface
Extend the bookend interface in this module. You will need to define `getSetupCommand` and `getTeardownCommand` to return the commands needed to execute and return these in a promise.

```js
const { BookendInterface } = require('screwdriver-build-bookend');

class MyBookend extends BookendInterface {
    getSetupCommand() {
        return Promise.resolve('echo "hello world"');
    }
    getTeardownCommand() {
        return Promise.resolve('echo "goodbye world"');
    }
}

module.exports = MyBookend;
```

### Getting final bookend commands
Use the Bookend module to combine a set of BookendInterface based modules into single set of setup and teardown commands. See more examples in [the tests](https://github.com/screwdriver-cd/screwdriver-build-bookend/blob/master/test/index.test.js).

```js
const SampleBookend = require('sd-sample-bookend');
const { Bookend } = require('screwdriver-build-bookend');
const b = new Bookend(
    // Provide a set of default instantiated plugins
    { 'sample': new SampleBookend() },
    /*
        Provide a list of plugins to use for setup, by name or with a config object
        You can also choose to include your own modules with a config, these will be initialized for you with the given config.
        The following config will use the default sample plugin, then the users my-bookend plugin
     */
    [ 'sample', { name: 'my-bookend', config: { foo: 'bar' } }],
    // Provide a list of plugins for teardown. format is the same as setup
    [ 'sample', { name: 'my-bookend', config: { foo: 'bar' } }]
);

// Get the setup commands [ { name: 'setup-sample', command: '...' }, { name: 'setup-my-bookend', command: '...' } ] given the models and configuration for the pipeline, job, and build
b.getSetupCommands({ pipeline, job, build }).then((commands) => { ... });

// Get the teardown command [ { name: 'teardown-sample', command: '...' }, { name: 'teardown-my-bookend', command: '...' } ] given the models and configuration for the pipeline, job, and build
b.getTeardownCommands({ pipeline, job, build }).then((commands) => { ... });
```

## Testing

```bash
npm test
```

## License

Code licensed under the BSD 3-Clause license. See LICENSE file for terms.

[npm-image]: https://img.shields.io/npm/v/screwdriver-build-bookend.svg
[npm-url]: https://npmjs.org/package/screwdriver-build-bookend
[downloads-image]: https://img.shields.io/npm/dt/screwdriver-build-bookend.svg
[license-image]: https://img.shields.io/npm/l/screwdriver-build-bookend.svg
[issues-image]: https://img.shields.io/github/issues/screwdriver-cd/screwdriver.svg
[issues-url]: https://github.com/screwdriver-cd/screwdriver/issues
[status-image]: https://cd.screwdriver.cd/pipelines/29/badge
[status-url]: https://cd.screwdriver.cd/pipelines/29
[daviddm-image]: https://david-dm.org/screwdriver-cd/build-bookend.svg?theme=shields.io
[daviddm-url]: https://david-dm.org/screwdriver-cd/build-bookend
