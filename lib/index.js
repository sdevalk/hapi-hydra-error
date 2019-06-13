'use strict';

const Joi = require('@hapi/joi');

const internals = {};

internals.schemas = {
    registerPlugin: Joi.object({
        context: Joi.object({
            path: Joi.string().required()
        }).required()
    }).required()
};

internals.registerPlugin = async function (server, options) {

    options = await Joi.validate(options, internals.schemas.registerPlugin);

    server.expose('settings', options);
    server.ext('onPreResponse', internals.renderError);
};

exports.plugin = {
    name: 'hapi-hydra-error',
    register: internals.registerPlugin
};

internals.renderError = function (request, h) {

    let response = request.response;

    if (!response.isBoom) {
        return h.continue;
    }

    const error = response;

    const payload = {
        type: 'Error',
        title: error.output.payload.error,
        description: error.output.payload.message
    };

    response = h.response(payload).code(error.output.statusCode);

    // Add existing error headers, if any, to the response
    const headers = error.output.headers;

    for (const key in headers) {
        response.header(key, headers[key]);
    }

    const settings = request.server.plugins[exports.plugin.name].settings;
    const linkUri = `<${settings.context.path}>; rel="http://www.w3.org/ns/json-ld#context"; type="application/ld+json"`;
    response.header('Link', linkUri);

    return response;
};
