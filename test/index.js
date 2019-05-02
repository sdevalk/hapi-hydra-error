'use strict';

const Boom = require('boom');
const Code = require('code');
const Hapi = require('hapi');
const Lab = require('lab');

const { describe, it } = exports.lab = Lab.script();
const expect = Code.expect;
const internals = {};

describe('Hapi Hydra Error', () => {

    describe('registerPlugin', () => {

        const registerWithBadValues = (provider) => {

            it('rejects if options are invalid', async () => {

                const server = new Hapi.Server();

                const plugin = {
                    plugin: require('..'),
                    options: provider.options
                };

                await expect(server.register(plugin)).to.reject(provider.expectedMessage);
            });
        };

        registerWithBadValues({
            options: {},
            expectedMessage: 'child "context" fails because ["context" is required]'
        });

        registerWithBadValues({
            options: {
                context: null
            },
            expectedMessage: 'child "context" fails because ["context" must be an object]'
        });

        registerWithBadValues({
            options: {
                context: {
                    path: null
                }
            },
            expectedMessage: 'child "context" fails because [child "path" fails because ["path" must be a string]]'
        });

        registerWithBadValues({
            options: {
                context: {
                    path: ''
                }
            },
            expectedMessage: 'child "context" fails because [child "path" fails because ["path" is not allowed to be empty]]'
        });

        it('registers plugin', async () => {

            const server = new Hapi.Server();

            const plugin = {
                plugin: require('..'),
                options: {
                    context: {
                        path: '/error.jsonld'
                    }
                }
            };

            await expect(server.register(plugin)).to.not.reject();

            expect(server.plugins['hapi-hydra-error'].settings).to.equal({
                context: {
                    path: '/error.jsonld'
                }
            });
        });
    });

    describe('onPreResponse', () => {

        it('does not return an error response if no error occurred', async () => {

            const server = await internals.getServerWithPlugin();

            server.route({
                method: 'GET',
                path: '/',
                handler: (request, h) => 'ok'
            });

            const response = await server.inject('/');

            expect(response.statusCode).to.equal(200);
            expect(response.headers['content-type']).to.equal('text/html; charset=utf-8');
            expect(response.headers.link).to.be.undefined();
            expect(response.result).to.equal('ok');
        });

        it('returns an error response with default description', async () => {

            const server = await internals.getServerWithPlugin();

            server.route({
                method: 'GET',
                path: '/',
                handler: (request, h) => {

                    throw Boom.badRequest(); // No error message
                }
            });

            const response = await server.inject('/');

            expect(response.statusCode).to.equal(400);
            expect(response.headers['content-type']).to.equal('application/json; charset=utf-8');
            expect(response.headers.link).to.equal('</error.jsonld>; rel="http://www.w3.org/ns/json-ld#context"; type="application/ld+json"');
            expect(response.result).to.equal({
                type: 'hydra:Error',
                'hydra:title': 'Bad Request',
                'hydra:description': 'Bad Request'
            });
        });

        it('returns an error response with custom description', async () => {

            const server = await internals.getServerWithPlugin();

            server.route({
                method: 'GET',
                path: '/',
                handler: (request, h) => {

                    throw Boom.badRequest('Some message');
                }
            });

            const response = await server.inject('/');

            expect(response.statusCode).to.equal(400);
            expect(response.headers['content-type']).to.equal('application/json; charset=utf-8');
            expect(response.headers.link).to.equal('</error.jsonld>; rel="http://www.w3.org/ns/json-ld#context"; type="application/ld+json"');
            expect(response.result).to.equal({
                type: 'hydra:Error',
                'hydra:title': 'Bad Request',
                'hydra:description': 'Some message'
            });
        });

        it('returns an error response with existing error headers', async () => {

            const server = await internals.getServerWithPlugin();

            server.route({
                method: 'GET',
                path: '/',
                handler: (request, h) => {

                    throw Boom.unauthorized('Bad', 'Basic');
                }
            });

            const response = await server.inject('/');

            expect(response.statusCode).to.equal(401);
            expect(response.headers['content-type']).to.equal('application/json; charset=utf-8');
            expect(response.headers.link).to.equal('</error.jsonld>; rel="http://www.w3.org/ns/json-ld#context"; type="application/ld+json"');
            expect(response.headers['www-authenticate']).to.equal('Basic error="Bad"');
            expect(response.result).to.equal({
                type: 'hydra:Error',
                'hydra:title': 'Unauthorized',
                'hydra:description': 'Bad'
            });
        });
    });
});

internals.getServerWithPlugin = async function () {

    const server = new Hapi.Server();

    const plugin = {
        plugin: require('..'),
        options: {
            context: {
                path: '/error.jsonld'
            }
        }
    };

    await server.register(plugin);

    return server;
};
