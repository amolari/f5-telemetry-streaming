/*
 * Copyright 2021. F5 Networks, Inc. See End User License Agreement ("EULA") for
 * license terms. Notwithstanding anything to the contrary in the EULA, Licensee
 * may copy and modify this software product for its internal business purposes.
 * Further, Licensee may upload, publish and distribute the modified version of
 * the software product on devcentral.f5.com.
 */

'use strict';

/* eslint-disable import/order */

require('../shared/restoreCache')();

const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const sinon = require('sinon');

const errors = require('../../../src/lib/errors');
const pullConsumers = require('../../../src/lib/pullConsumers');
const PullConsumerHandler = require('../../../src/lib/requestHandlers/pullConsumerHandler');
const ErrorHandler = require('../../../src/lib/requestHandlers/errorHandler');
const testUtil = require('../shared/util');

chai.use(chaiAsPromised);
const assert = chai.assert;


describe('PullConsumerHandler', () => {
    let restOpMock;
    let requestHandler;

    afterEach(() => {
        sinon.restore();
    });

    const assertUnknownError = () => {
        sinon.stub(pullConsumers, 'getData').rejects(new Error('expectedError'));
        return assert.isRejected(requestHandler.process(), 'expectedError');
    };

    const assertConfigLookupError = () => {
        sinon.stub(pullConsumers, 'getData').rejects(new errors.ConfigLookupError('expectedError'));
        return requestHandler.process()
            .then((handler) => {
                assert.isTrue(handler instanceof ErrorHandler, 'should return a reference to error handler');
                assert.strictEqual(handler.getCode(), 404, 'should return expected code');
                assert.deepStrictEqual(handler.getBody(), {
                    code: 404,
                    message: 'expectedError'
                }, 'should return expected body');
            });
    };

    describe('/pullconsumer/:consumer', () => {
        beforeEach(() => {
            restOpMock = new testUtil.MockRestOperation({ method: 'GET' });
            restOpMock.uri = testUtil.parseURL('http://localhost:8100/mgmt/shared/telemetry/pullconsumer/consumer');
            requestHandler = new PullConsumerHandler(restOpMock, { consumer: 'consumer' });
        });

        it('should return 200 on GET request', () => {
            let consumerNameFromRequest;
            const expectedData = { pullconsumer: 'pullconsumer' };
            sinon.stub(pullConsumers, 'getData').callsFake((consumerName) => {
                consumerNameFromRequest = consumerName;
                return Promise.resolve(testUtil.deepCopy(expectedData));
            });
            return requestHandler.process()
                .then((handler) => {
                    assert.ok(handler === requestHandler, 'should return a reference to original handler');
                    assert.strictEqual(requestHandler.getCode(), 200, 'should return expected code');
                    assert.deepStrictEqual(requestHandler.getBody(), expectedData, 'should return expected body');
                    assert.strictEqual(consumerNameFromRequest, 'consumer', 'should match name from request');
                });
        });

        it('should return 404 when unable to make config lookup', assertConfigLookupError);

        it('should reject when caught unknown error', assertUnknownError);
    });

    describe('/namespace/:namespace/pullconsumer/:consumer', () => {
        beforeEach(() => {
            restOpMock = new testUtil.MockRestOperation({ method: 'GET' });
            restOpMock.uri = testUtil.parseURL('http://localhost:8100/mgmt/shared/telemetry/namespace/somenamespace/pullconsumer/consumer');
            requestHandler = new PullConsumerHandler(restOpMock, { consumer: 'consumer', namespace: 'somenamespace' });
        });

        it('should return 200 on GET request (with namespace in path)', () => {
            let consumerNameFromRequest;
            let namespaceFromRequest;
            const expectedData = { name: 'consumer', namespace: 'somenamespace' };
            sinon.stub(pullConsumers, 'getData').callsFake((consumerName, namespace) => {
                consumerNameFromRequest = consumerName;
                namespaceFromRequest = namespace;
                return Promise.resolve(testUtil.deepCopy(expectedData));
            });
            return requestHandler.process()
                .then((handler) => {
                    assert.ok(handler === requestHandler, 'should return a reference to original handler');
                    assert.strictEqual(requestHandler.getCode(), 200, 'should return expected code');
                    assert.deepStrictEqual(requestHandler.getBody(), expectedData, 'should return expected body');
                    assert.strictEqual(consumerNameFromRequest, 'consumer', 'should match consumer name from request');
                    assert.strictEqual(namespaceFromRequest, 'somenamespace', 'should match namespace from request');
                });
        });

        it('should return 404 when unable to make config lookup', assertConfigLookupError);

        it('should reject when caught unknown error', assertUnknownError);
    });
});
