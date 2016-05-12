'use strict'
const Promise = require('bluebird')
const rp = require('request-promise')
const _ = require('lodash')

const defaults = {
  host: 'cp.pushwoosh.com',
  url: 'https://cp.pushwoosh.com/json',
  version: '1.3'
}
/**
 * Pushwoosh-node
 * @param  {String} app     application id
 * @param  {String} token   api token
 * @param  {Object} options
 * @return {Object}         Pushwoosh API client
 */
module.exports = (app, token, options) => {
  options = options || {}
  if (!_.isString(app) || !_.isString(token)) {
    throw new Error('Pushwoosh Application ID and an Authentication Token must be set')
  }

  let handleSuccess = (resolve, cb) => {
    let args = _.takeRigh(_.toArray(arguments), 2)
    if (_.isFunction(cb)) {
      cb.apply(this, args.unshift(null))
    }
    return resolve.apply(this, args)
  }

  let handleRejection = (reject, cb) => {
    let args = _.takeRigh(_.toArray(arguments), 2)
    if (_.isFunction(cb)) {
      cb.apply(this, args)
    }
    return reject.apply(this, args)
  }

  return {
    app: app,
    token: token,
    host: options.host || defaults.host,
    version: options.version || defaults.version,
    useAppGroup: options.useAppGroup,
    timeout: options.timeout || 31000,

    /**
     * Send a request to PushWoosh API
     * @param  {String}   action the endpoint to call on the API
     * @param  {Object}   data   the data to send to the API
     * @param  {Function} cb     the optional callback to handle the API response
     * @return {Promise}         a Promise for the API response
     */
    sendRequest: (action, data, cb) => {
      let self = this
      return new Promise((resolve, reject) => {
        return rp({
          method: 'POST',
          json: true,
          resolveWithFullResponse: true,
          uri: `${self.host}/${self.version}/${action}`,
          body: data
        }).then((response) => {
          return handleSuccess(resolve, cb, response)
        }).catch((error) => {
          return handleRejection(reject, cb, error)
        })
      })
    },

    /**
     * Parse the API Response
     * @param  {Object}   response request-promise full response object
     * @param  {Function} cb       optional callback
     * @return {Promise}           a Promise of parsed answer
     * @see    http://docs.pushwoosh.com/docs/createmessage#section-response-
     */
    parseResponse: (response, cb) => {
      return new Promise((resolve, reject) => {
        if (response.statusCode === 200 && response.body.status_code === 200) {
          return handleSuccess(resolve, cb, response.body.response)
        } else {
          return handleRejection(reject, cb, response.body)
        }
      })
    },

    /**
     * Send a notification
     * @param  {String}   message  Message sent (optional, if options.content is provided)
     * @param  {Object}   options  May contain:
     *                             - {String} content (optional, if message is provided)
     *                             - {Array}  devices
     *                             - {String} send_date
     *                             - {Bool}   ignore_user_timezone
     *                             - {Object} data
     *                             - {Array}  platforms
     * @param  {Function} cb       optional callback that would be called with the API response
     * @return {Promise}           A promise for the API reponse
     * @see    http://docs.pushwoosh.com/docs/createmessage#parameters
     */
    sendMessage: (message, options, cb) => {
      let self = this
      if (_.isObject(message) && _(message).has('content')) {
        if (_.isFunction(options)) {
          cb = options
        }
        options = message
        message = options.content
      }

      let defaults = {
        send_date: 'now',
        ignore_user_timezone: true,
        content: message
      }

      return new Promise((resolve, reject) => {
        if (!_.isString(message)) {
          return handleRejection(reject, cb, new Error('options.message should be provided as a string'))
        }

        let body = {
          request: {
            auth: self.token,
            notifications: [_.extend({}, defaults, options, {content: message})]
          }
        }

        if (self.useAppGroup) {
          body.request.application_group = self.app
        } else {
          body.request.application = self.app
        }

        return self.sendRequest('createMessage', body)
          .then((response) => {
            return handleSuccess(resolve, cb, response)
          })
          .catch((error) => {
            return handleRejection(reject, cb, error)
          })
      })
    },

    /**
     * [description]
     * @param  {Object}   options [description]
     * @param  {Function} cb      optional callback
     * @return {Promise}          [description]
     */
    registerDevice: (options, cb) => {
      let self = this
      return new Promise((resolve, reject) => {
        if (!_.isString(options.push_token)) {
          return handleRejection(reject, cb, new Error('Device push token is mandatory (string)'))
        }

        if (_.isString(options.hwid)) {
          return handleRejection(reject, cb, new Error('Device hwid token is mandatory (string)'))
        }

        if (_.isNumber(options.device_type)) {
          return handleRejection(reject, cb, new Error('Device type is mandatory (number)'))
        }
        let body = {
          request: _.extend({}, {application: self.app}, options)
        }

        return self.sendRequest('registerDevice', body)
          .then((response) => {
            return handleSuccess(resolve, cb, response)
          })
          .catch((error) => {
            return handleRejection(reject, cb, error)
          })
      })
    },

    /**
     * [description]
     * @param  {String}   code [description]
     * @param  {Function} cb   optional callback
     * @return {Promise}       [description]
     */
    deleteMessage: (code, cb) => {
      let self = this
      return new Promise((resolve, reject) => {
        if (!_.isString(code)) {
          return handleRejection(reject, cb, new Error('Message id is mandatory (string)'))
        }
        let body = {
          request: {
            auth: self.token,
            message: code
          }
        }
        return self.sendRequest('deleteMessage', body)
          .then((response) => {
            return handleSuccess(resolve, cb, response)
          })
          .catch((error) => {
            return handleRejection(reject, cb, error)
          })
      })
    }
  }
}
