/*
 * Copyright 2020. F5 Networks, Inc. See End User License Agreement ("EULA") for
 * license terms. Notwithstanding anything to the contrary in the EULA, Licensee
 * may copy and modify this software product for its internal business purposes.
 * Further, Licensee may upload, publish and distribute the modified version of
 * the software product on devcentral.f5.com.
 */

'use strict';

const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const fs = require('fs');
const sinon = require('sinon');

chai.use(chaiAsPromised);
const assert = chai.assert;

const config = require('../../src/lib/config.js');
const constants = require('../../src/lib/constants.js');
const deviceUtil = require('../../src/lib/deviceUtil.js');
const util = require('../../src/lib/util.js');


describe('Declarations', () => {
    let encryptSecretStub;
    let getDeviceTypeStub;
    let networkCheckStub;

    beforeEach(() => {
        encryptSecretStub = sinon.stub(deviceUtil, 'encryptSecret');
        encryptSecretStub.callsFake(() => Promise.resolve('foo'));
        getDeviceTypeStub = sinon.stub(deviceUtil, 'getDeviceType');
        getDeviceTypeStub.callsFake(() => Promise.resolve(constants.BIG_IP_DEVICE_TYPE));
        networkCheckStub = sinon.stub(util, 'networkCheck');
        networkCheckStub.callsFake(() => Promise.resolve());
    });
    afterEach(() => {
        sinon.restore();
    });

    describe('Validate Example Declaration from examples/declarations', () => {
        beforeEach(() => {
            // fs access modification to skip folder check
            const originFsAccess = fs.access;
            sinon.stub(fs, 'access').callsFake(function () {
                const path = arguments[0];
                const callback = arguments[arguments.length - 1];
                if (path === 'example_download_folder') {
                    callback();
                } else {
                    /* eslint-disable prefer-spread */
                    originFsAccess.apply(null, arguments);
                }
            });
        });
        // first let's validate all example declarations
        const baseDir = `${__dirname}/../../examples/declarations`;
        const files = fs.readdirSync(baseDir);
        files.forEach((file) => {
            it(`should validate example: ${file}`, () => {
                const data = JSON.parse(fs.readFileSync(`${baseDir}/${file}`));
                return assert.isFulfilled(config.validate(data));
            });
        });
    });

    describe('Base Schema objects', () => {
        describe('proxy', () => {
            it('should pass minimal declaration', () => {
                const data = {
                    class: 'Telemetry',
                    My_iHealth: {
                        class: 'Telemetry_iHealth_Poller',
                        username: 'username',
                        passphrase: {
                            cipherText: 'cipherText'
                        },
                        interval: {
                            timeWindow: {
                                start: '00:00',
                                end: '03:00'
                            }
                        },
                        proxy: {
                            host: 'localhost'
                        }
                    }
                };
                return config.validate(data)
                    .then((validConfig) => {
                        const proxy = validConfig.My_iHealth.proxy;
                        assert.strictEqual(proxy.protocol, 'http');
                        assert.strictEqual(proxy.host, 'localhost');
                        assert.strictEqual(proxy.port, 80);
                    });
            });

            it('should pass full declaration', () => {
                const data = {
                    class: 'Telemetry',
                    My_iHealth: {
                        class: 'Telemetry_iHealth_Poller',
                        username: 'username',
                        passphrase: {
                            cipherText: 'cipherText'
                        },
                        interval: {
                            timeWindow: {
                                start: '00:00',
                                end: '03:00'
                            }
                        },
                        proxy: {
                            host: 'localhost',
                            protocol: 'https',
                            port: 80,
                            allowSelfSignedCert: true,
                            enableHostConnectivityCheck: false,
                            username: 'username',
                            passphrase: {
                                cipherText: 'passphrase'
                            }
                        }
                    }
                };
                return config.validate(data)
                    .then((validConfig) => {
                        const proxy = validConfig.My_iHealth.proxy;
                        assert.strictEqual(proxy.protocol, 'https');
                        assert.strictEqual(proxy.host, 'localhost');
                        assert.strictEqual(proxy.port, 80);
                        assert.strictEqual(proxy.allowSelfSignedCert, true);
                        assert.strictEqual(proxy.enableHostConnectivityCheck, false);
                        assert.strictEqual(proxy.username, 'username');
                        assert.strictEqual(proxy.passphrase.cipherText, 'foo');
                    });
            });

            it('should fail when no host specified', () => {
                const data = {
                    class: 'Telemetry',
                    My_iHealth: {
                        class: 'Telemetry_iHealth_Poller',
                        username: 'username',
                        passphrase: {
                            cipherText: 'cipherText'
                        },
                        proxy: {}
                    }
                };
                return assert.isRejected(config.validate(data), /host.*should have required property 'host'/);
            });

            it('should fail when invalid port specified', () => {
                const data = {
                    class: 'Telemetry',
                    My_iHealth: {
                        class: 'Telemetry_iHealth_Poller',
                        username: 'username',
                        passphrase: {
                            cipherText: 'cipherText'
                        },
                        proxy: {
                            host: 'localhost',
                            port: 999999
                        }
                    }
                };
                return assert.isRejected(config.validate(data), /proxy\/port.*should be <=/);
            });

            it('should fail when invalid protocol specified', () => {
                const data = {
                    class: 'Telemetry',
                    My_iHealth: {
                        class: 'Telemetry_iHealth_Poller',
                        username: 'username',
                        passphrase: {
                            cipherText: 'cipherText'
                        },
                        proxy: {
                            host: 'localhost',
                            protocol: 'http2'
                        }
                    }
                };
                return assert.isRejected(config.validate(data), /proxy\/protocol.*should be equal to one of the allowed values/);
            });

            it('should fail when invalid allowSelfSignedCert specified', () => {
                const data = {
                    class: 'Telemetry',
                    My_iHealth: {
                        class: 'Telemetry_iHealth_Poller',
                        username: 'username',
                        passphrase: {
                            cipherText: 'cipherText'
                        },
                        proxy: {
                            host: 'localhost',
                            allowSelfSignedCert: 'something'
                        }
                    }
                };
                return assert.isRejected(config.validate(data), /proxy\/allowSelfSignedCert.*should be boolean/);
            });

            it('should fail when invalid enableHostConnectivityCheck specified', () => {
                const data = {
                    class: 'Telemetry',
                    My_iHealth: {
                        class: 'Telemetry_iHealth_Poller',
                        username: 'username',
                        passphrase: {
                            cipherText: 'cipherText'
                        },
                        proxy: {
                            host: 'localhost',
                            enableHostConnectivityCheck: 'something'
                        }
                    }
                };
                return assert.isRejected(config.validate(data), /proxy\/enableHostConnectivityCheck.*should be boolean/);
            });

            it('should not allow additional properties', () => {
                const data = {
                    class: 'Telemetry',
                    My_iHealth: {
                        class: 'Telemetry_iHealth_Poller',
                        username: 'username',
                        passphrase: {
                            cipherText: 'cipherText'
                        },
                        proxy: {
                            host: 'localhost',
                            someProp: 'someValue'
                        }
                    }
                };
                return assert.isRejected(config.validate(data), /someProp.*should NOT have additional properties/);
            });

            it('should fail when passphrase specified alone', () => {
                const data = {
                    class: 'Telemetry',
                    My_iHealth: {
                        class: 'Telemetry_iHealth_Poller',
                        username: 'username',
                        passphrase: {
                            cipherText: 'cipherText'
                        },
                        proxy: {
                            host: 'localhost',
                            passphrase: {
                                cipherText: 'passphrase'
                            }
                        }
                    }
                };
                return assert.isRejected(config.validate(data), /should have property username when property passphrase is present/);
            });
        });

        describe('locations', () => {
            it('should pass with empty locations', () => {
                const data = {
                    class: 'Telemetry',
                    My_System: {
                        class: 'Telemetry_System',
                        systemPoller: {
                            actions: [
                                {
                                    setTag: {
                                        newTag: 'tag value'
                                    },
                                    locations: {}
                                }
                            ]
                        }
                    }
                };
                return config.validate(data)
                    .then((validConfig) => {
                        const actions = validConfig.My_System.systemPoller.actions;
                        assert.deepStrictEqual(actions[0].locations, {});
                    });
            });

            it('should pass with location type of boolean', () => {
                const data = {
                    class: 'Telemetry',
                    My_System: {
                        class: 'Telemetry_System',
                        systemPoller: {
                            actions: [
                                {
                                    setTag: {
                                        newTag: 'tag value'
                                    },
                                    locations: {
                                        a: true
                                    }
                                }
                            ]
                        }
                    }
                };
                return config.validate(data)
                    .then((validConfig) => {
                        const actions = validConfig.My_System.systemPoller.actions;
                        assert.deepStrictEqual(actions[0].locations, { a: true });
                    });
            });

            it('should fail with location type boolean with value of false', () => {
                const data = {
                    class: 'Telemetry',
                    My_System: {
                        class: 'Telemetry_System',
                        systemPoller: {
                            actions: [
                                {
                                    setTag: {
                                        newTag: 'tag value'
                                    },
                                    locations: {
                                        a: false
                                    }
                                }
                            ]
                        }
                    }
                };
                return assert.isRejected(config.validate(data), /should match exactly one schema in oneOf/);
            });

            it('should pass with object type location with single property', () => {
                const data = {
                    class: 'Telemetry',
                    My_System: {
                        class: 'Telemetry_System',
                        systemPoller: {
                            actions: [
                                {
                                    setTag: {
                                        newTag: 'tag value'
                                    },
                                    locations: {
                                        a: {
                                            b: true
                                        }
                                    }
                                }
                            ]
                        }
                    }
                };
                return config.validate(data)
                    .then((validConfig) => {
                        const actions = validConfig.My_System.systemPoller.actions;
                        assert.deepStrictEqual(actions[0].locations, { a: { b: true } });
                    });
            });

            it('should pass with object type location with multiple properties', () => {
                const data = {
                    class: 'Telemetry',
                    My_System: {
                        class: 'Telemetry_System',
                        systemPoller: {
                            actions: [
                                {
                                    setTag: {
                                        newTag: 'tag value'
                                    },
                                    locations: {
                                        a: {
                                            b: true,
                                            c: {
                                                d: true
                                            }
                                        }
                                    }
                                }
                            ]
                        }
                    }
                };
                return config.validate(data)
                    .then((validConfig) => {
                        const actions = validConfig.My_System.systemPoller.actions;
                        assert.deepStrictEqual(actions[0].locations, { a: { b: true, c: { d: true } } });
                    });
            });

            it('should fail with object type location with multiple properties and one is false', () => {
                const data = {
                    class: 'Telemetry',
                    My_System: {
                        class: 'Telemetry_System',
                        systemPoller: {
                            actions: [
                                {
                                    setTag: {
                                        newTag: 'tag value'
                                    },
                                    locations: {
                                        a: {
                                            b: true,
                                            c: {
                                                d: false
                                            }
                                        }
                                    }
                                }
                            ]
                        }
                    }
                };
                return assert.isRejected(config.validate(data), /should match exactly one schema in oneOf.*locations/);
            });

            it('should fail with object type location with multiple properties and one is invalid type', () => {
                const data = {
                    class: 'Telemetry',
                    My_System: {
                        class: 'Telemetry_System',
                        systemPoller: {
                            actions: [
                                {
                                    setTag: {
                                        newTag: 'tag value'
                                    },
                                    locations: {
                                        a: {
                                            b: true,
                                            c: {
                                                d: []
                                            }
                                        }
                                    }
                                }
                            ]
                        }
                    }
                };
                return assert.isRejected(config.validate(data), /should match exactly one schema in oneOf.*locations/);
            });

            it('should fail when multiple actions are in the same action object', () => {
                const data = {
                    class: 'Telemetry',
                    My_Poller: {
                        class: 'Telemetry_System_Poller',
                        interval: 90,
                        actions: [
                            {
                                enable: true,
                                includeData: {},
                                excludeData: {},
                                locations: {
                                    system: true
                                }
                            }
                        ]
                    }
                };
                return assert.isRejected(config.validate(data), /My_Poller\/actions\/0.*should NOT be valid/);
            });

            it('should fail when a location is not provided with includeData action', () => {
                const data = {
                    class: 'Telemetry',
                    My_Poller: {
                        class: 'Telemetry_System_Poller',
                        interval: 90,
                        actions: [
                            {
                                enable: true,
                                excludeData: {}
                            }
                        ]
                    }
                };
                return assert.isRejected(config.validate(data), /dependencies\/excludeData\/allOf\/0\/required.*should have required property 'locations'/);
            });

            it('should pass when regexes are used in action locations', () => {
                const data = {
                    class: 'Telemetry',
                    My_Poller: {
                        class: 'Telemetry_System_Poller',
                        interval: 90,
                        actions: [
                            {
                                enable: true,
                                includeData: {},
                                locations: {
                                    virtualServers: {
                                        vs$: true
                                    },
                                    pools: {
                                        '^/Common/Shared/': true
                                    }
                                }
                            }
                        ]
                    }
                };
                return config.validate(data)
                    .then((validConfig) => {
                        const poller = validConfig.My_Poller;
                        assert.deepStrictEqual(poller.actions[0].locations.virtualServers, { vs$: true });
                        assert.deepStrictEqual(poller.actions[0].locations.pools, { '^/Common/Shared/': true });
                    });
            });
        });
    });

    describe('AJV Custom Keywords', () => {
        describe('pathExists', () => {
            it('should fail to access directory from iHealth declaration', () => {
                const data = {
                    class: 'Telemetry',
                    My_iHealth: {
                        class: 'Telemetry_iHealth_Poller',
                        downloadFolder: '/some/invalid/dir',
                        username: 'username',
                        passphrase: {
                            cipherText: 'cipherText'
                        },
                        interval: {
                            timeWindow: {
                                start: '08:00',
                                end: '18:00'
                            },
                            frequency: 'daily'
                        }
                    }
                };
                return assert.isRejected(config.validate(data), /downloadFolder.*Unable to access path/);
            });

            it('should be able to access directory from iHealth declaration', () => {
                const data = {
                    class: 'Telemetry',
                    My_iHealth: {
                        class: 'Telemetry_iHealth_Poller',
                        downloadFolder: '/',
                        username: 'username',
                        passphrase: {
                            cipherText: 'cipherText'
                        },
                        interval: {
                            timeWindow: {
                                start: '08:00',
                                end: '18:00'
                            },
                            frequency: 'daily'
                        }
                    }
                };
                return assert.isFulfilled(config.validate(data));
            });
        });

        describe('f5secret', () => {
            it('should fail cipherText with wrong device type', () => {
                deviceUtil.getDeviceType = () => Promise.resolve(constants.CONTAINER_DEVICE_TYPE);
                const data = {
                    class: 'Telemetry',
                    My_Poller: {
                        class: 'Telemetry_System_Poller',
                        passphrase: {
                            cipherText: 'mycipher'
                        }
                    }
                };

                return assert.isRejected(config.validate(data), /requires running on BIG-IP/);
            });

            it('should not re-encrypt', () => {
                const cipher = '$M$foo';
                const data = {
                    class: 'Telemetry',
                    My_Poller: {
                        class: 'Telemetry_System_Poller',
                        passphrase: {
                            cipherText: cipher,
                            protected: 'SecureVault'
                        }
                    }
                };
                return config.validate(data)
                    .then(() => {
                        assert.strictEqual(data.My_Poller.passphrase.cipherText, cipher);
                    });
            });

            it('should base64 decode cipherText', () => {
                deviceUtil.encryptSecret = secret => Promise.resolve(secret);
                const cipher = 'ZjVzZWNyZXQ='; // f5secret
                const data = {
                    class: 'Telemetry',
                    My_Poller: {
                        class: 'Telemetry_System_Poller',
                        passphrase: {
                            cipherText: cipher,
                            protected: 'plainBase64'
                        }
                    }
                };
                return config.validate(data)
                    .then(() => {
                        assert.strictEqual(data.My_Poller.passphrase.cipherText, 'f5secret');
                    });
            });
        });

        describe('f5expand', () => {
            it('should expand pointer (absolute)', () => {
                const expectedValue = '/foo';
                const data = {
                    class: 'Telemetry',
                    Shared: {
                        class: 'Shared',
                        constants: {
                            class: 'Constants',
                            path: expectedValue
                        }
                    },
                    My_Consumer: {
                        class: 'Telemetry_Consumer',
                        type: 'Generic_HTTP',
                        host: '192.0.2.1',
                        path: '`=/Shared/constants/path`'
                    },
                    scratch: {
                        expand: true
                    }
                };

                return config.validate(data)
                    .then((validated) => {
                        assert.strictEqual(validated.My_Consumer.path, expectedValue);
                    });
            });

            it('should expand pointer (relative)', () => {
                const expectedValue = '192.0.2.1';
                const data = {
                    class: 'Telemetry',
                    My_Consumer: {
                        class: 'Telemetry_Consumer',
                        type: 'Generic_HTTP',
                        host: expectedValue,
                        path: '`=host`'
                    },
                    scratch: {
                        expand: true
                    }
                };

                return config.validate(data)
                    .then((validated) => {
                        assert.strictEqual(validated.My_Consumer.path, expectedValue);
                    });
            });

            it('should expand pointer (relative to class)', () => {
                const expectedValue = '192.0.2.1';
                const data = {
                    class: 'Telemetry',
                    My_Consumer: {
                        class: 'Telemetry_Consumer',
                        type: 'Generic_HTTP',
                        host: expectedValue,
                        path: '/',
                        headers: [
                            {
                                name: 'foo',
                                value: '`=@/host`'
                            }
                        ]
                    },
                    scratch: {
                        expand: true
                    }
                };

                return config.validate(data)
                    .then((validated) => {
                        assert.strictEqual(validated.My_Consumer.headers[0].value, expectedValue);
                    });
            });

            it('should expand pointer (multiple pointers in string)', () => {
                const expectedValue = '/foo/bar/baz';
                const data = {
                    class: 'Telemetry',
                    Shared: {
                        class: 'Shared',
                        constants: {
                            class: 'Constants',
                            path: 'foo',
                            path2: 'baz'
                        }
                    },
                    My_Consumer: {
                        class: 'Telemetry_Consumer',
                        type: 'Generic_HTTP',
                        host: '192.0.2.1',
                        path: '/`=/Shared/constants/path`/bar/`=/Shared/constants/path2`'
                    },
                    scratch: {
                        expand: true
                    }
                };

                return config.validate(data)
                    .then((validated) => {
                        assert.strictEqual(validated.My_Consumer.path, expectedValue);
                    });
            });

            it('should expand pointer (base64 decode)', () => {
                const expectedValue = 'foo';
                const data = {
                    class: 'Telemetry',
                    Shared: {
                        class: 'Shared',
                        constants: {
                            class: 'Constants',
                            path: 'Zm9v' // base64 'foo'
                        }
                    },
                    My_Consumer: {
                        class: 'Telemetry_Consumer',
                        type: 'Generic_HTTP',
                        host: '192.0.2.1',
                        path: '`+/Shared/constants/path`'
                    },
                    scratch: {
                        expand: true
                    }
                };

                return config.validate(data)
                    .then((validated) => {
                        assert.strictEqual(validated.My_Consumer.path, expectedValue);
                    });
            });

            it('should expand pointer (object)', () => {
                const resolvedSecret = 'bar';
                deviceUtil.encryptSecret = () => Promise.resolve(resolvedSecret);

                const expectedValue = {
                    class: 'Secret',
                    cipherText: resolvedSecret,
                    protected: 'SecureVault'
                };
                const data = {
                    class: 'Telemetry',
                    Shared: {
                        class: 'Shared',
                        secret: {
                            class: 'Secret',
                            cipherText: 'foo'
                        }
                    },
                    My_Consumer: {
                        class: 'Telemetry_Consumer',
                        type: 'Generic_HTTP',
                        host: '192.0.2.1',
                        path: '`>/Shared/secret`',
                        headers: [
                            {
                                name: 'foo',
                                value: '`>@/passphrase`'
                            }
                        ],
                        passphrase: {
                            class: 'Secret',
                            cipherText: 'foo'
                        }
                    },
                    scratch: {
                        expand: true
                    }
                };

                return config.validate(data)
                    .then((validated) => {
                        assert.deepEqual(validated.My_Consumer.path, expectedValue);
                        assert.deepEqual(validated.My_Consumer.headers[0].value, expectedValue);
                        return config.validate(validated);
                    });
            });

            it('should fail pointer (object) with additional chars', () => {
                deviceUtil.encryptSecret = secret => Promise.resolve(secret);

                const data = {
                    class: 'Telemetry',
                    My_Consumer: {
                        class: 'Telemetry_Consumer',
                        type: 'Generic_HTTP',
                        host: '192.0.2.1',
                        path: '`>passphrase`foo',
                        passphrase: {
                            cipherText: 'foo'
                        }
                    },
                    scratch: {
                        expand: true
                    }
                };
                return assert.isRejected(config.validate(data), /syntax requires single pointer/);
            });

            it('should fail pointer (absolute) outside \'Shared\'', () => {
                const data = {
                    class: 'Telemetry',
                    My_Consumer: {
                        class: 'Telemetry_Consumer',
                        type: 'Generic_HTTP',
                        host: '192.0.2.1',
                        path: '`=/class`'
                    },
                    scratch: {
                        expand: true
                    }
                };
                return assert.isRejected(config.validate(data), /requires pointers root to be 'Shared'/);
            });
        });

        describe('hostConnectivityCheck', () => {
            it('should pass host network check', () => {
                let called = false;
                networkCheckStub.callsFake(() => {
                    called = true;
                    return Promise.resolve();
                });

                const data = {
                    class: 'Telemetry',
                    My_Consumer: {
                        class: 'Telemetry_Consumer',
                        type: 'Graphite',
                        host: '192.0.2.1',
                        enableHostConnectivityCheck: true
                    }
                };
                return config.validate(data)
                    .then(() => {
                        assert.strictEqual(called, true);
                    });
            });

            it('should fail host network check', () => {
                const errMsg = 'failed network check';
                networkCheckStub.callsFake(() => Promise.reject(new Error(errMsg)));

                const data = {
                    class: 'Telemetry',
                    My_Consumer: {
                        class: 'Telemetry_Consumer',
                        type: 'Graphite',
                        host: '192.0.2.1',
                        enableHostConnectivityCheck: true
                    }
                };
                return assert.isRejected(config.validate(data), new RegExp(errMsg));
            });
        });
    });

    describe('Telemetry_System_Poller', () => {
        it('should pass miminal declaration', () => {
            const data = {
                class: 'Telemetry',
                My_Poller: {
                    class: 'Telemetry_System_Poller'
                }
            };
            return config.validate(data)
                .then((validConfig) => {
                    const poller = validConfig.My_Poller;
                    assert.notStrictEqual(poller, undefined);
                    assert.strictEqual(poller.class, 'Telemetry_System_Poller');
                    assert.strictEqual(poller.enable, true);
                    assert.strictEqual(poller.trace, false);
                    assert.strictEqual(poller.interval, 300);
                    assert.deepStrictEqual(poller.actions, [{ enable: true, setTag: { tenant: '`T`', application: '`A`' } }]);
                    assert.strictEqual(poller.actions[0].ifAllMAtch, undefined);
                    assert.strictEqual(poller.actions[0].locations, undefined);
                    assert.strictEqual(poller.host, 'localhost');
                    assert.strictEqual(poller.port, 8100);
                    assert.strictEqual(poller.protocol, 'http');
                    assert.strictEqual(poller.allowSelfSignedCert, undefined);
                    assert.strictEqual(poller.enableHostConnectivityCheck, undefined);
                    assert.strictEqual(poller.username, undefined);
                    assert.strictEqual(poller.passphrase, undefined);
                });
        });

        it('should pass full declaration', () => {
            const data = {
                class: 'Telemetry',
                My_Poller: {
                    class: 'Telemetry_System_Poller',
                    enable: true,
                    trace: true,
                    interval: 150,
                    tag: {
                        tenant: '`B`',
                        application: '`C`'
                    },
                    host: 'somehost',
                    port: 5000,
                    protocol: 'http',
                    allowSelfSignedCert: true,
                    enableHostConnectivityCheck: false,
                    username: 'username',
                    passphrase: {
                        cipherText: 'passphrase'
                    },
                    actions: [
                        {
                            enable: true,
                            setTag: {
                                tag1: 'tag1 value',
                                tag2: {}
                            },
                            ifAllMatch: {
                                system: {
                                    location: 'system_location'
                                }
                            },
                            locations: {
                                virtualServers: {
                                    '.*': true
                                }
                            }
                        },
                        {
                            enable: true,
                            includeData: {},
                            locations: {
                                system: true
                            },
                            ifAllMatch: {
                                system: {
                                    location: 'system_location'
                                }
                            }
                        },
                        {
                            enable: true,
                            excludeData: {},
                            locations: {
                                pools: true
                            },
                            ifAllMatch: {
                                system: {
                                    location: 'system_location'
                                }
                            }
                        }
                    ]
                }
            };
            return config.validate(data)
                .then((validConfig) => {
                    const poller = validConfig.My_Poller;
                    assert.notStrictEqual(poller, undefined);
                    assert.strictEqual(poller.class, 'Telemetry_System_Poller');
                    assert.strictEqual(poller.enable, true);
                    assert.strictEqual(poller.trace, true);
                    assert.strictEqual(poller.interval, 150);
                    assert.deepStrictEqual(poller.tag, { tenant: '`B`', application: '`C`' });
                    assert.strictEqual(poller.host, 'somehost');
                    assert.strictEqual(poller.port, 5000);
                    assert.strictEqual(poller.protocol, 'http');
                    assert.strictEqual(poller.allowSelfSignedCert, true);
                    assert.strictEqual(poller.enableHostConnectivityCheck, false);
                    assert.strictEqual(poller.username, 'username');
                    assert.strictEqual(poller.passphrase.cipherText, 'foo');
                    assert.strictEqual(poller.actions[0].enable, true);
                    // setTag action
                    assert.deepStrictEqual(poller.actions[0].setTag, { tag1: 'tag1 value', tag2: {} });
                    assert.deepStrictEqual(poller.actions[0].ifAllMatch, { system: { location: 'system_location' } });
                    assert.deepStrictEqual(poller.actions[0].locations, { virtualServers: { '.*': true } });
                    // includeData action
                    assert.deepStrictEqual(poller.actions[1].includeData, {});
                    assert.deepStrictEqual(poller.actions[1].locations, { system: true });
                    assert.deepStrictEqual(poller.actions[1].ifAllMatch, { system: { location: 'system_location' } });
                    // excludeData action
                    assert.deepStrictEqual(poller.actions[2].excludeData, {});
                    assert.deepStrictEqual(poller.actions[2].locations, { pools: true });
                    assert.deepStrictEqual(poller.actions[2].ifAllMatch, { system: { location: 'system_location' } });
                });
        });

        it('should not allow additional properties', () => {
            const data = {
                class: 'Telemetry',
                My_Poller: {
                    class: 'Telemetry_System_Poller',
                    someProp: 'someValue'
                }
            };
            return assert.isRejected(config.validate(data), /someProp.*should NOT have additional properties/);
        });
    });

    describe('Telemetry_Listener', () => {
        it('should pass miminal declaration', () => {
            const data = {
                class: 'Telemetry',
                My_Listener: {
                    class: 'Telemetry_Listener'
                }
            };
            return config.validate(data)
                .then((validConfig) => {
                    const listener = validConfig.My_Listener;
                    assert.notStrictEqual(listener, undefined);
                    assert.strictEqual(listener.class, 'Telemetry_Listener');
                    assert.strictEqual(listener.enable, true);
                    assert.strictEqual(listener.trace, false);
                    assert.strictEqual(listener.port, 6514);
                    assert.deepStrictEqual(listener.actions, [{ enable: true, setTag: { tenant: '`T`', application: '`A`' } }]);
                    assert.deepStrictEqual(listener.match, '');
                });
        });

        it('should pass full declaration', () => {
            const data = {
                class: 'Telemetry',
                My_Listener: {
                    class: 'Telemetry_Listener',
                    enable: true,
                    trace: true,
                    port: 5000,
                    tag: {
                        tenant: '`B`',
                        application: '`C`'
                    },
                    match: 'matchSomething',
                    actions: [
                        {
                            enable: true,
                            setTag: {
                                tag1: 'tag1 value',
                                tag2: {}
                            },
                            ifAllMatch: {
                                system: {
                                    location: 'system_location'
                                }
                            },
                            locations: {
                                virtualServers: {
                                    '.*': true
                                }
                            }
                        },
                        {
                            enable: true,
                            includeData: {},
                            locations: {
                                system: true
                            },
                            ifAllMatch: {
                                system: {
                                    location: 'system_location'
                                }
                            }
                        },
                        {
                            enable: true,
                            excludeData: {},
                            locations: {
                                pools: true
                            },
                            ifAllMatch: {
                                system: {
                                    location: 'system_location'
                                }
                            }
                        }
                    ]
                }
            };
            return config.validate(data)
                .then((validConfig) => {
                    const listener = validConfig.My_Listener;
                    assert.notStrictEqual(listener, undefined);
                    assert.strictEqual(listener.class, 'Telemetry_Listener');
                    assert.strictEqual(listener.enable, true);
                    assert.strictEqual(listener.trace, true);
                    assert.strictEqual(listener.port, 5000);
                    assert.deepStrictEqual(listener.tag, { tenant: '`B`', application: '`C`' });
                    assert.deepStrictEqual(listener.match, 'matchSomething');
                    assert.strictEqual(listener.actions[0].enable, true);
                    // setTag action
                    assert.deepStrictEqual(listener.actions[0].setTag, { tag1: 'tag1 value', tag2: {} });
                    assert.deepStrictEqual(listener.actions[0].ifAllMatch, { system: { location: 'system_location' } });
                    assert.deepStrictEqual(listener.actions[0].locations, { virtualServers: { '.*': true } });
                    // includeData action
                    assert.deepStrictEqual(listener.actions[1].includeData, {});
                    assert.deepStrictEqual(listener.actions[1].locations, { system: true });
                    assert.deepStrictEqual(listener.actions[1].ifAllMatch, { system: { location: 'system_location' } });
                    // excludeData action
                    assert.deepStrictEqual(listener.actions[2].excludeData, {});
                    assert.deepStrictEqual(listener.actions[2].locations, { pools: true });
                    assert.deepStrictEqual(listener.actions[2].ifAllMatch, { system: { location: 'system_location' } });
                });
        });

        it('should not allow additional properties in declaration', () => {
            const data = {
                class: 'Telemetry',
                My_Poller: {
                    class: 'Telemetry_Listener',
                    someProp: 'someValue'
                }
            };
            return assert.isRejected(config.validate(data), /someProp.*should NOT have additional properties/);
        });
    });

    describe('Telemetry_iHealth_Poller', () => {
        it('should pass miminal declaration', () => {
            const data = {
                class: 'Telemetry',
                My_iHealth_Poller: {
                    class: 'Telemetry_iHealth_Poller',
                    username: 'username',
                    passphrase: {
                        cipherText: 'passphrase'
                    },
                    interval: {
                        timeWindow: {
                            start: '00:00',
                            end: '03:00'
                        }
                    }
                }
            };
            return config.validate(data)
                .then((validConfig) => {
                    const poller = validConfig.My_iHealth_Poller;
                    assert.notStrictEqual(poller, undefined);
                    assert.strictEqual(poller.class, 'Telemetry_iHealth_Poller');
                    assert.strictEqual(poller.username, 'username');
                    assert.strictEqual(poller.passphrase.cipherText, 'foo');
                    assert.deepStrictEqual(poller.interval, {
                        timeWindow: {
                            start: '00:00',
                            end: '03:00'
                        },
                        frequency: 'daily'
                    });
                });
        });

        it('should pass full declaration', () => {
            const data = {
                class: 'Telemetry',
                My_iHealth_Poller: {
                    class: 'Telemetry_iHealth_Poller',
                    username: 'username',
                    passphrase: {
                        cipherText: 'passphrase'
                    },
                    interval: {
                        frequency: 'weekly',
                        day: 1,
                        timeWindow: {
                            start: '00:00',
                            end: '03:00'
                        }
                    },
                    proxy: {
                        host: 'localhost',
                        protocol: 'https',
                        port: 80,
                        allowSelfSignedCert: true,
                        enableHostConnectivityCheck: false,
                        username: 'username',
                        passphrase: {
                            cipherText: 'passphrase'
                        }
                    }
                }
            };
            return config.validate(data)
                .then((validConfig) => {
                    const poller = validConfig.My_iHealth_Poller;
                    assert.notStrictEqual(poller, undefined);
                    assert.strictEqual(poller.class, 'Telemetry_iHealth_Poller');
                    assert.strictEqual(poller.username, 'username');
                    assert.strictEqual(poller.passphrase.cipherText, 'foo');
                    assert.deepStrictEqual(poller.interval, {
                        frequency: 'weekly',
                        day: 1,
                        timeWindow: {
                            start: '00:00',
                            end: '03:00'
                        }
                    });
                    const proxy = poller.proxy;
                    assert.strictEqual(proxy.protocol, 'https');
                    assert.strictEqual(proxy.host, 'localhost');
                    assert.strictEqual(proxy.port, 80);
                    assert.strictEqual(proxy.allowSelfSignedCert, true);
                    assert.strictEqual(proxy.enableHostConnectivityCheck, false);
                    assert.strictEqual(proxy.username, 'username');
                    assert.strictEqual(proxy.passphrase.cipherText, 'foo');
                });
        });

        it('should not allow additional properties in declaration', () => {
            const data = {
                class: 'Telemetry',
                My_iHealth_Poller: {
                    class: 'Telemetry_iHealth_Poller',
                    username: 'username',
                    passphrase: {
                        cipherText: 'passphrase'
                    },
                    someProp: 'someValue'
                }
            };
            return assert.isRejected(config.validate(data), /someProp.*should NOT have additional properties/);
        });

        it('should not allow empty string as downloadFolder\' value', () => {
            const data = {
                class: 'Telemetry',
                My_iHealth_Poller: {
                    class: 'Telemetry_iHealth_Poller',
                    username: 'username',
                    passphrase: {
                        cipherText: 'passphrase'
                    },
                    downloadFolder: ''
                }
            };
            return assert.isRejected(config.validate(data), /downloadFolder.*minLength/);
        });

        describe('interval', () => {
            it('should pass minimal declaration', () => {
                const data = {
                    class: 'Telemetry',
                    My_iHealth: {
                        class: 'Telemetry_iHealth_Poller',
                        username: 'username',
                        passphrase: {
                            cipherText: 'cipherText'
                        },
                        interval: {
                            frequency: 'daily',
                            timeWindow: {
                                start: '00:00',
                                end: '03:00'
                            }
                        }
                    }
                };
                return assert.isFulfilled(config.validate(data));
            });

            it('should pass full declaration', () => {
                const data = {
                    class: 'Telemetry',
                    My_iHealth: {
                        class: 'Telemetry_iHealth_Poller',
                        username: 'username',
                        passphrase: {
                            cipherText: 'cipherText'
                        },
                        interval: {
                            frequency: 'weekly',
                            day: 'Sunday',
                            timeWindow: {
                                start: '00:00',
                                end: '03:00'
                            }
                        }
                    }
                };
                return assert.isFulfilled(config.validate(data));
            });

            it('should not allow additional properties', () => {
                const data = {
                    class: 'Telemetry',
                    My_iHealth: {
                        class: 'Telemetry_iHealth_Poller',
                        username: 'username',
                        passphrase: {
                            cipherText: 'cipherText'
                        },
                        interval: {
                            frequency: 'weekly',
                            day: 'Sunday',
                            timeWindow: {
                                start: '00:00',
                                end: '03:00'
                            },
                            someProp: 'someValue'
                        }
                    }
                };
                return assert.isRejected(config.validate(data), /someProp.*should NOT have additional properties/);
            });

            it('should fail parse invalid time string', () => {
                const data = {
                    class: 'Telemetry',
                    My_iHealth: {
                        class: 'Telemetry_iHealth_Poller',
                        username: 'username',
                        passphrase: {
                            cipherText: 'cipherText'
                        },
                        interval: {
                            frequency: 'daily',
                            timeWindow: {
                                start: '3456',
                                end: '6789'
                            }
                        }
                    }
                };
                return assert.isRejected(config.validate(data), /interval.timeWindow.start.*should match pattern/);
            });

            it('should preserve difference between start and end time (2hr min)', () => {
                const data = {
                    class: 'Telemetry',
                    My_iHealth: {
                        class: 'Telemetry_iHealth_Poller',
                        username: 'username',
                        passphrase: {
                            cipherText: 'cipherText'
                        },
                        interval: {
                            frequency: 'daily',
                            timeWindow: {
                                start: '23:00',
                                end: '00:59'
                            }
                        }
                    }
                };
                return assert.isRejected(config.validate(data), /interval.timeWindow.*specify window with size of a/);
            });

            it('should fail when invalid weekly day name specified', () => {
                const data = {
                    class: 'Telemetry',
                    My_iHealth: {
                        class: 'Telemetry_iHealth_Poller',
                        username: 'username',
                        passphrase: {
                            cipherText: 'cipherText'
                        },
                        interval: {
                            frequency: 'weekly',
                            day: 'satursunday',
                            timeWindow: {
                                start: '00:00',
                                end: '03:00'
                            }
                        }
                    }
                };
                return assert.isRejected(config.validate(data), /interval.day.*should match pattern/);
            });

            it('should fail when invalid weekly day specified', () => {
                const data = {
                    class: 'Telemetry',
                    My_iHealth: {
                        class: 'Telemetry_iHealth_Poller',
                        username: 'username',
                        passphrase: {
                            cipherText: 'cipherText'
                        },
                        interval: {
                            frequency: 'weekly',
                            day: 8,
                            timeWindow: {
                                start: '00:00',
                                end: '03:00'
                            }
                        }
                    }
                };
                return assert.isRejected(config.validate(data), /interval.day.*should be <= 7/);
            });

            it('should fail when invalid monthly day specified', () => {
                const data = {
                    class: 'Telemetry',
                    My_iHealth: {
                        class: 'Telemetry_iHealth_Poller',
                        username: 'username',
                        passphrase: {
                            cipherText: 'cipherText'
                        },
                        interval: {
                            frequency: 'monthly',
                            day: 35,
                            timeWindow: {
                                start: '00:00',
                                end: '03:00'
                            }
                        }
                    }
                };
                return assert.isRejected(config.validate(data), /interval.day.*should be <= 31/);
            });
        });
    });

    describe('Telemetry_System', () => {
        it('should pass miminal declaration', () => {
            const data = {
                class: 'Telemetry',
                My_System: {
                    class: 'Telemetry_System'
                }
            };
            return config.validate(data)
                .then((validConfig) => {
                    const system = validConfig.My_System;
                    assert.notStrictEqual(system, undefined);
                    assert.strictEqual(system.class, 'Telemetry_System');
                    assert.strictEqual(system.enable, true);
                    assert.strictEqual(system.trace, false);
                    assert.strictEqual(system.host, 'localhost');
                    assert.strictEqual(system.port, 8100);
                    assert.strictEqual(system.protocol, 'http');
                    assert.strictEqual(system.allowSelfSignedCert, undefined);
                    assert.strictEqual(system.enableHostConnectivityCheck, undefined);
                    assert.strictEqual(system.username, undefined);
                    assert.strictEqual(system.passphrase, undefined);
                });
        });

        it('should pass full declaration', () => {
            const data = {
                class: 'Telemetry',
                My_System: {
                    class: 'Telemetry_System',
                    enable: true,
                    trace: true,
                    host: 'somehost',
                    port: 5000,
                    protocol: 'http',
                    allowSelfSignedCert: true,
                    enableHostConnectivityCheck: false,
                    username: 'username',
                    passphrase: {
                        cipherText: 'passphrase'
                    }
                }
            };
            return config.validate(data)
                .then((validConfig) => {
                    const system = validConfig.My_System;
                    assert.notStrictEqual(system, undefined);
                    assert.strictEqual(system.class, 'Telemetry_System');
                    assert.strictEqual(system.enable, true);
                    assert.strictEqual(system.trace, true);
                    assert.strictEqual(system.host, 'somehost');
                    assert.strictEqual(system.port, 5000);
                    assert.strictEqual(system.protocol, 'http');
                    assert.strictEqual(system.allowSelfSignedCert, true);
                    assert.strictEqual(system.enableHostConnectivityCheck, false);
                    assert.strictEqual(system.username, 'username');
                    assert.strictEqual(system.passphrase.cipherText, 'foo');
                });
        });

        it('should not allow additional properties', () => {
            const data = {
                class: 'Telemetry',
                My_System: {
                    class: 'Telemetry_System',
                    someProp: 'someValue'
                }
            };
            return assert.isRejected(config.validate(data), /someProp.*should NOT have additional properties/);
        });

        it('should allow to attach poller declaration by name', () => {
            const data = {
                class: 'Telemetry',
                My_System_Poller: {
                    class: 'Telemetry_System_Poller'
                },
                My_System: {
                    class: 'Telemetry_System',
                    systemPoller: 'My_System_Poller'
                }
            };
            return assert.isFulfilled(config.validate(data));
        });

        it('should fail when non-existing poller declaration attached', () => {
            const data = {
                class: 'Telemetry',
                My_System: {
                    class: 'Telemetry_System',
                    systemPoller: 'My_System_Poller_Non_existing'
                }
            };
            return assert.isRejected(config.validate(data), /declaration with name.*(Telemetry_System_Poller|My_System_Poller_Non_existing)/);
        });

        it('should fail when poller declaration specified by name with invalid type', () => {
            const data = {
                class: 'Telemetry',
                My_System_2: {
                    class: 'Telemetry_System'
                },
                My_System: {
                    class: 'Telemetry_System',
                    systemPoller: 'My_System_2'
                }
            };
            return assert.isRejected(config.validate(data), /declaration with name.*(Telemetry_System_Poller|My_System_2)/);
        });

        it('should allow to attach inline System Poller minimal declaration', () => {
            const data = {
                class: 'Telemetry',
                My_System: {
                    class: 'Telemetry_System',
                    systemPoller: {
                    }
                }
            };
            return config.validate(data)
                .then((validConfig) => {
                    const poller = validConfig.My_System.systemPoller;
                    assert.notStrictEqual(poller, undefined);
                    assert.strictEqual(poller.enable, true);
                    assert.strictEqual(poller.trace, false);
                    assert.strictEqual(poller.interval, 300);
                    assert.deepStrictEqual(poller.actions, [{ enable: true, setTag: { tenant: '`T`', application: '`A`' } }]);
                    assert.strictEqual(poller.actions[0].ifAllMAtch, undefined);
                    assert.strictEqual(poller.actions[0].locations, undefined);
                    assert.strictEqual(poller.host, undefined);
                    assert.strictEqual(poller.port, undefined);
                    assert.strictEqual(poller.protocol, undefined);
                    assert.strictEqual(poller.allowSelfSignedCert, undefined);
                    assert.strictEqual(poller.enableHostConnectivityCheck, undefined);
                    assert.strictEqual(poller.username, undefined);
                    assert.strictEqual(poller.passphrase, undefined);
                });
        });

        it('should allow to attach inline System Poller full declaration', () => {
            const data = {
                class: 'Telemetry',
                My_System: {
                    class: 'Telemetry_System',
                    systemPoller: {
                        enable: true,
                        trace: true,
                        interval: 150,
                        tag: {
                            tenant: '`B`',
                            application: '`C`'
                        },
                        actions: [
                            {
                                enable: true,
                                setTag: {
                                    tag1: 'tag1 value',
                                    tag2: {}
                                },
                                ifAllMatch: {
                                    system: {
                                        location: 'system_location'
                                    }
                                },
                                locations: {
                                    virtualServers: {
                                        '.*': true
                                    }
                                }
                            }
                        ]
                    }
                }
            };
            return config.validate(data)
                .then((validConfig) => {
                    const poller = validConfig.My_System.systemPoller;
                    assert.notStrictEqual(poller, undefined);
                    assert.strictEqual(poller.enable, true);
                    assert.strictEqual(poller.trace, true);
                    assert.strictEqual(poller.interval, 150);
                    assert.deepStrictEqual(poller.tag, { tenant: '`B`', application: '`C`' });
                    assert.strictEqual(poller.actions[0].enable, true);
                    assert.deepStrictEqual(poller.actions[0].setTag, { tag1: 'tag1 value', tag2: {} });
                    assert.deepStrictEqual(poller.actions[0].ifAllMatch, { system: { location: 'system_location' } });
                    assert.deepStrictEqual(poller.actions[0].locations, { virtualServers: { '.*': true } });
                    assert.strictEqual(poller.host, undefined);
                    assert.strictEqual(poller.port, undefined);
                    assert.strictEqual(poller.protocol, undefined);
                    assert.strictEqual(poller.allowSelfSignedCert, undefined);
                    assert.strictEqual(poller.enableHostConnectivityCheck, undefined);
                    assert.strictEqual(poller.username, undefined);
                    assert.strictEqual(poller.passphrase, undefined);
                });
        });

        it('should not-allow to attach inline System Poller declaration with specified host', () => {
            const data = {
                class: 'Telemetry',
                My_System: {
                    class: 'Telemetry_System',
                    systemPoller: {
                        host: 'localhost'
                    }
                }
            };
            return assert.isRejected(config.validate(data), /systemPoller.*should NOT have additional properties/);
        });

        it('should allow to attach inline iHealth Poller minimal declaration', () => {
            const data = {
                class: 'Telemetry',
                My_System: {
                    class: 'Telemetry_System',
                    iHealthPoller: {
                        username: 'username',
                        passphrase: {
                            cipherText: 'passphrase'
                        },
                        interval: {
                            timeWindow: {
                                start: '00:00',
                                end: '03:00'
                            }
                        }
                    }
                }
            };
            return config.validate(data)
                .then((validConfig) => {
                    const poller = validConfig.My_System.iHealthPoller;
                    assert.notStrictEqual(poller, undefined);
                    assert.strictEqual(poller.username, 'username');
                    assert.strictEqual(poller.passphrase.cipherText, 'foo');
                    assert.deepStrictEqual(poller.interval, {
                        timeWindow: {
                            start: '00:00',
                            end: '03:00'
                        },
                        frequency: 'daily'
                    });
                });
        });

        it('should allow to attach inline iHealth Poller full declaration', () => {
            const data = {
                class: 'Telemetry',
                My_System: {
                    class: 'Telemetry_System',
                    iHealthPoller: {
                        username: 'username',
                        passphrase: {
                            cipherText: 'passphrase'
                        },
                        interval: {
                            frequency: 'weekly',
                            day: 1,
                            timeWindow: {
                                start: '00:00',
                                end: '03:00'
                            }
                        },
                        proxy: {
                            host: 'localhost',
                            protocol: 'https',
                            port: 80,
                            allowSelfSignedCert: true,
                            enableHostConnectivityCheck: false,
                            username: 'username',
                            passphrase: {
                                cipherText: 'passphrase'
                            }
                        }
                    }
                }
            };
            return config.validate(data)
                .then((validConfig) => {
                    const poller = validConfig.My_System.iHealthPoller;
                    assert.notStrictEqual(poller, undefined);
                    assert.strictEqual(poller.username, 'username');
                    assert.strictEqual(poller.passphrase.cipherText, 'foo');
                    assert.deepStrictEqual(poller.interval, {
                        frequency: 'weekly',
                        day: 1,
                        timeWindow: {
                            start: '00:00',
                            end: '03:00'
                        }
                    });
                    const proxy = poller.proxy;
                    assert.strictEqual(proxy.protocol, 'https');
                    assert.strictEqual(proxy.host, 'localhost');
                    assert.strictEqual(proxy.port, 80);
                    assert.strictEqual(proxy.allowSelfSignedCert, true);
                    assert.strictEqual(proxy.enableHostConnectivityCheck, false);
                    assert.strictEqual(proxy.username, 'username');
                    assert.strictEqual(proxy.passphrase.cipherText, 'foo');
                });
        });

        it('should allow to attach inline declaration for System Poller and iHealth Poller', () => {
            const data = {
                class: 'Telemetry',
                My_System: {
                    class: 'Telemetry_System',
                    iHealthPoller: {
                        username: 'username',
                        passphrase: {
                            cipherText: 'passphrase'
                        },
                        interval: {
                            timeWindow: {
                                start: '00:00',
                                end: '03:00'
                            }
                        }
                    },
                    systemPoller: {
                        interval: 150
                    }
                }
            };
            return assert.isFulfilled(config.validate(data));
        });
    });
});